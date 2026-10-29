# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.conf import settings
from requests import Session


class PituClient:
    def __init__(
        self,
        client_header=None,
        certificate=None,
        private_key=None,
        base_url=None,
        root_ca=True,
        timeout=60,
        cpr_lookup_service=None,
        name_lookup_service=None,
    ):
        # Credentials, etc.
        self.client_header = client_header
        self.cert = (certificate, private_key)
        self.root_ca = root_ca
        self.base_url = base_url
        self.timeout = timeout
        # Service names
        self.cpr_lookup_service = cpr_lookup_service
        self.name_lookup_service = name_lookup_service
        # Session
        self.session = Session()
        self.session.cert = self.cert
        self.session.verify = self.root_ca
        self.session.headers.update({"Uxp-Client": client_header})

    @classmethod
    def from_settings(cls):
        return cls(**settings.PITU)

    def get(self, path, params=None, service=None):
        if params is None:
            params = {}
        if service is None:
            service = self.cpr_lookup_service
        r = self.session.get(
            self.base_url + path,
            params=params,
            timeout=self.timeout,
            headers={"Uxp-Service": service},
        )
        r.raise_for_status()
        return r.json()

    def close(self):
        self.session.close()

    def get_person_info_from_cpr(self, cpr: str):
        return self.get(
            f"/personLookup/1/cpr/{cpr}",
            service=self.cpr_lookup_service,
        )

    def get_person_info_from_name(self, first_name: str, last_name: str):
        return self.get(
            f"/search/?format=rvd&fornavn={first_name}&efternavn={last_name}",
            service=self.name_lookup_service,
        )
