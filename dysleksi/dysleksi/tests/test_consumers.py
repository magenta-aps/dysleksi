# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json

from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TestCase

from dysleksi.routing import websocket_urlpatterns


class TestChatConsumer(TestCase):
    async def test_connect(self):
        communicator = await self._get_communicator()
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_receive_broadcasts_to_group(self):
        message: str = json.dumps({"foo": "bar"})
        communicator = await self._get_communicator()
        await communicator.connect()
        await communicator.send_to(message)
        response = await communicator.receive_from()
        self.assertEqual(response, message)
        await communicator.disconnect()

    async def _get_communicator(self) -> WebsocketCommunicator:
        # This is the same definition as in `dysleksi.project.asgi`, but without the
        # `AllowedHostsOriginValidator`, etc.
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, "/ws/chat/1234/")
        return communicator
