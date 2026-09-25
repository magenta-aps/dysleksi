# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import uuid
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser, Group
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from dysleksi.models import (
    STUDENTS,
    Class,
    Institution,
    Student,
    Test,
    TestAssignment,
    User,
)
from dysleksi.routing import websocket_urlpatterns


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

        # Leaving a room which was never joined must not raise
        await communicator.disconnect()

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


class TestLobbyInvitations(TransactionTestCase):
    """A student waiting in the lobby is only invited into their newest test
    assignment. Invitations from older ones are not relayed to them.
    """

    def setUp(self):
        Group.objects.get_or_create(name=STUDENTS)
        school = Institution.objects.create(number="ghi", name="LobbyTestSchool")
        self.teacher = User.objects.create(username="LobbyTestTeacher")
        self.student1 = Student.objects.create(
            institution=school, username="LobbyTestStudent1"
        )
        self.student2 = Student.objects.create(
            institution=school, username="LobbyTestStudent2"
        )
        self.klasse = Class.objects.create(
            institution=school,
            group_id="1",
            school_year_start=2025,
            name="1.A",
        )
        self.klasse.students.add(self.student1, self.student2)
        self.test = Test.objects.create(name="LobbyTest")

        # The teacher started a group test of the whole class, and after that an
        # individual test which only student1 was assigned to
        now = timezone.now()
        self.group_assignment = TestAssignment.objects.create(
            test=self.test,
            teacher=self.teacher,
            klasse=self.klasse,
            start_date_time=now - timedelta(minutes=5),
        )
        self.individual_assignment = TestAssignment.objects.create(
            test=self.test,
            teacher=self.teacher,
            student=self.student1,
            start_date_time=now,
        )

    def invite(
        self,
        assignment: TestAssignment,
        students: list[Student],
        event: str = "session.in_progress",
        room: str = "lobby",
    ) -> dict | None:
        """Invite `students` into `assignment`, and return the relayed message."""
        return async_to_sync(self._invite)(assignment, students, event, room)

    async def _invite(
        self,
        assignment: TestAssignment,
        students: list[Student],
        event: str,
        room: str,
    ) -> dict | None:
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, f"/ws/relay/{room}/")
        communicator.scope["user"] = self.teacher
        await communicator.connect()
        await communicator.send_json_to(
            {
                "uuid": str(uuid.uuid4()),
                "event": event,
                "roomUrl": f"/rooms/{assignment.pk}/",
                "studentIds": [student.pk for student in students],
                "assignmentId": assignment.pk,
            }
        )

        relayed = None
        if not await communicator.receive_nothing(timeout=1):
            relayed = await communicator.receive_json_from()
        await communicator.disconnect()
        return relayed

    def test_invites_students_of_the_newest_assignment(self):
        relayed = self.invite(self.individual_assignment, [self.student1])

        self.assertEqual(relayed["studentIds"], [self.student1.pk])

    def test_skips_students_with_a_newer_assignment(self):
        # student1 has a newer individual test, so only student2 is still invited
        # into the group test
        relayed = self.invite(self.group_assignment, [self.student1, self.student2])

        self.assertEqual(relayed["studentIds"], [self.student2.pk])

    def test_does_not_relay_when_nobody_is_left_to_invite(self):
        relayed = self.invite(self.group_assignment, [self.student1])

        self.assertIsNone(relayed)

    def test_ignores_tests_that_were_never_started(self):
        # A test which is only planned has not been started, so it does not take
        # student1 away from the test they are being invited into
        TestAssignment.objects.create(
            test=self.test, teacher=self.teacher, student=self.student1
        )

        relayed = self.invite(self.individual_assignment, [self.student1])

        self.assertEqual(relayed["studentIds"], [self.student1.pk])

    def test_a_test_that_is_started_again_takes_over(self):
        # The teacher opens the test-room of the older group test again, which
        # makes it the newest test of both students
        self.group_assignment.start()

        relayed = self.invite(self.individual_assignment, [self.student1])

        self.assertIsNone(relayed)

    def test_skips_students_who_are_done_with_the_assignment(self):
        # Simulate the teacher pressing "Afslut test"
        self.individual_assignment.end()

        # Validate that nobody gets an invite
        relayed = self.invite(self.individual_assignment, [self.student1])
        self.assertIsNone(relayed)

    def test_a_student_subset_only_concerns_the_students_in_it(self):
        # The teacher started a newer group test for student1 alone
        subset_assignment = TestAssignment.objects.create(
            test=self.test,
            teacher=self.teacher,
            klasse=self.klasse,
            start_date_time=timezone.now() + timedelta(minutes=5),
        )
        subset_assignment.student_subset.add(self.student1)

        # It takes student1 away from their individual test, but student2 is
        # not in the subset, so they are still invited into the group test
        self.assertIsNone(self.invite(self.individual_assignment, [self.student1]))
        relayed = self.invite(self.group_assignment, [self.student2])

        self.assertEqual(relayed["studentIds"], [self.student2.pk])
