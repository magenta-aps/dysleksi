# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import uuid
from asyncio import Future, wait_for
from unittest.mock import ANY, MagicMock, call, patch

from asgiref.sync import async_to_sync
from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from channels_redis.core import RedisChannelLayer
from django.contrib.auth.models import AnonymousUser, Group
from django.core.cache import caches
from django.db.models.signals import post_save
from django.test import TestCase, TransactionTestCase

from dysleksi.models import STUDENTS, Institution, Message, Student
from dysleksi.routing import websocket_urlpatterns


class TestChatConsumer(TestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Group.objects.get_or_create(name=STUDENTS)
        cls.test_user = cls.create_student("TestUser")

    @classmethod
    def create_school(cls, number: str, name: str):
        school, _ = Institution.objects.get_or_create(number=number, name=name)
        return school

    @classmethod
    def create_student(cls, username: str, **kwargs) -> Student:
        student, _ = Student.objects.get_or_create(
            institution=cls.create_school("abc", "TestSchool"),
            username=username,
            defaults=kwargs,
        )
        return student

    async def _get_communicator(self) -> WebsocketCommunicator:
        # This is the same definition as in `dysleksi.project.asgi`, but without the
        # `AllowedHostsOriginValidator`, etc.
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, "/ws/chat/1234/")
        communicator.scope["user"] = self.test_user
        return communicator

    async def test_connect(self):
        communicator = await self._get_communicator()
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_receive_broadcasts_to_group(self):
        message: str = json.dumps({"foo": "bar", "event": "unit.test"})
        communicator = await self._get_communicator()
        await communicator.connect()
        await communicator.send_to(message)
        response = await communicator.receive_from()
        self.assertEqual(response, message)
        await communicator.disconnect()

    async def test_broadcasts_no_user(self):
        communicator = await self._get_communicator()
        communicator.scope["user"] = AnonymousUser()
        await communicator.connect()

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


class TestRelayConsumer(TestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Group.objects.get_or_create(name=STUDENTS)
        cls.test_user = Student.objects.create(
            institution=Institution.objects.create(
                number="def", name="RelayTestSchool"
            ),
            username="RelayTestUser",
        )

    async def _get_communicator(self) -> WebsocketCommunicator:
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, "/ws/relay/assignment_1234/")
        communicator.scope["user"] = self.test_user
        return communicator

    async def test_connect(self):
        communicator = await self._get_communicator()
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_rejects_anonymous_users(self):
        communicator = await self._get_communicator()
        communicator.scope["user"] = AnonymousUser()
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_forwards_to_the_room(self):
        message: str = json.dumps(
            {"event": "question.displayed", "from": "teacher", "studentId": 1}
        )
        communicator = await self._get_communicator()
        await communicator.connect()
        await communicator.send_to(message)

        response = await communicator.receive_from()

        self.assertEqual(json.loads(response), json.loads(message))
        await communicator.disconnect()


class TestChatConsumerMessageIntegration(TransactionTestCase):

    def setUp(self):
        Group.objects.get_or_create(name=STUDENTS)
        self.test_user = self.create_student("TestUser")

    @classmethod
    def create_student(cls, username: str, **kwargs) -> Student:
        student, _ = Student.objects.get_or_create(
            username=username,
            defaults=kwargs,
        )
        return student

    async def _get_communicator(self) -> WebsocketCommunicator:
        # This is the same definition as in `dysleksi.project.asgi`, but without the
        # `AllowedHostsOriginValidator`, etc.
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, "/ws/chat/1234/")
        communicator.scope["user"] = self.test_user
        return communicator

    def data(self):
        id = str(uuid.uuid4())
        return {
            "uuid": id,
            "event": "question.answered",
            "message": "Elev har besvaret spørgsmål 1",
            "choiceId": 2,
            "student": {"id": Student.objects.get(username="TestUser").id},
        }

    async def send_message(self, message: str, timeout: float = 2.0):
        communicator = await self._get_communicator()
        await communicator.connect()
        await communicator.send_to(message)

        # Wait for a message to be saved, by listing for a post_save signal
        # and fulfilling an awaitable Future
        future = Future()

        def post_save_handler(sender, instance, created, **kwargs):
            # detected saving a Message
            future.set_result(True)

        post_save.connect(post_save_handler, sender=Message)

        try:
            # Do not wait forever, timeout after 2 seconds
            await wait_for(future, timeout=timeout)
        finally:
            post_save.disconnect(post_save_handler, sender=Message)

    @patch.object(Message, "handle")
    def test_create_message_object(self, handle_mock: MagicMock):
        # Need a sync function, or DB lookup fails with "connection closed"
        data = self.data()
        message: str = json.dumps(data)
        handle_mock.return_value = None

        async_to_sync(self.send_message)(message)

        message_object = Message.objects.filter(uuid=data["uuid"]).first()
        self.assertIsNotNone(message_object)
        self.assertEqual(message_object.event, "question.answered")
        self.assertEqual(message_object.data, {"type": "chat.message", **data})
        handle_mock.assert_called_once()

    @patch.object(Message, "handle")
    def test_create_message_object_without_student(self, handle_mock: MagicMock):
        # Messages about the test itself (e.g. the teacher ending the test) name
        # no student, and are attributed to the user that sent them
        data = self.data()
        data["event"] = "test.cancelled"
        del data["student"]
        handle_mock.return_value = None

        async_to_sync(self.send_message)(json.dumps(data))

        message_object = Message.objects.filter(uuid=data["uuid"]).first()
        self.assertIsNotNone(message_object)
        self.assertEqual(message_object.event, "test.cancelled")
        self.assertEqual(message_object.user.pk, self.test_user.pk)
        handle_mock.assert_called_once()

    @patch.object(Message, "handle")
    def test_create_message_object_already_exists(self, handle_mock: MagicMock):
        data = self.data()
        message: str = json.dumps(data)
        Message.objects.create(uuid=data["uuid"], event="question.answered", data=data)

        # Message object already exists, so handle() should not be called
        with self.assertRaises(TimeoutError):
            async_to_sync(self.send_message)(message)
        handle_mock.assert_not_called()

    @patch.object(Message, "handle")
    def test_unhandled_event(self, handle_mock: MagicMock):
        data = self.data()
        data["event"] = "other.event"
        message: str = json.dumps(data)
        handle_mock.return_value = None

        # Message object already exists, so handle() should not be called
        with self.assertRaises(TimeoutError):
            async_to_sync(self.send_message)(message)
        self.assertFalse(Message.objects.filter(uuid=data["uuid"]).exists())
        handle_mock.assert_not_called()
