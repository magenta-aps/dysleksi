# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from unittest.mock import MagicMock

from django.test import TestCase
from django.test.utils import override_settings
from integrations.pitu.client import PituClient

pitu_test_settings = {
    "certificate": "test_cert",
    "private_key": "test_key",
    "root_ca": "test_ca",
    "client_header": "test_header",
    "base_url": "test_url",
    "cpr_lookup_service": "test_cpr_service",
    "name_lookup_service": "test_name_service",
}


@override_settings(PITU=pitu_test_settings)
class PituClientTest(TestCase):
    def setUp(self):
        super().setUp()
        self.response_mock = MagicMock()
        self.session_mock = MagicMock()
        self.session_mock.get.return_value = self.response_mock
        self.pitu_client = PituClient.from_settings()
        self.pitu_client.session = self.session_mock
        self.pitu_client._session = self.session_mock
        self.response_mock.json.side_effect = None

    def test_init(self):
        self.assertEqual(self.pitu_client.cert, ("test_cert", "test_key"))
        self.assertEqual(self.pitu_client.root_ca, "test_ca")
        self.assertEqual(self.pitu_client.base_url, "test_url")
        self.assertEqual(self.pitu_client.timeout, 60)
        self.assertEqual(self.pitu_client.cpr_lookup_service, "test_cpr_service")
        self.assertEqual(self.pitu_client.name_lookup_service, "test_name_service")

    def test_close(self):
        self.assertFalse(self.pitu_client.session.close.called)
        self.pitu_client.close()
        self.assertTrue(self.pitu_client.session.close.called)

    def test_get(self):
        self.response_mock.json.return_value = {"foo": "bar"}
        json_response = self.pitu_client.get("/foo/bar")
        self.assertTrue(self.pitu_client.session.get.called)
        self.assertEqual(json_response["foo"], "bar")

    def test_get_using_params(self):
        params = {"foo": "bar"}
        self.pitu_client.get("/foo/bar", params=params)
        self.assertTrue(self.pitu_client.session.get.called)
        self.assertTrue(
            self.pitu_client.session.get.call_args_list[0].kwargs["params"] == params
        )

    def test_get_person_info_from_cpr(self):
        self.response_mock.json.return_value = {"foo": "bar"}
        json_response = self.pitu_client.get_person_info_from_cpr("0101011234")
        self.assertTrue(self.pitu_client.session.get.called)
        self.assertEqual(json_response["foo"], "bar")

    def test_get_person_info_from_name(self):
        self.response_mock.json.return_value = {"foo": "bar"}
        json_response = self.pitu_client.get_person_info_from_name("first", "last")
        self.assertTrue(self.pitu_client.session.get.called)
        self.assertEqual(json_response["foo"], "bar")
