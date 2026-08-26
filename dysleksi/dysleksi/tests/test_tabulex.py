# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Dict, List
from unittest.mock import MagicMock, PropertyMock, call, patch

from django.conf import settings
from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from lxml import etree
from xmlsec import Transform
from zeep.wsse.signature import _make_sign_key, _sign_envelope_with_key_binary

from dysleksi.clients.tabulex import (
    CustomBinarySignature,
    DysleksiTabulexClient,
    TabulexClient,
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


class TestTabulex(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.tabulex_client: DysleksiTabulexClient = DysleksiTabulexClient(
            "http://www.example.com", {}, None, True
        )
        Group.objects.update_or_create(name=TEACHERS)
        Group.objects.update_or_create(name=STUDENTS)
        Group.objects.update_or_create(name=READING_SUPERVISORS)

    @patch.object(TabulexClient, "client", new_callable=PropertyMock)
    @patch("builtins.print")
    def test_test_connection(self, mock_print, mock_client_property):
        dummy_data = "TestResponse"
        client_mock = mock_client_property.return_value = MagicMock()
        client_mock.service.helloWorldWithCertificate.return_value = dummy_data

        self.tabulex_client.mock = True
        self.tabulex_client.test_connection()
        mock_print.assert_not_called()
        client_mock.service.helloWorldWithCertificate.assert_not_called()

        self.tabulex_client.mock = False
        self.tabulex_client.test_connection()
        mock_print.assert_called_with(dummy_data)
        client_mock.service.helloWorldWithCertificate.assert_called_once()

    @patch.object(TabulexClient, "client", new_callable=PropertyMock)
    def test_export_xml(self, client_property_mock):
        dummy_data: Export = self.tabulex_client.load_dummydata()
        client_mock = client_property_mock.return_value = MagicMock()
        client_mock.service.eksporterXmlMellem.return_value = dummy_data
        data = self.tabulex_client.export_xml("R00123")
        self.assertEqual(data, dummy_data)
        client_mock.service.eksporterXmlMellem.assert_called_once()

    def test_apply_signature(self):
        signature_handler = CustomBinarySignature(
            certfile=settings.TABULEX["client_cert"][0],
            key_file=settings.TABULEX["client_cert"][1],
            signature_method=Transform.RSA_SHA256,
            digest_method=Transform.SHA256,
        )
        with open("/app/dysleksi/tests/resources/test_outgoing_soap.xml", "r") as file:
            xml = etree.fromstring(file.read())
        envelope, headers = signature_handler.apply(xml, {})

        wsu_namespace = (
            "{http://docs.oasis-open.org/wss/2004/01/"
            "oasis-200401-wss-wssecurity-utility-1.0.xsd}"
        )
        wsa_namespace = "{http://www.w3.org/2005/08/addressing}"
        soap_namespace = "{http://www.w3.org/2003/05/soap-envelope}"
        ns_namespace = "{https://brugerdatabasen.stil.dk/bpi/common/3}"
        ds_namespace = "{http://www.w3.org/2000/09/xmldsig#}"

        for namespace, tagname in (
            (wsu_namespace, "Timestamp"),
            (wsa_namespace, "MessageID"),
            (soap_namespace, "Body"),
            (ns_namespace, "UdbydersystemId"),
        ):
            tag = envelope.find(f".//{namespace}{tagname}")
            id = tag.get(f"{wsu_namespace}Id")
            reference = envelope.find(f".//{ds_namespace}Reference[@URI='#{id}']")
            self.assertIsNotNone(reference, tagname)
            transform = reference.find(f".//{ds_namespace}Transform")
            self.assertIsNotNone(transform, tagname)
            self.assertEqual(
                transform.get("Algorithm"),
                "http://www.w3.org/2001/10/xml-exc-c14n#",
                tagname,
            )
            digest_method = reference.find(f".//{ds_namespace}DigestMethod")
            self.assertIsNotNone(digest_method, tagname)
            self.assertEqual(
                digest_method.get("Algorithm"),
                "http://www.w3.org/2001/04/xmlenc#sha256",
            )
            digest_value = reference.find(f".//{ds_namespace}DigestValue")
            self.assertIsNotNone(digest_value, tagname)
            self.assertNotEqual(digest_value.text, "", tagname)

    def test_add_field_signatures(self):
        signature_handler = CustomBinarySignature(
            certfile=settings.TABULEX["client_cert"][0],
            key_file=settings.TABULEX["client_cert"][1],
            signature_method=Transform.RSA_SHA256,
            digest_method=Transform.SHA256,
        )
        print(settings.TABULEX["client_cert"])
        with open("/app/dysleksi/tests/resources/test_outgoing_soap.xml", "r") as file:
            envelope = etree.fromstring(file.read())

        # Call super method, obtaining `key` which would otherwise be hidden
        key = _make_sign_key(
            signature_handler.key_data,
            signature_handler.cert_data,
            signature_handler.password,
        )
        _sign_envelope_with_key_binary(
            envelope,
            key,
            signature_handler.signature_method,
            signature_handler.digest_method,
        )

        # Create <Reference> digests of these tags
        # (zeep by default only digests <Body> and <Timestamp>)
        signature_handler.add_field_signatures(
            key,
            envelope,
            [
                envelope.find(".//{http://www.w3.org/2005/08/addressing}MessageID"),
                envelope.find(".//{http://www.w3.org/2003/05/soap-envelope}Body"),
                None,
            ],
        )

        wsu_namespace = (
            "{http://docs.oasis-open.org/wss/2004/01/"
            "oasis-200401-wss-wssecurity-utility-1.0.xsd}"
        )
        wsa_namespace = "{http://www.w3.org/2005/08/addressing}"
        soap_namespace = "{http://www.w3.org/2003/05/soap-envelope}"
        ns_namespace = "{https://brugerdatabasen.stil.dk/bpi/common/3}"
        ds_namespace = "{http://www.w3.org/2000/09/xmldsig#}"

        present_ids = set()
        for namespace, tagname in (
            (wsa_namespace, "MessageID"),
            (soap_namespace, "Body"),
        ):
            tag = envelope.find(f".//{namespace}{tagname}")
            id = tag.get(f"{wsu_namespace}Id")
            present_ids.add(id)
            reference = envelope.find(f".//{ds_namespace}Reference[@URI='#{id}']")
            self.assertIsNotNone(reference, tagname)
            transform = reference.find(f".//{ds_namespace}Transform")
            self.assertIsNotNone(transform, tagname)
            self.assertEqual(
                transform.get("Algorithm"),
                "http://www.w3.org/2001/10/xml-exc-c14n#",
                tagname,
            )
            digest_method = reference.find(f".//{ds_namespace}DigestMethod")
            self.assertIsNotNone(digest_method, tagname)
            self.assertEqual(
                digest_method.get("Algorithm"),
                "http://www.w3.org/2001/04/xmlenc#sha256",
            )
            digest_value = reference.find(f".//{ds_namespace}DigestValue")
            self.assertIsNotNone(digest_value, tagname)
            self.assertNotEqual(digest_value.text, "", tagname)

        for namespace, tagname in ((ns_namespace, "UdbydersystemId"),):
            tag = envelope.find(f".//{namespace}{tagname}")
            id = tag.get(f"{wsu_namespace}Id")
            self.assertIsNone(id)

        self.assertEqual(len(envelope.findall(f".//{ds_namespace}Reference")), 2)

    def test_from_settings(self):
        with override_settings(
            TABULEX={
                "wsdl": "https://www.foobar.com",
                "auth": {
                    "basic": {
                        "username": "alice",
                        "domain": "whoisawesome",
                        "password": "bobsucks",
                    }
                },
                "client_cert": ("/ssl/client.crt", "/ssl/client.key"),
                "system_id": "foobar",
                "proxy": {"socks": "http://localhost:1234"},
                "mock": True,
            }
        ):
            client = TabulexClient.from_settings()
            self.assertEqual(client.wsdl, "https://www.foobar.com")
            self.assertEqual(
                client.auth,
                {
                    "basic": {
                        "username": "alice",
                        "domain": "whoisawesome",
                        "password": "bobsucks",
                    }
                },
            )
            self.assertEqual(client.proxy, {"socks": "http://localhost:1234"})
            self.assertEqual(client.mock, True)
            self.assertEqual(client.system_id, "foobar")

    def test_load_dummydata(self):
        self.tabulex_client.update_model("abc", False, False)

        institution = Institution.objects.filter(number="R00123").first()
        self.assertIsNotNone(institution)
        self.assertEqual(institution.name, "ET Skole - ændret")
        self.assertEqual(institution.classes.count(), 16)

        class_1a = institution.classes.filter(group_id="1.A").first()
        self.assertIsNotNone(class_1a)
        self.assertTrue(class_1a.is_main)
        self.assertEqual(class_1a.school_year_start, 2025)
        self.assertEqual(class_1a.school_year_end, 2026)
        self.assertEqual(class_1a.school_year, "2025 - 2026")
        self.assertEqual(class_1a.teachers.count(), 0)
        self.assertEqual(class_1a.students.count(), 4)

        class_1a_matematik = institution.classes.filter(
            group_id="1.A Matematik"
        ).first()
        self.assertIsNotNone(class_1a_matematik)
        self.assertFalse(class_1a_matematik.is_main)
        self.assertEqual(class_1a_matematik.school_year_start, 2025)
        self.assertEqual(class_1a_matematik.school_year_end, 2026)
        self.assertEqual(class_1a_matematik.school_year, "2025 - 2026")
        self.assertEqual(class_1a_matematik.teachers.count(), 1)
        self.assertEqual(class_1a_matematik.students.count(), 4)

        student_1 = institution.students.filter(username="1000000a01").first()
        self.assertIsNotNone(student_1)
        self.assertIn(class_1a, student_1.classes.all())
        self.assertIn(class_1a_matematik, student_1.classes.all())

    def test_fail_parse_schoolyear(self):
        dummy_data: Export = self.tabulex_client.load_dummydata()
        dummy_data.ImportSource[0].schoolYear = "foobar"
        with patch.object(
            self.tabulex_client, "load_dummydata", return_value=dummy_data
        ):
            with self.assertRaises(ValueError) as ctx:
                self.tabulex_client.update_model("abc", False, False)
            exception: ValueError = ctx.exception
            self.assertEqual(
                str(exception),
                "Could not parse 'foobar' as two years "
                "(should be in format xxxx-yyyy)",
            )

    def _parse_print(self, calls: List[call]) -> Dict[str, List[str]]:
        structure: Dict[str, List[str]] = {}
        latest: List[str] | None = None
        for c in calls:
            message = c.args[0]
            if message.startswith("    ") and latest is not None:
                latest.append(message)
            else:
                latest = []
                structure[message] = latest
        return structure

    def test_class_missing(self):
        dummy_data: Export = self.tabulex_client.load_dummydata()
        dummy_data_groups = dummy_data.Institution.Group
        dummy_data_class_1a = [
            group for group in dummy_data_groups if group.GroupId == "1.A"
        ][0]
        dummy_data_groups.remove(dummy_data_class_1a)

        with patch.object(
            self.tabulex_client, "load_dummydata", return_value=dummy_data
        ), patch("builtins.print") as mock_print:
            self.tabulex_client.update_model("abc", False, True)
            # We could not assign a class thos this student, so we don't create him
            self.assertFalse(Student.objects.filter(username="1000000a01").exists())
            self.assertFalse(Student.objects.filter(username="1000000a02").exists())
            self.assertFalse(Student.objects.filter(username="1000000a03").exists())
            self.assertFalse(Student.objects.filter(username="1000000a04").exists())
        printed_messages = self._parse_print(mock_print.mock_calls)
        self.assertNotIn("Created class 1.A", printed_messages)
        self.assertIn(
            "Class with group_id 1.A was not found, "
            "cannot assign to student 1000000a01",
            printed_messages,
        )

    def test_student_exists_same_main_class(self):
        institution = Institution.objects.create(
            number="R00123", name="ET Skole - ændret"
        )
        main_cls = Class.objects.create(
            institution=institution,
            group_id="1.A",
            name="1.A",
            is_main=True,
            school_year_start=2025,
        )
        subject_cls = Class.objects.create(
            institution=institution,
            group_id="1.A Raketvidenskab",
            name="1.A Raketvidenskab",
            is_main=False,
            school_year_start=2025,
        )
        student = Student.objects.create(
            institution=institution,
            first_name="Kasper",
            last_name="Johansen",
            username="1000000a01",
        )
        student.classes.add(main_cls)
        student.classes.add(subject_cls)
        with patch("builtins.print") as mock_print:
            self.tabulex_client.update_model("abc", False, True)
        student.refresh_from_db()
        self.assertIn(main_cls, student.classes.all())
        self.assertNotIn(subject_cls, student.classes.all())

        printed_messages = self._parse_print(mock_print.mock_calls)
        self.assertIn("Updated class 1.A", printed_messages)
        self.assertIn(
            "Updated student 1000000a01 (Kasper Johansen)",
            printed_messages,
        )
        a01_messages = printed_messages["Updated student 1000000a01 (Kasper Johansen)"]
        self.assertNotIn("    Removing old main class 1.A", a01_messages)
        self.assertNotIn("    Setting new main class 1.A", a01_messages)

    def test_student_exists_new_main_class(self):
        institution = Institution.objects.create(
            number="R00123", name="ET Skole - ændret"
        )
        main_cls = Class.objects.create(
            institution=institution,
            group_id="0.A",
            name="0.A",
            is_main=True,
            school_year_start=2025,
        )
        student = Student.objects.create(
            institution=institution,
            first_name="Kasper",
            last_name="Johansen",
            username="1000000a01",
        )
        student.classes.add(main_cls)
        with patch("builtins.print") as mock_print:
            self.tabulex_client.update_model("abc", False)
        student.refresh_from_db()
        self.assertNotIn(main_cls, student.classes.all())
        self.assertEqual(student.classes.filter(is_main=True).first().name, "1.A")
        printed_messages = self._parse_print(mock_print.mock_calls)
        self.assertIn("Updated student 1000000a01 (Kasper Johansen)", printed_messages)
        a01_messages = printed_messages["Updated student 1000000a01 (Kasper Johansen)"]
        self.assertIn("    Removing old main class 0.A", a01_messages)
        self.assertIn("    Setting new main class 1.A", a01_messages)

    def test_teacher_exists(self):
        institution = Institution.objects.create(
            number="R00123", name="ET Skole - ændret"
        )
        subject_cls_1 = Class.objects.create(
            institution=institution,
            group_id="1.A Matematik",
            name="1.A Matematik",
            is_main=False,
            school_year_start=2025,
        )
        subject_cls_2 = Class.objects.create(
            institution=institution,
            group_id="1.A Raketvidenskab",
            name="1.A Raketvidenskab",
            is_main=False,
            school_year_start=2025,
        )
        teacher = Teacher.objects.create(
            institution=institution,
            first_name="Henrik",
            last_name="Sørensen",
            username="1000000a18",
        )
        teacher.classes.add(subject_cls_1)
        teacher.classes.add(subject_cls_2)
        with patch("builtins.print") as mock_print:
            self.tabulex_client.update_model("abc", False, True)
        teacher.refresh_from_db()
        self.assertIn(subject_cls_1, teacher.classes.all())
        self.assertNotIn(subject_cls_2, teacher.classes.all())
        printed_messages = self._parse_print(mock_print.mock_calls)
        self.assertIn("Updated teacher 1000000a18 (Henrik Sørensen)", printed_messages)
        a18_messages = printed_messages["Updated teacher 1000000a18 (Henrik Sørensen)"]
        self.assertIn("    removing old class 1.A Raketvidenskab", a18_messages)

    def test_reading_supervisor(self):
        # The role of a læsevejleder differs from school-to-school, so the dummy
        # data holds one of each accepted spelling
        cases = (
            ("1000000a20", "Bendt Ledersen"),
            ("1000000a22", "Vibeke Nielsen"),
        )
        self.tabulex_client.update_model("abc", False, False)
        institution = Institution.objects.get(number="R00123")

        for username, full_name in cases:
            with self.subTest(username=username):
                supervisor = ReadingSupervisor.objects.filter(username=username).first()
                self.assertIsNotNone(supervisor)
                self.assertEqual(supervisor.get_full_name(), full_name)
                self.assertTrue(supervisor.is_reading_supervisor)
                # A læsevejleder is not a teacher of any class, but can see all
                # classes at the institution
                self.assertFalse(Teacher.objects.filter(pk=supervisor.pk).exists())
                self.assertQuerySetEqual(supervisor.institutions.all(), [institution])
                self.assertQuerySetEqual(
                    supervisor.accessible_classes,
                    institution.classes.all(),
                    ordered=False,
                )

    def test_reading_supervisor_takes_precedence_over_teacher(self):
        # "1000000a23" is both "Leder" and "Lærer" in the dummy data. Being a
        # læsevejleder wins, so no teacher is created and the classes listed on
        # the employee are ignored
        self.tabulex_client.update_model("abc", False, False)

        supervisor = ReadingSupervisor.objects.get(username="1000000a23")
        self.assertEqual(supervisor.get_full_name(), "Aputsiaq Lynge")
        self.assertFalse(Teacher.objects.filter(pk=supervisor.pk).exists())
        class_1a_matematik = Class.objects.get(group_id="1.A Matematik")
        self.assertQuerySetEqual(
            class_1a_matematik.teachers.all(),
            Teacher.objects.filter(username="1000000a18"),
        )

    def test_reading_supervisor_multiple_institutions(self):
        other_institution = Institution.objects.create(
            number="R00456", name="En Anden Skole"
        )
        self.tabulex_client.update_model("abc", False, False)

        supervisor = ReadingSupervisor.objects.get(username="1000000a20")
        supervisor.institutions.add(other_institution)

        # Importing the same institution again keeps the other institution
        self.tabulex_client.update_model("abc", False, False)
        self.assertQuerySetEqual(
            supervisor.institutions.all(),
            [Institution.objects.get(number="R00123"), other_institution],
            ordered=False,
        )

    def test_reading_supervisor_from_dummydata(self):
        with patch("builtins.print") as mock_print:
            self.tabulex_client.update_model("abc", False, True)

        supervisor = ReadingSupervisor.objects.get(username="1000000a20")
        self.assertEqual(supervisor.get_full_name(), "Bendt Ledersen")
        institution = Institution.objects.get(number="R00123")
        self.assertQuerySetEqual(supervisor.institutions.all(), [institution])

        printed_messages = self._parse_print(mock_print.mock_calls)
        heading = "Created reading supervisor 1000000a20 (Bendt Ledersen)"
        self.assertIn(heading, printed_messages)
        self.assertIn(
            "    adding institution ET Skole - ændret", printed_messages[heading]
        )

    def test_create_reading_supervisor_login(self):
        self.assertFalse(
            ReadingSupervisor.objects.filter(username="1000000a20").exists()
        )
        with override_settings(DEBUG=True):
            self.tabulex_client.update_model("abc", False, False)
        supervisor = ReadingSupervisor.objects.filter(username="1000000a20").first()
        self.assertIsNotNone(supervisor)
        self.assertTrue(supervisor.check_password("password"))

    def test_create_teacher_login(self):
        self.assertFalse(Teacher.objects.filter(username="1000000a18").exists())
        with override_settings(DEBUG=True):
            self.tabulex_client.update_model("abc", False, False)
            teacher = Teacher.objects.filter(username="1000000a18").first()
            self.assertIsNotNone(teacher)
            self.assertTrue(teacher.check_password("password"))
