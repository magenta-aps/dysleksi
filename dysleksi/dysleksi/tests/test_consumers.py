# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
from unittest.mock import ANY, call, patch

from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from channels_redis.core import RedisChannelLayer
from django.core.cache import caches
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

    async def test_send_cached_messages(self):
        with (
            patch.object(caches["chat"], "get_many") as mock_cache,
            patch.object(RedisChannelLayer, "send") as mock_send,
        ):
            mock_cache.return_value = {
                "chat_classroom_0001": {
                    "event": "lobby.joined",
                    "room": "classroom",
                },
                "chat_classroom_0002": {
                    "event": "lobby.present",
                    "room": "classroom",
                },
                "chat_classroom_0003": {
                    "event": "other.event",
                    "room": "classroom",
                },
            }
            communicator = await self._get_communicator()
            connected, subprotocol = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
            mock_send.assert_has_calls(
                [
                    call(
                        ANY,
                        {
                            "type": "chat.message",
                            "event": "lobby.joined",
                            "room": "classroom",
                        },
                    ),
                    call(
                        ANY,
                        {
                            "type": "chat.message",
                            "event": "lobby.present",
                            "room": "classroom",
                        },
                    ),
                ]
            )
            self.assertNotIn(
                call(
                    ANY,
                    {
                        "type": "chat.message",
                        "event": "other.event",
                        "room": "classroom",
                    },
                ),
                mock_send.call_args_list,
            )
