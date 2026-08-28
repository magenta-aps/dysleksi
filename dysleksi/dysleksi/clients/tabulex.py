# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Set, Tuple
from xml.etree.ElementTree import QName

from django.conf import settings
from django.contrib.auth.models import Group
from lxml.etree import _Element as Element
from requests import Session
from xmlsec import Key, SignatureContext, Transform, template  # type: ignore
from zeep import Client, wsse
from zeep.ns import SOAP_ENV_12
from zeep.transports import Transport
from zeep.wsa import WsAddressingPlugin
from zeep.wsse import utils
from zeep.wsse.signature import (
    BinarySignature,
    _make_sign_key,
    _sign_envelope_with_key_binary,
)

from dysleksi.clients.tabulex_dummydata import Export
from dysleksi.models import (
    READING_SUPERVISORS,
    STUDENTS,
    TEACHERS,
    Class,
    Institution,
    ReadingSupervisor,
    Student,
    Teacher,
)

logger = logging.getLogger(__name__)


class TabulexClient:

    def __init__(
        self,
        wsdl: str,
        cert: Tuple[str, str],
        system_id: str,
        auth: dict,
        proxy: dict | None = None,
        mock: bool = False,
    ):
        self.cert = cert
        self.wsdl: str = wsdl
        self.system_id = system_id
        self._client: Client | None = None
        self.auth: dict = auth
        self.proxy: dict | None = proxy
        self.mock: bool = mock

    @classmethod
    def from_settings(cls):
        tabulex_settings = settings.TABULEX
        return cls(
            wsdl=tabulex_settings["wsdl"],
            cert=tabulex_settings["client_cert"],
            system_id=tabulex_settings["system_id"],
            auth=tabulex_settings["auth"],
            proxy=tabulex_settings.get("proxy"),
            mock=tabulex_settings.get("mock", False),
        )

    def test_connection(self):
        if self.mock:
            pass  # pragma: no cover
        else:
            response = self.client.service.helloWorldWithCertificate(
                _soapheaders={"UdbydersystemId": self.system_id}
            )
            print(response)

    def export_xml(self, institution_number: str):
        # There are also eksporterXmlLille and eksporterXmlFuld
        return self.client.service.eksporterXmlMellem(
            _soapheaders={"UdbydersystemId": self.system_id},
            instnr=institution_number,
        )

    @property
    def client(self) -> Client:  # pragma: no cover
        if self._client is None:
            session = Session()
            if self.proxy:
                socks = self.proxy.get("socks")
                if socks:
                    proxy = f"socks5://{socks}"
                    session.proxies = {"http": proxy, "https": proxy}
            if self.auth:
                if "basic" in self.auth:
                    basic_settings = self.auth["basic"]
                    session.auth = (
                        f'{basic_settings["username"]}@{basic_settings["domain"]}',
                        basic_settings["password"],
                    )
            addressing = WsAddressingPlugin()
            try:
                self._client = Client(
                    wsdl=self.wsdl,
                    transport=Transport(
                        session=session,
                        timeout=3600,
                        operation_timeout=3600,
                    ),
                    wsse=CustomBinarySignature(
                        # trust_cert="/ssl/stil/trust1.crt",
                        certfile=self.cert[0],
                        key_file=self.cert[1],
                        signature_method=Transform.RSA_SHA256,  # type: ignore
                        digest_method=Transform.SHA256,  # type: ignore
                    ),
                    plugins=[addressing],
                )
                self._client.set_ns_prefix(
                    "ns", "https://brugerdatabasen.stil.dk/bpi/common/3"
                )
                self._client.set_ns_prefix(
                    "wsu",
                    "http://docs.oasis-open.org/wss/2004/01/"
                    "oasis-200401-wss-wssecurity-utility-1.0.xsd",
                )
                self._client.set_ns_prefix("ds", "http://www.w3.org/2000/09/xmldsig#")
            except Exception as e:
                logger.error("Failed connecting to stil: %s" % str(e))
                raise e
        assert self._client is not None
        return self._client


class CustomBinarySignature(BinarySignature):
    #
    # def __init__(self, trust_cert, *args, **kwargs):
    #     super().__init__(*args, **kwargs)
    #     self.trust_cert = trust_cert
    #     with open(trust_cert, "rb") as f:
    #         self.trust_data = f.read()

    def apply(self, envelope: Element, headers):

        security: Element = utils.get_security_header(envelope)

        # Create <Timestamp>
        created = datetime.now(timezone.utc)
        expired = created + timedelta(seconds=5 * 60)
        timestamp = utils.WSU("Timestamp")
        timestamp.append(utils.WSU("Created", created.strftime("%Y-%m-%dT%H:%M:%SZ")))
        timestamp.append(utils.WSU("Expires", expired.strftime("%Y-%m-%dT%H:%M:%SZ")))
        security.append(timestamp)

        # Set `mustUnderstand` attribute on <Security>
        security.set(str(QName(SOAP_ENV_12, "mustUnderstand")), "true")

        # Call super method, obtaining `key` which would otherwise be hidden
        key = _make_sign_key(self.key_data, self.cert_data, self.password)
        _sign_envelope_with_key_binary(
            envelope, key, self.signature_method, self.digest_method
        )

        # Reorder so <BinarySecurityToken> comes before <Signature> inside <Security>
        binary_token = security.find(
            "{http://docs.oasis-open.org/wss/2004/01/"
            "oasis-200401-wss-wssecurity-secext-1.0.xsd}BinarySecurityToken"
        )
        security.insert(0, binary_token)

        # Insert <Security> at the top of the <Header>
        envelope_header = security.getparent()
        envelope_header.insert(0, security)

        # Create <Reference> digests of these tags
        # (zeep by default only digest <Body> and <Timestamp>)
        self.add_field_signatures(
            key,
            envelope,
            [
                envelope.find(".//{http://www.w3.org/2005/08/addressing}MessageID"),
                envelope.find(
                    ".//{https://brugerdatabasen.stil.dk/bpi/common/3}UdbydersystemId"
                ),
                # These are already signed by zeep, so they shouldn't be needed
                # We detect and ignore them if they are included anyway
                # envelope.find('.//{http://www.w3.org/2003/05/soap-envelope}Body'),
                # envelope.find('.//{http://docs.oasis-open.org/wss/2004/01/
                # oasis-200401-wss-wssecurity-utility-1.0.xsd}Timestamp'),
            ],
        )
        return envelope, headers

    def add_field_signatures(
        self, key: Key, envelope: Element, elements_to_sign: Iterable[Element]
    ) -> None:

        # Each element in elements_to_sign should get a unique wsa:Id attribute,
        # and a <Reference> should point to it with attribute URI.
        # Then the <DigestValue> in the <Reference> gets
        # set to a checksum of the element

        security: Element = utils.get_security_header(envelope)
        signature: Element = security.find(
            "{http://www.w3.org/2000/09/xmldsig#}Signature"
        )
        signature_context: SignatureContext = SignatureContext()
        signature_context.key = key

        existing_references: Set[str] = {
            child.get("URI")
            for child in signature.findall(
                ".//{http://www.w3.org/2000/09/xmldsig#}Reference"
            )
        }

        for element in elements_to_sign:
            if element is not None:
                id: str = f"#{wsse.utils.ensure_id(element)}"
                signature_context.register_id(element, "Id", wsse.utils.ns.WSU)
                if id not in existing_references:
                    ref = template.add_reference(
                        signature,
                        Transform.SHA256,  # type: ignore
                        uri=id,
                    )
                    template.add_transform(
                        ref,
                        Transform.EXCL_C14N,  # type: ignore
                    )

        signature_context.sign(signature)

    def verify(self, envelope):  # pragma: no cover
        # Skip validation of server response
        # set trust_data when we want to verify
        # key = _make_verify_key(self.trust_data)
        # self._verify_envelope_with_key(envelope, key)
        return envelope


class DysleksiTabulexClient(TabulexClient):

    def load_dummydata(self):
        with open(settings.TABULEX["dummy_data"], "r") as file:
            return Export.from_json(file.read())

    def update_model(
        self,
        institution_number: str | None,
        load_remote: bool = False,
        verbose: bool = True,
    ):

        Group.objects.update_or_create(name=TEACHERS)
        Group.objects.update_or_create(name=STUDENTS)
        Group.objects.update_or_create(name=READING_SUPERVISORS)

        if load_remote and institution_number is not None:
            data = self.export_xml(institution_number)  # pragma: no cover
        else:
            data = self.load_dummydata()

        schoolyear: str = data.ImportSource[0].schoolYear  # f.eks. "2024-2025"
        match: re.Match[str] | None = re.match(r"(\d{4})-(\d{4})", schoolyear)
        if match is None:
            raise ValueError(
                f"Could not parse '{schoolyear}' as two years "
                f"(should be in format xxxx-yyyy)"
            )
        school_year_start = match.group(1)

        institution_data = data.Institution

        institution_object, created = Institution.objects.update_or_create(
            number=institution_data.InstitutionNumber,
            defaults={"name": institution_data.InstitutionName},
        )

        for group in institution_data.Group:
            # type kan være "Hovedgruppe", "Hold" eller "Andet"
            cls, created = Class.objects.update_or_create(
                group_id=group.GroupId,
                institution=institution_object,
                school_year_start=school_year_start,
                defaults={
                    "name": group.GroupName,
                    "is_main": group.GroupType == "Hovedgruppe",
                },
            )
            if verbose:  # pragma: no branch
                print(f"{('Created' if created else 'Updated')} class {cls.name}")

        # Loop people, create/update Students/Teachers/ReadingSupervisors
        for institution_person in institution_data.InstitutionPerson:
            if institution_person.Student is not None and self._is_or_contains_any(
                institution_person.Student.Role, "Elev"
            ):

                try:
                    new_main_class = Class.objects.get(
                        group_id=institution_person.Student.MainGroupId, is_main=True
                    )
                except Class.DoesNotExist:
                    if verbose:  # pragma: no branch
                        print(
                            f"Class with group_id "
                            f"{institution_person.Student.MainGroupId} was not "
                            f"found, cannot assign to student "
                            f"{institution_person.Person.UserId}"
                        )
                    continue

                student, created = Student.objects.update_or_create(
                    username=institution_person.Person.UserId,
                    defaults={
                        "institution": institution_object,
                        "first_name": institution_person.Person.FirstName,
                        "last_name": institution_person.Person.FamilyName,
                        "uniid": institution_person.Person.UserId,
                    },
                )
                if verbose:  # pragma: no branch
                    print(
                        f"{('Created' if created else 'Updated')} student "
                        f"{student.username} ({student.get_full_name()})"
                    )
                existing_main_class = student.classes.filter(
                    school_year_start=school_year_start, is_main=True
                ).first()

                if (
                    existing_main_class is not None
                    and existing_main_class != new_main_class
                ):
                    if verbose:  # pragma: no branch
                        print(f"    Removing old main class {existing_main_class.name}")
                    student.classes.remove(existing_main_class)
                    existing_main_class = None
                if existing_main_class is None:
                    if verbose:  # pragma: no branch
                        print(f"    Setting new main class {new_main_class.name}")
                    student.classes.add(new_main_class)

                existing_classes = student.classes.filter(
                    school_year_start=school_year_start, is_main=False
                )
                new_classes = Class.objects.filter(
                    school_year_start=school_year_start,
                    group_id__in=institution_person.Student.GroupId,
                    is_main=False,
                )

                for old_class in set(existing_classes).difference(set(new_classes)):
                    if verbose:  # pragma: no branch
                        print(f"    removing old class {old_class.name}")
                    student.classes.remove(old_class)
                for new_class in set(new_classes).difference(set(existing_classes)):
                    if verbose:  # pragma: no branch
                        print(f"    adding new class {new_class.name}")
                    student.classes.add(new_class)

            # NOTE: Is "ledelse" or "Leder" the proper role for a "Læsevejleder"?
            # The actual name of the læsevejleder role likely differs from
            # school-to-school.
            #
            # If new roles which should receive a "læsevejleder" login show up, this
            # if-statement check should be extended.
            if institution_person.Employee is not None and self._is_or_contains_any(
                institution_person.Employee.Role, "Ledelse", "Leder"
            ):
                supervisor, created = ReadingSupervisor.objects.update_or_create(
                    username=institution_person.Person.UserId,
                    defaults={
                        "first_name": institution_person.Person.FirstName,
                        "last_name": institution_person.Person.FamilyName,
                        "uniid": institution_person.Person.UserId,
                    },
                )
                if verbose:  # pragma: no branch
                    print(
                        f"{('Created' if created else 'Updated')} reading supervisor "
                        f"{supervisor.username} ({supervisor.get_full_name()})"
                    )
                if settings.DEBUG and created:
                    supervisor.set_password("password")
                    supervisor.save()
                if institution_object not in supervisor.institutions.all():
                    if verbose:  # pragma: no branch
                        print(f"    adding institution {institution_object.name}")
                    supervisor.institutions.add(institution_object)

            elif institution_person.Employee is not None and self._is_or_contains_any(
                institution_person.Employee.Role, "Pædagog", "Lærer"
            ):
                teacher, created = Teacher.objects.update_or_create(
                    username=institution_person.Person.UserId,
                    defaults={
                        "institution": institution_object,
                        "first_name": institution_person.Person.FirstName,
                        "last_name": institution_person.Person.FamilyName,
                        "uniid": institution_person.Person.UserId,
                    },
                )
                if verbose:  # pragma: no branch
                    print(
                        f"{('Created' if created else 'Updated')} teacher "
                        f"{teacher.username} ({teacher.get_full_name()})"
                    )
                if settings.DEBUG and created:
                    teacher.set_password("password")
                    teacher.save()
                existing_classes = teacher.classes.filter(
                    school_year_start=school_year_start
                )
                new_classes = Class.objects.filter(
                    school_year_start=school_year_start,
                    group_id__in=institution_person.Employee.GroupId,
                )

                for old_class in set(existing_classes).difference(set(new_classes)):
                    if verbose:  # pragma: no branch
                        print(f"    removing old class {old_class.name}")
                    teacher.classes.remove(old_class)
                for new_class in set(new_classes).difference(set(existing_classes)):
                    if verbose:  # pragma: no branch
                        print(f"    adding new class {new_class.name}")
                    teacher.classes.add(new_class)

    @staticmethod
    def _is_or_contains_any(collection_or_item: str | List[str], *values: str) -> bool:
        if type(collection_or_item) is str:
            collection_or_item = [collection_or_item]
        return not set(collection_or_item).isdisjoint(set(values))
