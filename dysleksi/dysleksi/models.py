# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import logging
import mimetypes
import os
import re
from base64 import b64decode
from datetime import date
from typing import Any, Dict, List

from django.conf import settings
from django.contrib.auth.models import AbstractUser, Group
from django.contrib.postgres.fields import DateTimeRangeField
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import QuerySet, TextChoices
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

from dysleksi.exceptions import MissingIdException

# Do not change these values;
# they are present in the database as Group names, and rows are searched for by these
TEACHERS = "Lærere"
STUDENTS = "Elever"

logger = logging.getLogger(__name__)


class InstructionAction(TextChoices):
    SHOW = "show"
    HIDE = "hide"
    FADE_IN = "fadeIn"
    FADE_OUT = "fadeOut"
    SHOW_FADED = "showFaded"
    PLAY_SOUND = "playSound"
    HIGHLIGHT = "highlight"
    SELECT = "select"
    SET_TEXT = "setText"
    SET_BUTTON_SOUND_ONCE = "setButtonSoundOnce"
    SET_REPEAT_BUTTON_DESTINATION = "setRepeatButtonDestination"
    CLICK_BUTTON = "clickButton"
    SET_MARKER = "setMarker"
    ADD_TEXT = "addText"
    REMOVE_TEXT = "removeText"


class QuestionType(TextChoices):
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_CHOICE_WITH_DISPLAY_FIELD = "multiple_choice_with_display_field"
    FREE_TEXT = "free_text"
    NO_INPUT_REQUIRED = "no_input_required"


class TestType(TextChoices):
    INDIVIDUAL = "individual"
    GROUP = "group"


class User(AbstractUser):
    history = HistoricalRecords()

    cpr = models.BigIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(101000000), MaxValueValidator(3112999999)],
        db_index=True,
        verbose_name=_("CPR"),
        unique=True,
    )

    @cached_property
    def group_names(self) -> List[str]:
        if self.pk:
            return list(self.groups.values_list("name", flat=True))
        return []

    def has_group(self, name: str) -> bool:
        return name in self.group_names

    @cached_property
    def user_type(self) -> str:
        if self.is_superuser:
            return "Administrator"
        if self.is_teacher:
            return "Lærer"
        if self.is_student:
            return "Elev"
        return "Ukendt brugertype"

    @cached_property
    def is_teacher(self):
        return self.has_group(TEACHERS)

    @cached_property
    def is_student(self):
        return self.has_group(STUDENTS)

    def __str__(self) -> str:
        return (
            f"{' '.join(filter(None, [self.first_name, self.last_name]))} "
            f"(type={self.user_type}, pk={self.pk})"
        )

    def subclass_instance(self) -> "User":
        if self.is_teacher:
            return Teacher.objects.get_or_create(user_ptr=self)[0]
        elif self.is_student:
            return Student.objects.get_or_create(user_ptr=self)[0]
        return self


class Institution(models.Model):
    name = models.CharField(
        max_length=100,
        db_index=True,
    )
    number = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,
    )


class Student(User):
    klasse = models.ForeignKey(
        "Class",
        on_delete=models.SET_NULL,
        null=True,
    )
    institution = models.ForeignKey(
        Institution,
        null=True,
        on_delete=models.CASCADE,
        related_name="students",
    )

    is_student = True
    is_teacher = False


@receiver(post_save, sender=Student)
def on_update_student(sender, instance: Student, created: bool, **kwargs):
    if created:  # pragma: no branch
        instance.groups.add(Group.objects.get(name=STUDENTS))


class Teacher(User):
    institution = models.ForeignKey(
        Institution,
        null=True,
        on_delete=models.CASCADE,
        related_name="teachers",
    )

    is_student = False
    is_teacher = True


@receiver(post_save, sender=Teacher)
def on_update_teacher(sender, instance: Teacher, created: bool, **kwargs):
    if created:  # pragma: no branch
        instance.groups.add(Group.objects.get(name=TEACHERS))


class ClassQuerySet(QuerySet):
    def current(self):
        today = date.today()
        return self.filter(
            school_year_start=today.year if today.month >= 7 else today.year - 1
        )


class Class(models.Model):

    objects = ClassQuerySet.as_manager()

    institution = models.ForeignKey(
        Institution,
        null=True,
        on_delete=models.CASCADE,
        related_name="classes",
    )

    # Bruges til sync med Tabulex
    # vi får id i inddata og skal opdatere det tilsvarende objekt i DB
    group_id = models.CharField(
        max_length=32,
        null=False,
        default="",
        db_index=True,
    )

    school_year_start = models.PositiveSmallIntegerField(
        null=True,
        blank=False,
        default=None,
        verbose_name="Year that this class started",
        db_index=True,
        # F.eks. en nuværende klasse i marts 2026 vil være
        # årgang 2025 - 2026, dvs. dette felt er 2025
        # Klasser lever ikke fra år til år; når et nyt skoleår starter,
        # arbejder vi med nye klasser
    )

    @cached_property
    def school_year_end(self):
        return self.school_year_start + 1

    @cached_property
    def school_year(self) -> str:
        return f"{self.school_year_start} - {self.school_year_end}"

    name = models.CharField(max_length=32, null=False, blank=False, default="")
    teachers = models.ManyToManyField(
        Teacher,
        related_name="classes",
    )

    students = models.ManyToManyField(
        Student,
        related_name="classes",
    )

    is_main = models.BooleanField(
        default=False,
    )

    def __str__(self) -> str:
        return self.name

    class Meta:
        # Tilsammen identificerer disse tre en klasse unikt
        unique_together = ("institution", "group_id", "school_year_start")


class TestResource(models.Model):
    name = models.CharField(max_length=200, blank=False, null=False)
    image = models.ImageField(upload_to="images", blank=True, null=True)
    sound = models.FileField(upload_to="sounds", blank=True, null=True)
    text = models.CharField(max_length=200, blank=True, null=True, default=None)

    class Meta:
        constraints = [
            models.CheckConstraint(
                # Django FileFields (and ImageFields) do not store null values,
                # but empty strings. See https://code.djangoproject.com/ticket/10244
                condition=~models.Q(image="")
                | ~models.Q(sound="")
                | models.Q(text__isnull=False),
                name="image_or_sound_or_text_must_be_set",
            )
        ]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def url(self):
        if self.sound:
            return self.sound.url
        elif self.image:
            return self.image.url
        return None


class Test(models.Model):
    name = models.CharField(max_length=255)

    test_type = models.CharField(
        choices=TestType,
        default=TestType.INDIVIDUAL,
    )

    custom = models.BooleanField(
        default=False,
    )

    def to_json(self) -> dict:
        """
        Serialize the Test with its parts, questions, and possible answers.
        Returns a Python dict that can be converted to JSON with json.dumps().
        """
        test_data: Dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "test_type": self.test_type,
            "parts": [],
        }

        for part in self.parts.all().order_by("id"):
            part_data: dict = {
                "id": part.id,
                "name": part.name,
                "image": part.image_url,
                "instructions_url": (
                    part.instructions.url if part.instructions else None
                ),
                "timeout": part.timeout,
                "partial_score_after": part.partial_score_after,
                "practice": [],
                "questions": [],
            }

            for practice, questions in (
                (True, part.questions.filter(is_practice=True)),
                (False, part.questions.filter(is_practice=False)),
            ):
                for question in questions.order_by("id"):
                    question_data: dict[str, Any] = {
                        "id": question.id,
                        "question_type": question.question_type,
                        "possible_answers": [],
                        "instruction_sequence": (
                            question.instruction_sequence.to_json()
                            if question.is_practice
                            and hasattr(question, "instruction_sequence")
                            else None
                        ),
                        "reminder": question.reminder,
                        "reminderSource": str(
                            settings.REMINDER_FALLBACK  # type: ignore
                        ),
                        "timeout": question.timeout,
                    }
                    if question.reminder_source:
                        question_data["reminderSource"] = question.reminder_source.url
                    if question.challenge:
                        question_data.update(
                            {
                                "challenge_id": question.challenge.id,
                                "challenge_name": question.challenge.name,
                                "challenge_text": question.challenge.text,
                                "challenge_image_url": None,
                                "challenge_sound_url": None,
                            }
                        )
                        if question.challenge.sound:
                            question_data["challenge_sound_url"] = (
                                question.challenge.sound.url
                            )
                        if question.challenge.image:
                            question_data["challenge_image_url"] = (
                                question.challenge.image.url
                            )

                    for answer in question.possible_answers.all().order_by("id"):
                        answer_data = {
                            "id": answer.id,
                            "resource_id": answer.resource.id,
                            "resource_name": answer.resource.name,
                            "resource_image_url": (
                                answer.resource.image.url
                                if answer.resource.image
                                else None
                            ),
                            "resource_sound_url": (
                                answer.resource.sound.url
                                if answer.resource.sound
                                else None
                            ),
                            "resource_text": answer.resource.text,
                            "is_correct": answer.is_correct,
                        }
                        question_data["possible_answers"].append(answer_data)

                    key = "practice" if practice else "questions"
                    part_data[key].append(question_data)

            test_data["parts"].append(part_data)

        return test_data

    def __str__(self) -> str:
        return self.name


class PlannedDateTime(models.Model):
    period = DateTimeRangeField()

    def __str__(self) -> str:
        return str(self.period)


class TestAssignment(models.Model):
    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(student__isnull=False)
                | models.Q(klasse__isnull=False),
                name="student_or_class_must_be_set",
            )
        ]

    test = models.ForeignKey(
        Test,
        on_delete=models.CASCADE,
        blank=False,
        null=False,
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        blank=False,
        null=False,
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="assignments",
        blank=True,
        null=True,
    )
    klasse = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    planned_date_time = models.OneToOneField(
        PlannedDateTime,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )

    @property
    def klasse_name(self):
        if self.klasse:
            return self.klasse.name
        else:
            return self.student.klasse.name

    def __str__(self) -> str:
        assignee = self.student or self.klasse
        return f"{self.test.name}/{str(self.teacher)} ({str(assignee)})"


class TestPart(models.Model):
    tests = models.ManyToManyField(
        Test,
        related_name="parts",
    )
    name = models.CharField(max_length=255)
    image_url = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Path to static image, e.g. '/static/images/wordreading.png'",
    )

    instructions = models.FileField(upload_to="instructions", blank=True, null=True)
    timeout = models.PositiveIntegerField(blank=False, null=False)
    partial_score_after = models.PositiveIntegerField(blank=False, null=False)
    reminder = models.PositiveIntegerField(blank=False, null=False, default=0)
    reminder_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="reminder_testpart",
    )

    def __str__(self) -> str:
        return self.name

    def create_test_resources(self, questions_data, is_practice=False):
        for data in questions_data:
            # Initialize new dict to avoid carry-over from previous question
            question = {"part": self, "is_practice": is_practice}

            # Challenge resource (image)
            test_resource_kwargs = {"name": "challenge"}
            test_resource_kwargs["image"] = data.get("image", None)
            test_resource_kwargs["sound"] = data.get("sound", None)
            test_resource_kwargs["text"] = data.get("text", None)
            if "image" in data or "sound" in data or "text" in data:
                question["challenge"], created = TestResource.objects.get_or_create(
                    **test_resource_kwargs
                )
            else:
                question["challenge"] = None

            question["question_type"] = data.get(
                "question_type", QuestionType.NO_INPUT_REQUIRED
            )
            question["reminder"] = data.get("reminder", self.reminder)
            question_reminder_source = data.get("reminder_source", self.reminder_source)
            question["reminder_source"], _ = TestResource.objects.get_or_create(
                name=question_reminder_source, sound=question_reminder_source
            )
            if "timeout" in data and not is_practice:
                question["timeout"] = data["timeout"]
            else:
                question["timeout"] = 0

            question = TestQuestion.objects.create(**question)

            if is_practice and "instruction_sequence" in data:
                question.create_instruction_sequence(data["instruction_sequence"])

            # Correct answer
            if data.get("correct"):
                correct_answer = data["correct"]
                test_resource_kwargs = {}

                mime_type, _ = mimetypes.guess_type(correct_answer)
                if mime_type and mime_type.startswith("image"):

                    test_resource_kwargs["name"] = os.path.basename(correct_answer)
                    test_resource_kwargs["image"] = correct_answer
                else:
                    test_resource_kwargs["name"] = correct_answer
                    test_resource_kwargs["text"] = correct_answer
                correct_resource, created = TestResource.objects.get_or_create(
                    **test_resource_kwargs
                )

                PossibleAnswer.objects.get_or_create(
                    question=question,
                    resource=correct_resource,
                    defaults={"is_correct": True},
                )

            # Wrong answers
            if data.get("wrong"):
                for wrong_answer in data["wrong"]:

                    test_resource_kwargs = {}

                    mime_type, _ = mimetypes.guess_type(wrong_answer)
                    if mime_type and mime_type.startswith("image"):
                        test_resource_kwargs["name"] = os.path.basename(wrong_answer)
                        test_resource_kwargs["image"] = wrong_answer
                    else:
                        test_resource_kwargs["name"] = wrong_answer
                        test_resource_kwargs["text"] = wrong_answer

                    wrong_resource, created = TestResource.objects.get_or_create(
                        **test_resource_kwargs
                    )

                    PossibleAnswer.objects.get_or_create(
                        question=question,
                        resource=wrong_resource,
                        defaults={"is_correct": False},
                    )


class TestQuestion(models.Model):
    part = models.ForeignKey(
        TestPart,
        on_delete=models.CASCADE,
        related_name="questions",
        null=False,
    )
    challenge = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
    )
    is_practice = models.BooleanField(
        blank=False,
        null=False,
        default=False,
    )
    question_type = models.CharField(
        choices=QuestionType,
        default=QuestionType.MULTIPLE_CHOICE,
    )
    timeout = models.PositiveIntegerField(blank=False, null=False, default=0)
    reminder = models.PositiveIntegerField(blank=False, null=False, default=0)
    reminder_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="reminder_testquestion",
    )

    def __str__(self) -> str:
        return f"{str(self.part)} / {self.pk}"

    def create_instruction_sequence(self, instructions_data):
        sequence, _ = InstructionSequence.objects.get_or_create(question=self)

        for order, data in enumerate(instructions_data):
            resource = None

            if data.get("resource") is None:
                resource = None
            else:
                resource, _ = TestResource.objects.get_or_create(
                    name=data["resource"], sound=data["resource"]
                )

            Instruction.objects.get_or_create(
                sequence=sequence,
                order=order,
                defaults={
                    "action": data["action"],
                    "element": data.get("element"),
                    "resource": resource,
                    "data": data.get("data"),
                    "delay_after": data.get("delayAfter", 0),
                },
            )


class InstructionSequence(models.Model):
    question = models.OneToOneField(
        TestQuestion,
        on_delete=models.CASCADE,
        related_name="instruction_sequence",
    )

    def to_json(self) -> dict:
        return {
            "instructions": [
                instr.to_json() for instr in self.instructions.order_by("order")
            ]
        }

    def __str__(self) -> str:
        return (
            f"{self.question.part.name}: sequence {self.pk} "
            f"(question {self.question_id})"
        )


class Instruction(models.Model):
    sequence = models.ForeignKey(
        InstructionSequence,
        on_delete=models.CASCADE,
        related_name="instructions",
    )

    order = models.PositiveSmallIntegerField(
        default=0,
        blank=False,
        null=False,
        db_index=True,
    )

    action = models.CharField(
        max_length=32,
        choices=InstructionAction.choices,
    )

    element = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text="DOM element id or logical name",
    )

    resource = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Used for playSound / show image",
    )

    data = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )

    delay_after = models.IntegerField(
        default=0,
        help_text="Delay in milliseconds after this instruction",
    )

    class Meta:
        ordering = ["order"]

        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        action=InstructionAction.PLAY_SOUND,
                        resource__isnull=False,
                    )
                    | ~models.Q(action=InstructionAction.PLAY_SOUND)
                ),
                name="play_sound_requires_resource",
            ),
        ]

    def to_json(self) -> dict:
        data = {
            "action": self.action,
            "delayAfter": self.delay_after,
        }

        if self.element:
            data["element"] = self.element

        if self.resource and self.resource.url:
            data["url"] = self.resource.url

        if self.data is not None:
            data["data"] = self.data

        return data

    def __str__(self) -> str:
        return f"{self.sequence} [{self.order}] {self.action}"


class PossibleAnswer(models.Model):
    question = models.ForeignKey(
        TestQuestion,
        on_delete=models.CASCADE,
        related_name="possible_answers",
    )
    resource = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=False,
        null=False,
    )
    is_correct = models.BooleanField(
        blank=False,
        null=False,
        default=False,
    )

    def __str__(self) -> str:
        return f"{str(self.question)} / {str(self.is_correct)}"


class TestResponse(models.Model):
    def clean(self):
        if self.assignment.student is not None:
            if self.student != self.assignment.student:
                raise ValidationError({"student": _("Student must match assignment.")})
        else:
            if self.student.klasse != self.assignment.klasse:
                raise ValidationError(
                    {
                        "student": _(
                            f"Student class (pk={self.student.klasse.pk}) must match"
                            + f" assignment class (pk={self.assignment.klasse.pk})."
                        )
                    }
                )

    assignment = models.ForeignKey(
        TestAssignment,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="responses",
        blank=False,
        null=False,
    )
    completed = models.BooleanField(
        blank=False,
        null=False,
        default=False,
    )
    cancelled = models.BooleanField(
        blank=False,
        null=False,
        default=False,
    )

    def __str__(self) -> str:
        return f"{str(self.assignment)} / {str(self.student)}"


class PartResponse(models.Model):
    testresponse = models.ForeignKey(
        TestResponse,
        on_delete=models.CASCADE,
        related_name="partresponses",
    )
    testpart = models.ForeignKey(
        TestPart,
        on_delete=models.CASCADE,
        related_name="partresponses",
    )
    finished_after = models.IntegerField(
        verbose_name=_("Completion time in milliseconds"),
        blank=True,
        null=True,
    )
    completed = models.BooleanField(
        blank=False,
        null=False,
        default=False,
    )

    def __str__(self) -> str:
        return f"{str(self.testresponse)} / {str(self.finished_after)}"


class QuestionResponse(models.Model):
    question = models.ForeignKey(
        TestQuestion,
        on_delete=models.CASCADE,
        related_name="questionresponse",
    )
    partresponse = models.ForeignKey(
        PartResponse,
        on_delete=models.CASCADE,
        related_name="questionresponses",
    )
    answer_option = models.ForeignKey(
        PossibleAnswer,
        verbose_name=_("Svar valgt af testdeltageren"),
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    answer_text = models.TextField(
        verbose_name=_("Svar indtastet af testdeltageren"),
        blank=True,
        null=True,
    )
    answer_sound = models.FileField(
        verbose_name=_("Svar indtalt af testdeltageren"),
        upload_to="answers",
        blank=True,
        null=True,
    )
    correct = models.BooleanField(
        blank=True,
        null=True,
    )
    submitted_at = models.DateTimeField(
        auto_now_add=True,
    )
    finished_after = models.IntegerField(
        verbose_name=_("Completion time in milliseconds"), blank=True, null=True
    )
    note = models.TextField(
        null=True,
        blank=True,
    )

    def __str__(self) -> str:
        return f"{str(self.question)} / {str(self.partresponse)}"


class HandledEvent(TextChoices):
    QUESTION_ANSWERED = "question.answered"
    QUESTION_FEEDBACK = "question.feedback"
    PART_COMPLETE = "part.complete"
    TEST_COMPLETE = "test.complete"
    TEST_CANCELLED = "test.cancelled"


class Message(models.Model):
    uuid = models.UUIDField(
        primary_key=True,
    )
    received = models.DateTimeField(auto_now_add=True)
    processed = models.DateTimeField(blank=True, null=True)
    event = models.CharField(max_length=32, choices=HandledEvent.choices)
    data = models.JSONField()
    error = models.TextField(blank=True, null=True)
    user = models.ForeignKey(
        User,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )

    @cached_property
    def student(self):
        # Obtain student from assignment
        assignment = self.assignment
        if assignment.student is not None:
            return assignment.student

        # Obtain student id from sending user (should work for group tests)
        try:
            return Student.objects.get(user_ptr=self.user)
        except Student.DoesNotExist:
            pass

        # The only way we get here is if the sender is a Teacher
        # (or other non-Student), and it is not an individual test room
        return None

    @cached_property
    def assignment(self):
        assignment_id = self.data.get("assignmentId")
        if assignment_id is None:
            raise MissingIdException(f"No assignmentId in message {self.uuid}")
        return TestAssignment.objects.get(pk=assignment_id)

    @cached_property
    def question(self):
        question_id = self.data.get("questionId")
        if question_id is None:
            raise MissingIdException(f"No questionId in message {self.uuid}")
        return TestQuestion.objects.get(pk=question_id, part=self.part.id)

    @cached_property
    def part(self):
        part_id = self.data.get("partId")
        if part_id is None:
            raise MissingIdException(f"No partId in message {self.uuid}")
        return TestPart.objects.get(pk=part_id)

    @cached_property
    def test_response(self):
        test_response, created = TestResponse.objects.get_or_create(
            assignment=self.assignment,
            student=self.student,
        )
        return test_response

    @cached_property
    def part_response(self):
        part_response, created = PartResponse.objects.get_or_create(
            testresponse=self.test_response,
            testpart=self.part,
        )
        return part_response

    @cached_property
    def question_response(self):
        try:
            return QuestionResponse.objects.get(
                question=self.question,
                partresponse=self.part_response,
            )
        except QuestionResponse.DoesNotExist:
            return QuestionResponse(
                question=self.question,
                partresponse=self.part_response,
            )

    def handle(self):  # pragma: no cover
        if self.processed is not None:
            return

        # Message is new, process it so that significant data is stored in other models
        try:
            if self.event == HandledEvent.QUESTION_ANSWERED:
                choiceId = self.data.get("choiceId")
                duration = self.data.get("duration")
                choice: PossibleAnswer | None = (
                    self.question.possible_answers.get(pk=choiceId)
                    if choiceId is not None
                    else None
                )
                question_response = self.question_response

                question_response.answer_option = choice
                question_response.answer_text = self.data.get("textAnswer")
                correct = choice.is_correct if choice else self.data.get("correct")
                if correct is not None:
                    question_response.correct = correct
                question_response.finished_after = duration

                sound_data = self.data.get("recordingBase64")
                if sound_data is not None:
                    parts = sound_data.split(";")
                    metadata = {}
                    for part in parts[:-1]:
                        key, value = re.split(r":|=", part, maxsplit=1)
                        key = key.strip()
                        value = value.strip('" ')
                        if key == "codecs":
                            value = [s.strip() for s in value.split(",")]
                        metadata[key] = value
                    filetype = metadata["data"].split("/")[-1]
                    format, data = parts[-1].split(",", maxsplit=1)
                    if format == "base64":
                        question_response.answer_sound.save(
                            f"answer.{filetype}",
                            # TODO: convert bytes to the correct audio format
                            ContentFile(b64decode(data)),
                        )
                    else:
                        raise Exception(f"Invalid sound metadata: {metadata}")

                try:
                    question_response.full_clean()
                except ValidationError as e:
                    self.error = str(e)
                    raise e
                question_response.save()

            elif self.event == HandledEvent.QUESTION_FEEDBACK:
                question_response = self.question_response
                question_response.correct = self.data.get("correct")
                question_response.note = self.data.get("note")
                question_response.save()

            elif self.event == HandledEvent.PART_COMPLETE:
                part = self.part_response
                part.completed = True
                part.finished_after = self.data.get("duration")
                part.save()

            elif self.event == HandledEvent.TEST_COMPLETE:
                test_response = self.test_response
                test_response.completed = True
                test_response.save()

            elif self.event == HandledEvent.TEST_CANCELLED:
                question_response = self.question_response
                question_response.note = self.data.get("note")
                question_response.save()
                test_response = self.test_response
                test_response.cancelled = True
                test_response.save()

        except Exception as e:
            self.processed = timezone.now()
            self.error = str(e)
            logger.error(e)
        finally:
            self.processed = timezone.now()
            self.save()
