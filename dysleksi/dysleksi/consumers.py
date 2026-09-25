import logging

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.exceptions import DenyConnection
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db.models import Q

from dysleksi.models import Student, TestAssignment

logger = logging.getLogger(__name__)


def db_sync_to_async(func):
    return database_sync_to_async(func, thread_sensitive=False)


# Rendering a user queries its groups, which must not happen in the event loop
describe = sync_to_async(str, thread_sensitive=False)


class RelayConsumer(AsyncJsonWebsocketConsumer):
    """
    Consumer which allows teacher and student to talk to each other in case the webRTC
    connection fails

    Does not store anything to the database; That is what `MessageStorageView` is for.
    """

    def __init__(self):
        super().__init__()
        self.connected = False

    async def connect(self):
        self.user = self.scope["user"]
        if self.user is None or not self.user.is_authenticated:
            raise DenyConnection("User not authenticated")
        self.user_name = await describe(self.user)

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"relay_{self.room_name}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        logger.info("'%s' joined relay '%s'", self.user_name, self.room_name)
        self.connected = True

    async def disconnect(self, close_code):
        if not self.connected:
            return

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info("'%s' left relay '%s'", self.user_name, self.room_name)

    async def receive_json(self, content: dict, **kwargs):
        invite_events = ("session.start", "session.in_progress")
        if self.room_name == "lobby" and content.get("event") in invite_events:

            # Only consider students for which this is their latest assignment.
            content["studentIds"] = await self.students_to_invite(content)

            if not content["studentIds"]:
                # The lobby is for inviting students to tests.
                # If there is nobody to invite, the message should be rejected
                return

        content["type"] = "relay.message"
        await self.channel_layer.group_send(self.room_group_name, content)

    @db_sync_to_async
    def students_to_invite(self, content: dict) -> list[int]:
        student_ids = content["studentIds"]
        assignment_id = content["assignmentId"]

        assignment = TestAssignment.objects.get(pk=assignment_id)
        start_date_time = assignment.start_date_time

        students_with_newer_assignments = set(
            Student.objects.filter(
                Q(assignments__start_date_time__gt=start_date_time)
                | Q(student_subset__start_date_time__gt=start_date_time)
                | Q(
                    classes__testassignment__start_date_time__gt=start_date_time,
                    classes__testassignment__student_subset__isnull=True,
                ),
                pk__in=student_ids,
            ).values_list("pk", flat=True)
        )

        students_who_are_done = set(
            assignment.responses.filter(
                completed=True, student__in=student_ids
            ).values_list("student_id", flat=True)
        )

        if students_with_newer_assignments:
            logger.info(
                "Not inviting students %s to assignment '%s'; they have a newer one",
                sorted(students_with_newer_assignments),
                assignment_id,
            )
        if students_who_are_done:
            logger.info(
                "Not inviting students %s to assignment '%s'; they already finished it",
                sorted(students_who_are_done),
                assignment_id,
            )
        uninvited = students_with_newer_assignments | students_who_are_done
        return [id for id in student_ids if id not in uninvited]

    async def relay_message(self, message: dict):
        await self.send_json({k: v for k, v in message.items() if k != "type"})
