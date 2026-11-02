# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
import re
import time
from unittest.mock import MagicMock, patch

import requests
from django.conf import settings
from django.core.management import call_command as core_call_command
from django.test import override_settings
from django.utils import timezone
from integrations.eboks.client import (
    EboksClient,
    MessageCollisionException,
    MessageFailureException,
)
from integrations.eboks.tests.test_eboks_client import EboksTest

from dysleksi.models import EboksMessage


@override_settings(EBOKS=EboksTest.test_settings())
class SendTest(EboksTest):

    @patch.object(requests.sessions.Session, "request")
    def test_pre_saved(self, mock_request):
        mock_request.side_effect = self.mock_request("", "")
        message = EboksMessage.objects.create(
            cpr_cvr="12345678",
            title="EboksTest",
            content_type=179343,
        )
        message.set_pdf_data(pdf_data=self.data)
        with EboksClient.from_settings() as client:
            message.send(client)
        mock_request.assert_called_with(
            "PUT",
            f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
            f"dispatchsystem/3994/dispatches/{message.message_id}",
            None,
            message.xml,
            timeout=60,
        )
        self.assertEqual(message.status, "sent")
        self.assertEqual(message.recipient_status, "")
        self.assertIsNotNone(message.pk)

    @patch.object(requests.sessions.Session, "request")
    def test_send_success(self, mock_request):
        mock_request.side_effect = self.mock_request("", "")
        message = EboksMessage.dispatch("12345678", "EboksTest", 179343, self.data)
        mock_request.assert_called_with(
            "PUT",
            f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
            f"dispatchsystem/3994/dispatches/{message.message_id}",
            None,
            message.xml,
            timeout=60,
        )
        self.assertEqual(message.status, "sent")
        self.assertEqual(message.recipient_status, "")
        self.assertIsNotNone(message.pk)

    @patch.object(requests.sessions.Session, "request")
    def test_send_postprocessing(self, mock_request):
        mock_request.side_effect = self.mock_request("exempt", "pending")
        message = EboksMessage.dispatch("12345678", "EboksTest", 179343, self.data)
        mock_request.assert_called_with(
            "PUT",
            f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
            f"dispatchsystem/3994/dispatches/{message.message_id}",
            None,
            message.xml,
            timeout=60,
        )
        self.assertEqual(message.status, "post_processing")
        self.assertEqual(message.recipient_status, "exempt")
        self.assertIsNotNone(message.pk)

    @patch.object(requests.sessions.Session, "request")
    @patch.object(time, "sleep")
    def test_send_collision(self, mock_sleep, mock_request):
        mock_sleep.return_value = None
        mock_request.side_effect = self.mock_request("exempt", "pending", 0, 419)
        message = EboksMessage(
            cpr_cvr="12345678", title="EboksTest", content_type=179343
        )
        message.set_pdf_data(self.data)
        with self.assertRaises(MessageCollisionException):
            message.send()
        mock_sleep.assert_not_called()
        self.assertEqual(message.status, "failed")

    @patch.object(requests.sessions.Session, "request")
    @patch.object(time, "sleep")
    def test_send_error(self, mock_sleep, mock_request):
        mock_sleep.return_value = None
        mock_request.side_effect = self.mock_request("exempt", "pending", 0, 400)
        message = EboksMessage(
            cpr_cvr="12345678", title="EboksTest", content_type=179343
        )
        message.set_pdf_data(self.data)
        with self.assertRaises(MessageFailureException):
            message.send()
        mock_sleep.assert_not_called()
        self.assertEqual(message.status, "failed")

    @patch.object(requests.sessions.Session, "request")
    def test_send_retry(self, mock_request):
        for blockings in range(1, 5):
            # Must patch inside loop to get correct number of sleep() calls
            with patch.object(time, "sleep") as mock_sleep:
                mock_sleep.return_value = None
                mock_request.side_effect = self.mock_request(
                    "exempt", "pending", blockings
                )
                message = EboksMessage.dispatch(
                    "12345678", "EboksTest", 179343, self.data
                )
                mock_request.assert_called_with(
                    "PUT",
                    f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
                    f"dispatchsystem/3994/dispatches/{message.message_id}",
                    None,
                    message.xml,
                    timeout=60,
                )
                mock_sleep.assert_called_with(10)
                self.assertEqual(len(mock_sleep.mock_calls), blockings)
                self.assertEqual(message.status, "post_processing")
                self.assertEqual(message.recipient_status, "exempt")
                self.assertIsNotNone(message.pk)

    @patch.object(requests.sessions.Session, "request")
    def test_send_retry_errorcode(self, mock_request):
        with patch.object(time, "sleep") as mock_sleep:
            mock_sleep.return_value = None
            mock_request.side_effect = self.mock_request("exempt", "pending", 0, 500)
            message = EboksMessage(
                cpr_cvr="12345678", title="EboksTest", content_type=179343
            )
            message.set_pdf_data(self.data)
            with self.assertRaises(MessageFailureException):
                message.send()
            mock_request.assert_called_with(
                "PUT",
                f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
                f"dispatchsystem/3994/dispatches/{message.message_id}",
                None,
                message.xml,
                timeout=60,
            )
            mock_sleep.assert_called_with(10)
            self.assertEqual(len(mock_sleep.mock_calls), 5)
            self.assertEqual(message.status, "failed")
            self.assertIsNotNone(message.pk)

    @patch.object(requests.sessions.Session, "request")
    def test_send_retry_fail(self, mock_request):
        with patch.object(time, "sleep") as mock_sleep:
            mock_sleep.return_value = None
            mock_request.side_effect = self.mock_request("exempt", "pending", 6)
            with self.assertRaises(
                Exception,
                msg="Failed to send message to ebox; "
                "retried 5 times spaced 10 seconds apart. Last exception was:",
            ):
                message = EboksMessage.dispatch(
                    "12345678", "EboksTest", 179343, self.data
                )
                mock_request.assert_called_with(
                    "PUT",
                    f"https://eboxtest.nanoq.gl/int/rest/srv.svc/3/"
                    f"dispatchsystem/3994/dispatches/{message.message_id}",
                    None,
                    message.xml,
                    timeout=60,
                )
                mock_sleep.assert_called_with(10)
                self.assertEqual(len(mock_sleep.mock_calls), 5)
                self.assertEqual(message.status, "post_processing")
                self.assertEqual(message.recipient_status, "exempt")
                self.assertIsNotNone(message.pk)


class EboksXmlTest(EboksTest):
    def test_generate_xml_company(self):
        xml = EboksMessage.generate_xml(
            "12345678", "EboksTest", 179343, self.data
        ).decode("utf-8")
        self.assertIsNotNone(re.search(r"<Id>12345678</Id>", xml))
        self.assertIsNotNone(re.search(r"<Type>V</Type>", xml))
        self.assertIsNotNone(re.search(r"<Nationality>DK</Nationality>", xml))
        self.assertIsNotNone(re.search(r"<ContentTypeId>179343</ContentTypeId>", xml))
        self.assertIsNotNone(re.search(r"<Title>EboksTest</Title>", xml))
        self.assertIsNotNone(re.search(r"<FileExtension>pdf</FileExtension>", xml))

    def test_generate_xml_person(self):
        xml = EboksMessage.generate_xml(
            "1234567890", "EboksTest", 179343, self.data
        ).decode("utf-8")
        self.assertIsNotNone(re.search(r"<Id>1234567890</Id>", xml))
        self.assertIsNotNone(re.search(r"<Type>P</Type>", xml))
        self.assertIsNotNone(re.search(r"<Nationality>DK</Nationality>", xml))
        self.assertIsNotNone(re.search(r"<ContentTypeId>179343</ContentTypeId>", xml))
        self.assertIsNotNone(re.search(r"<Title>EboksTest</Title>", xml))
        self.assertIsNotNone(re.search(r"<FileExtension>pdf</FileExtension>", xml))

    def test_generate_xml_invalid(self):
        with self.assertRaises(ValueError, msg="cpr/cvr must be all digits"):
            EboksMessage.generate_xml("1234567A", "EboksTest", 179343, self.data)
        with self.assertRaises(
            ValueError, msg="unknown recipient type for: {123456789}"
        ):
            EboksMessage.generate_xml("123456789", "EboksTest", 179343, self.data)


@override_settings(EBOKS=EboksTest.test_settings())
class FinalStatusTest(EboksTest):

    @classmethod
    def mock_request(cls, message_id, post_status):
        mock = MagicMock()

        def side_effect(method, url, params, data, **kwargs):
            client_id = settings.EBOKS["client_id"]
            if (
                method == "GET"
                and url == f"https://eboxtest.nanoq.gl/rest/messages/{client_id}/"
                and "abcdefgh" in params["message_id"]
            ):

                return cls.mock_response(
                    200,
                    json.dumps(
                        [
                            {
                                "message_id": message_id,
                                "proxy_response_code": 200,
                                "proxy_error": None,
                                "modified_at": timezone.now().isoformat(),
                                "recipients": [
                                    {
                                        "nr": "12345678",
                                        "recipient_type": "V",
                                        "nationality": "DK",
                                        "status": "exempt",
                                        "reject_reason": None,
                                        "post_processing_status": post_status,
                                    }
                                ],
                            }
                        ]
                    ).encode("utf-8"),
                )
            return cls.mock_response(404)

        mock.side_effect = side_effect
        return mock

    @patch.object(requests.sessions.Session, "request")
    def test_update_final_statuses(self, mock_request):
        message = EboksMessage(
            cpr_cvr="12345678",
            title="EboksTest",
            content_type=179343,
        )
        message.message_id = "abcdefgh"
        message.set_pdf_data(self.data)
        message.status = "post_processing"
        message.recipient_status = "exempt"
        message.post_processing_status = "pending"
        message.is_postprocessing = True
        message.save()

        mock_request.side_effect = self.mock_request(
            message.message_id, "remote printed"
        )
        core_call_command("eboks_update_status")
        message.refresh_from_db()
        self.assertEqual(message.status, "sent")
        self.assertEqual(message.post_processing_status, "remote printed")
        self.assertFalse(message.is_postprocessing)

    @patch.object(requests.sessions.Session, "request")
    def test_update_final_statuses_still_processing(self, mock_request):
        message = EboksMessage(
            cpr_cvr="12345678",
            title="EboksTest",
            content_type=179343,
        )
        message.message_id = "abcdefgh"
        message.set_pdf_data(self.data)
        message.status = "post_processing"
        message.recipient_status = "exempt"
        message.post_processing_status = "pending"
        message.is_postprocessing = True
        message.save()

        mock_request.side_effect = self.mock_request(message.message_id, "pending")
        with EboksClient.from_settings() as client:
            EboksMessage.update_final_statuses(client)
        message.refresh_from_db()
        self.assertEqual(message.status, "post_processing")
        self.assertEqual(message.post_processing_status, "pending")
        self.assertTrue(message.is_postprocessing)

    @patch.object(requests.sessions.Session, "request")
    def test_update_final_statuses_none(self, mock_request):
        # Not initializing anything
        core_call_command("eboks_update_status")
        mock_request.assert_not_called()

    @patch.object(requests.sessions.Session, "request")
    def test_update_final_statuses_already_processed(self, mock_request):
        message = EboksMessage(
            cpr_cvr="12345678",
            title="EboksTest",
            content_type=179343,
        )
        message.message_id = "abcdefgh"
        message.set_pdf_data(self.data)
        message.status = "sent"
        message.recipient_status = "exempt"
        message.post_processing_status = "remote printed"
        message.is_postprocessing = False
        message.save()

        with EboksClient.from_settings() as client:
            EboksMessage.update_final_statuses(client)
        mock_request.assert_not_called()
        message.refresh_from_db()
        self.assertEqual(message.status, "sent")
        self.assertEqual(message.post_processing_status, "remote printed")
        self.assertFalse(message.is_postprocessing)
