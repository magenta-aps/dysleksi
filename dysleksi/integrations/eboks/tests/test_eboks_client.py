# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
import os
import os.path
import re
from unittest.mock import MagicMock, patch

import requests
from django.conf import settings
from django.core.files.temp import NamedTemporaryFile
from django.test import TestCase, override_settings
from integrations.eboks.client import EboksClient
from requests import Response
from requests.exceptions import ConnectionError


class EboksTest(TestCase):
    client_cert_file = NamedTemporaryFile(suffix=".crt")
    client_key_file = NamedTemporaryFile(suffix=".key")

    @property
    def data(self) -> bytes:
        with open(os.path.join(os.path.dirname(__file__), "test.pdf"), "rb") as f:
            return f.read()

    @classmethod
    def mock_response(cls, status_code: int = 200, content: bytes = b""):
        response = Response()
        response.status_code = status_code
        response._content = content
        return response

    @classmethod
    def test_settings(cls, **kwargs):
        return {
            **settings.EBOKS,
            "client_cert": cls.client_cert_file.name,
            "client_key": cls.client_key_file.name,
            **kwargs,
        }

    @staticmethod
    def mock_request(recipient_status, post_processing_status, fails=0, status=200):
        mock = MagicMock()

        def side_effect(method, url, params, data, **kwargs):
            if mock.fails > 0:
                mock.fails -= 1
                raise ConnectionError
            m = re.search(
                r"/int/rest/srv.svc/3/dispatchsystem/3994/dispatches/([^/]+)", url
            )
            if m is None:
                raise Exception("No match")
            message_id = m.group(1)

            response = Response()
            response.status_code = status
            if status == 200:
                response._content = json.dumps(
                    {
                        "message_id": message_id,
                        "recipients": [
                            {
                                "status": recipient_status,
                                "post_processing_status": post_processing_status,
                            }
                        ],
                    }
                ).encode("utf-8")
            return response

        mock.fails = fails
        mock.side_effect = side_effect
        return mock


@override_settings(EBOKS=EboksTest.test_settings())
class ClientInfoTest(EboksTest):

    @staticmethod
    def mock_request(fails=0):
        mock = MagicMock()

        def side_effect(method, url, params, data, **kwargs):
            if mock.fails > 0:
                mock.fails -= 1
                raise ConnectionError
            m = re.search(r"/rest/client/([^/]+)/", url)
            if m is None:
                raise Exception("No match")
            client_id = m.group(1)

            response = Response()
            response.status_code = 200
            response._content = json.dumps(
                {
                    "id": client_id,
                    "enable": True,
                    "name": "TestSystem",
                    "organisational_path": "test/testsystem",
                }
            ).encode("utf-8")
            return response

        mock.fails = fails
        mock.side_effect = side_effect
        return mock

    @patch.object(requests.sessions.Session, "request")
    def test_get_client_info_success(self, mock_request):
        mock_request.side_effect = self.mock_request()
        client = EboksClient.from_settings()
        response = client.get_client_info()
        self.assertEqual(response.status_code, 200)
        client_info = response.json()
        self.assertIsInstance(client_info, dict)
        self.assertEqual(client_info["name"], "TestSystem")
        self.assertEqual(client_info["organisational_path"], "test/testsystem")
        self.assertEqual(client_info["enable"], True)
        self.assertEqual(client_info["id"], "99")


@override_settings(EBOKS=EboksTest.test_settings())
class ClientTest(EboksTest):

    def test_missing_files(self):
        with self.settings(EBOKS=self.test_settings(client_cert="/non-existent-file")):
            with self.assertRaises(FileNotFoundError):
                EboksClient.from_settings()
        with self.settings(EBOKS=self.test_settings(client_key="/non-existent-file")):
            with self.assertRaises(FileNotFoundError):
                EboksClient.from_settings()

    def test_verify(self):
        with self.settings(
            EBOKS={
                **settings.EBOKS,
                "host_verify": "/server.crt",
            }
        ):
            client = EboksClient.from_settings()
            self.assertEqual(client.verify, "/server.crt")
            self.assertEqual(client.session.verify, "/server.crt")
