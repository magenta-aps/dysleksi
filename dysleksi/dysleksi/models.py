# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import logging
import mimetypes
import os
import re
from base64 import b64decode
from dataclasses import dataclass
from datetime import date
from functools import partial
from math import floor
from typing import Any, Dict, List, Self, Tuple

from django.conf import settings
from django.contrib.auth.models import AbstractUser, Group
from django.contrib.postgres.fields import DateTimeRangeField
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import (
    Case,
    Count,
    ExpressionWrapper,
    F,
    FloatField,
    IntegerField,
    Q,
    QuerySet,
    Sum,
    TextChoices,
    Value,
    When,
    Window,
)
from django.db.models.expressions import OuterRef, Subquery
from django.db.models.functions import Cast, Coalesce, NullIf, RowNumber
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


class Proxy:
    # Wraps an object and applies extra properties to the wrapper
    # The Proxy acts like the wrapped object,
    # but can have additional methods and attributes
    def __init__(self, wrapped, **kwargs):
        self.wrapped = wrapped
        # Set additional attributes and methods on the Proxy
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __getattr__(self, attr):
        # Called when trying to get an attribute on the proxy that wasn't found
        # (i.e. not in kwargs to the constructor)
        # Look in wrapped object
        return getattr(self.wrapped, attr)


class InstructionAction(TextChoices):
    SHOW = "show"
    HIDE = "hide"
    FADE_IN = "fadeIn"
    FADE_OUT = "fadeOut"
    SHOW_FADED = "showFaded"
    PLAY_SOUND = "playSound"
    HIGHLIGHT = "highlight"
    EXPLICIT_HIGHLIGHT = "explicitHighlight"
    SELECT = "select"
    SET_TEXT = "setText"
    SET_BUTTON_SOUND_ONCE = "setButtonSoundOnce"
    SET_REPEAT_BUTTON_DESTINATION = "setRepeatButtonDestination"
    CLICK_BUTTON = "clickButton"
    SET_MARKER = "setMarker"
    ADD_TEXT = "addText"
    REMOVE_TEXT = "removeText"


class Correctness(models.TextChoices):
    CORRECT = "correct"
    PARTIAL = "partial"
    WRONG = "wrong"
    SKIPPED = "skipped"


class QuestionType(TextChoices):
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_CHOICE_WITH_DISPLAY_FIELD = "multiple_choice_with_display_field"
    MULTIPLE_CHOICE_MATCH = "multiple_choice_match"
    FREE_TEXT = "free_text"
    NO_INPUT_REQUIRED = "no_input_required"


class TestType(TextChoices):
    INDIVIDUAL = "individual"
    GROUP = "group"


class TestAssignmentStatus(TextChoices):
    COMPLETED = "completed", _("Gennemført")
    IN_PROGRESS = "in_progress", _("I gang")
    PENDING = "pending", _("Afventer")


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

    uniid = models.CharField(
        null=True,
        blank=True,
        unique=True,
        verbose_name=_("UniLogin UniID"),
        max_length=100,
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


class PermissionsQuerySet(QuerySet):
    class Meta:
        abstract = True

    @property
    def model_name(self):
        raise NotImplementedError  # pragma: no cover

    def permission_name(self, action: str) -> str:
        return f"dysleksi.{action}_{self.model_name}".lower()

    def filter_user_permissions(self, user: User, action: str) -> QuerySet:
        if user.is_anonymous or not user.is_active:
            return self.none()
        if user.is_superuser:
            return self
        if user.has_perm(self.permission_name(action), None):
            logger.debug(
                "user %s has class-level permissions to class %s",
                user.username,
                self.model_name,
            )
            # User has permission for all instances through
            # the standard Django permission system
            return self

        qs1 = self.filter_user_object_permissions(user, action)
        if qs1 is not None:
            pks = [str(x) for x in qs1.values_list("pk", flat=True)]
            logger.debug(
                "user %s has object-level permissions to items [%s] of class %s",
                user.username,
                ",".join(pks),
                self.model_name,
            )
            # User has permission to these specific instances
            return qs1
        return self.none()

    def filter_user_object_permissions(self, user: User, action: str) -> QuerySet:
        # Override in subclasses as needed
        return self.none()  # pragma: no cover

    def get(self, *args, **kwargs):
        object = super().get(*args, **kwargs)
        return object


class PermissionsMixin:
    def has_permission(self, user: User, action: str) -> bool:
        if user.is_anonymous or not user.is_active:
            return False
        if user.is_superuser:
            return True
        manager: PermissionsQuerySet = (
            self.__class__.objects  # type: ignore[attr-defined]
        )
        model_name = self._meta.model_name  # type: ignore[attr-defined]
        if user.has_perm(manager.permission_name(action), None):
            # User has permission for all instances through
            # the standard Django permission system
            logger.debug(
                "user %s has class-level permissions to class %s",
                user.username,
                model_name,
            )
            return True
        if self.has_object_permission(user, action):
            # User has permission to this specific instance
            logger.debug(
                "user %s has object-level permissions to item %d of class %s",
                user.username,
                self.pk,  # type: ignore[attr-defined]
                model_name,
            )
            return True
        return False

    def has_object_permission(self, user: User, action: str) -> bool:
        # Use implementation in QuerySet
        # override in subclass if you need something else
        manager: PermissionsQuerySet = (
            self.__class__.objects  # type: ignore[attr-defined]
        )
        return (
            manager.filter(pk=self.pk)  # type: ignore[attr-defined]
            .filter_user_permissions(user, action)
            .exists()
        )


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


class ClassQuerySet(PermissionsQuerySet):

    def current(self):
        today = date.today()
        return self.filter(
            school_year_start=today.year if today.month >= 7 else today.year - 1
        )

    @property
    def model_name(self):
        return "Class"

    def filter_user_object_permissions(self, user: User, action: str):
        if user.is_teacher:
            return self.filter(
                institution=user.institution,  # type: ignore[attr-defined]
                teachers=user,
            )
        return self.none()


class Class(PermissionsMixin, models.Model):

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

    name = models.CharField(max_length=256, null=False, blank=False, default="")
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

    def to_json(self, assignment) -> dict:
        """
        Serialize the Test with its parts, questions, and possible answers.
        Returns a Python dict that can be converted to JSON with json.dumps().
        """

        def url_or_none(resource: TestResource | None) -> str | None:
            return resource.url if resource else None

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
                "completion_source": url_or_none(part.completion_source),
                "practice_correct_feedback_source": url_or_none(
                    part.practice_correct_feedback_source
                ),
                "practice_wrong_feedback_source": url_or_none(
                    part.practice_wrong_feedback_source
                ),
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
                            if hasattr(question, "instruction_sequence")
                            else None
                        ),
                        "reminder": question.reminder,
                        "reminderSource": str(
                            settings.REMINDER_FALLBACK  # type: ignore
                        ),
                        "timeout": question.timeout,
                        "continue_when_instruction_is_complete": (
                            question.continue_when_instruction_is_complete
                        ),
                        "advance_automatically": question.advance_automatically,
                        "result_group": question.result_group,
                    }
                    question_data["existing_answers"] = question.get_existing_answers(
                        assignment
                    )

                    if question.reminder_source:
                        question_data["reminderSource"] = question.reminder_source.url
                    if question.hint_source:
                        question_data["hintSource"] = question.hint_source.url
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
                            "index": answer.index,
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
                            "correctness": answer.correctness,
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


class TestAssignmentQuerySet(PermissionsQuerySet):

    @property
    def model_name(self):
        return "TestAssignment"

    def filter_user_object_permissions(self, user: User, action: str):
        if user.is_teacher:
            return self.filter(teacher=user)
        if user.is_student:
            return self.filter(Q(student=user) | Q(klasse__students=user))


class TestAssignment(PermissionsMixin, models.Model):
    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(student__isnull=False)
                | models.Q(klasse__isnull=False),
                name="student_or_class_must_be_set",
            )
        ]

    objects = TestAssignmentQuerySet.as_manager()

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

    def __str__(self) -> str:
        assignee = self.student or self.klasse
        return f"{self.test.name}/{str(self.teacher)} ({str(assignee)})"


class TestPartResultsBreakdownRange(models.Model):
    lower = models.IntegerField(
        null=True,
    )
    upper = models.IntegerField(
        null=True,
    )

    class Meta:
        ordering = [F("lower").asc(nulls_first=True), F("upper").asc(nulls_last=True)]

    @property
    def as_tuple(self) -> Tuple[int | None, int | None]:
        return self.lower, self.upper


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
    timeout = models.PositiveIntegerField(
        blank=False,
        null=False,
        help_text="Time to complete testpart, in milliseconds",
    )
    partial_score_after = models.PositiveIntegerField(
        blank=False,
        null=False,
        help_text="Student gets only partial score after this timeout, in milliseconds",
    )
    reminder = models.PositiveIntegerField(
        blank=False,
        null=False,
        default=0,
        help_text="Time after which to play reminder sound, in milliseconds",
    )
    reminder_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="reminder_testpart",
    )
    completion_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="completion_testpart",
    )
    practice_correct_feedback_source = models.ForeignKey(
        TestResource,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="practice_correct_feedback_testpart",
    )
    practice_wrong_feedback_source = models.ForeignKey(
        TestResource,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="practice_wrong_feedback_testpart",
    )

    show_normscore_speed_plot = models.BooleanField(default=False)
    show_answer_time_statistics = models.BooleanField(default=False)

    answer_time_data_breakdown = models.ManyToManyField(
        TestPartResultsBreakdownRange,
        related_name="answer_time_data_breakdown_parts",
    )
    wordlength_data_breakdown = models.ManyToManyField(
        TestPartResultsBreakdownRange,
        related_name="wordlength_data_breakdown_parts",
    )
    wordcount_data_breakdown = models.ManyToManyField(
        TestPartResultsBreakdownRange,
        related_name="wordcount_data_breakdown_parts",
    )

    def __str__(self) -> str:
        return self.name

    @cached_property
    def has_partially_correct_answers(self) -> bool:
        return PossibleAnswer.objects.filter(
            question__part=self,
            correctness=Correctness.PARTIAL,
        ).exists()

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
            if question_reminder_source is not None:
                question["reminder_source"], _ = TestResource.objects.get_or_create(
                    name=question_reminder_source, sound=question_reminder_source
                )
            question_hint_source = data.get("hint_source")
            if question_hint_source is not None:
                question["hint_source"], _ = TestResource.objects.get_or_create(
                    name=question_hint_source, sound=question_hint_source
                )
            if "timeout" in data and not is_practice:
                question["timeout"] = data["timeout"]
            else:
                question["timeout"] = 0
            if "continue_when_instruction_is_complete" in data:
                question["continue_when_instruction_is_complete"] = data[
                    "continue_when_instruction_is_complete"
                ]
            if "advance_automatically" in data:
                question["advance_automatically"] = data["advance_automatically"]
            if "result_group" in data:
                question["result_group"] = data["result_group"]

            question = TestQuestion.objects.create(**question)

            if "instruction_sequence" in data:
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
                    defaults={"correctness": Correctness.CORRECT},
                    index=data.get("correct_index"),
                )

            # Almost correct answer
            if data.get("partially_correct"):
                for answer in data["partially_correct"]:
                    partially_correct_resource, _ = TestResource.objects.get_or_create(
                        name=answer, text=answer
                    )
                    PossibleAnswer.objects.get_or_create(
                        question=question,
                        resource=partially_correct_resource,
                        defaults={"correctness": Correctness.PARTIAL},
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
                        defaults={"correctness": Correctness.WRONG},
                    )
            if data.get("set1") and data.get("set2"):
                for possible_answer in data["set1"] + data["set2"]:
                    resource, created = TestResource.objects.get_or_create(
                        text=possible_answer,
                        name=(
                            possible_answer
                            + "-"
                            + ("set1" if possible_answer in data["set1"] else "set2")
                        ),
                    )

                    if (
                        possible_answer in data["set1"]
                        and possible_answer == data["correct"][0]
                    ):
                        correctness = Correctness.CORRECT
                    elif (
                        possible_answer in data["set2"]
                        and possible_answer == data["correct"][1]
                    ):
                        correctness = Correctness.CORRECT
                    else:
                        correctness = Correctness.WRONG

                    PossibleAnswer.objects.get_or_create(
                        question=question,
                        resource=resource,
                        defaults={"correctness": correctness},
                    )

    def set_data_breakdown_ranges(self, field_name, ranges: List[Tuple[int, int]]):
        if field_name not in (
            "answer_time_data_breakdown",
            "wordlength_data_breakdown",
            "wordcount_data_breakdown",
        ):
            raise ValueError(f"Incorrect field_name '{field_name}'")
        field = getattr(self, field_name)
        breakdowns = []
        for range in ranges:
            breakdown, _ = TestPartResultsBreakdownRange.objects.get_or_create(
                lower=range[0],
                upper=range[1],
            )
            breakdowns.append(breakdown)
        field.set(breakdowns)

    @cached_property
    def answer_time_data_breakdown_ranges(self):
        return [r.as_tuple for r in self.answer_time_data_breakdown.all()]

    @cached_property
    def answer_wordlength_data_ranges(self):
        return [r.as_tuple for r in self.wordlength_data_breakdown.all()]

    @cached_property
    def answer_wordcount_data_ranges(self):
        return [r.as_tuple for r in self.wordcount_data_breakdown.all()]


class TestQuestionQuerySet(QuerySet):

    def result_groups_names(self) -> List[str | None]:
        return list(
            self.filter(result_group__isnull=False)
            .distinct("result_group")
            .values_list("result_group", flat=True)
        ) or [None]

    def result_groups_q(self) -> Dict[str | None, Q]:
        keys = self.result_groups_names()
        return {key: Q(result_group=key) if key else Q() for key in keys}

    def result_groups_map(self) -> "Dict[str|None, TestQuestionQuerySet]":
        return {key: self.filter(q) for key, q in self.result_groups_q().items()}


class TestQuestion(models.Model):

    objects = TestQuestionQuerySet.as_manager()

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
    timeout = models.PositiveIntegerField(
        blank=False,
        null=False,
        default=0,
        help_text="Time to answer question, in milliseconds",
    )
    reminder = models.PositiveIntegerField(
        blank=False,
        null=False,
        default=0,
        help_text="Time after which to play reminder sound, in milliseconds",
    )
    reminder_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="reminder_testquestion",
    )
    hint_source = models.ForeignKey(
        TestResource,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="hint_testquestion",
    )
    continue_when_instruction_is_complete = models.BooleanField(default=True)
    advance_automatically = models.BooleanField(default=False)
    result_group = models.CharField(
        blank=True,
        null=True,
    )

    @property
    def correct_answer(self) -> "PossibleAnswer|None":
        return self.possible_answers.filter(correctness=Correctness.CORRECT).first()

    def get_existing_answers(self, assignment):

        existing_answers = QuestionResponse.objects.filter(
            partresponse__testresponse__assignment=assignment,
            question=self,
        )

        existing = {}
        for answer in existing_answers:
            existing[answer.student.pk] = answer.to_json()
        return dict(existing)

    def __str__(self) -> str:
        return f"{str(self.part)} / {self.pk}"

    def create_instruction_sequence(self, instructions_data):
        sequence, _ = InstructionSequence.objects.get_or_create(question=self)

        for order, data in enumerate(instructions_data):
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

    correctness = models.CharField(
        max_length=8,
        choices=Correctness.choices,
        default=Correctness.WRONG,
        blank=False,
        null=False,
    )

    index = models.IntegerField(
        default=None,
        null=True,
        blank=True,
        help_text="index where this answer should be shown in mutiple-choice questions",
    )

    def __str__(self) -> str:
        return f"{self.question} / {self.get_correctness_display()}"

    @property
    def is_teacher_judged(self):
        return self.resource.text in ("true", "false")


class TestResponseQuerySet(PermissionsQuerySet):

    @property
    def model_name(self):
        return "Class"

    def filter_user_object_permissions(self, user: User, action: str):
        if user.is_teacher:
            return self.filter(assignment__teacher=user)
        return self.none()

    def annotate_correct_count(
        self, output_key: str, filter: Q | None = None
    ) -> "TestResponseQuerySet":
        if filter is None:
            filter = Q()
        correct = Correctness.CORRECT
        return self.annotate(
            **{
                output_key: Count(
                    "partresponses__questionresponses",
                    filter=filter
                    & Q(partresponses__questionresponses__correctness=correct),
                )
            }
        )

    def annotate_ordering(
        self, order_key: str, output_key: str, ascending: bool
    ) -> "TestResponseQuerySet":
        ordering = F(order_key)
        return self.annotate(
            **{
                output_key: Window(
                    expression=RowNumber(),
                    order_by=ordering.asc() if ascending else ordering.desc(),
                )
            }
        )

    def annotate_proportion(
        self, count_key: str, output_key: str, questions_count: int
    ) -> "TestResponseQuerySet":
        return self.annotate(
            **{
                output_key: ExpressionWrapper(
                    F(count_key)
                    / NullIf(Value(questions_count, output_field=FloatField()), 0.0),
                    output_field=FloatField(),
                )
            }
        )

    def annotate_score_category(
        self, proportion_key: str, output_key: str
    ) -> "TestResponseQuerySet":

        default_key = CorrectnessCategory.default().pk
        cases = []
        completed_filter = Q(completed=True)

        for category in CorrectnessCategory.non_default():
            if category.lower_proportion_limit == 0.0:
                lower_filter = Q(
                    **{f"{proportion_key}__gte": category.lower_proportion_limit}
                )
            else:
                lower_filter = Q(
                    **{f"{proportion_key}__gt": category.lower_proportion_limit}
                )
            upper_filter = Q(
                **{f"{proportion_key}__lte": category.upper_proportion_limit}
            )
            cases.append(
                When(
                    completed_filter & lower_filter & upper_filter,
                    then=Value(category.pk),
                )
            )

        return self.annotate(**{output_key: Case(*cases, default=Value(default_key))})


class TestResponse(PermissionsMixin, models.Model):

    objects = TestResponseQuerySet.as_manager()

    def clean(self):
        if self.assignment.student is not None:
            if self.student != self.assignment.student:
                raise ValidationError({"student": _("Student must match assignment.")})
        else:
            if self.assignment.klasse not in self.student.classes.all():
                class_pks = [c.pk for c in self.student.classes.all()]
                raise ValidationError(
                    {
                        "student": _(
                            f"Student classes (pk={class_pks}) must match"
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
    flagged = models.BooleanField(
        blank=True,
        null=False,
        default=False,
    )

    def __str__(self) -> str:
        return f"{str(self.assignment)} / {str(self.student)}"


class PartResponseQuerySet(PermissionsQuerySet):

    @property
    def model_name(self):
        return "PartResponse"

    def filter_user_object_permissions(self, user: User, action: str):
        if user.is_teacher:
            return self.filter(testresponse__assignment__teacher=user)
        return self.none()

    def annotate_questionresponses_count(
        self, output_key: str, filter: Q | None = None
    ) -> "PartResponseQuerySet":
        if filter is None:
            filter = Q()
        return self.annotate(
            **{
                output_key: Coalesce(
                    Subquery(
                        QuestionResponse.objects.filter(
                            partresponse=OuterRef("pk"),
                        )
                        .filter(filter)
                        .values("partresponse")
                        .annotate(count=Count("id"))
                        .values("count")
                    ),
                    0,
                )
            }
        )

    def annotate_questions_count(
        self, output_key: str, filter: Q | None = None
    ) -> "PartResponseQuerySet":
        if filter is None:
            filter = Q()
        return self.annotate(
            **{
                output_key: Coalesce(
                    Subquery(
                        TestQuestion.objects.filter(
                            part=OuterRef("testpart"),
                        )
                        .filter(filter)
                        .values("part")
                        .annotate(count=Count("id"))
                        .values("count")
                    ),
                    0,
                )
            }
        )

    def annotate_ordering(
        self, order_key: str, output_key: str, ascending: bool
    ) -> "PartResponseQuerySet":
        ordering = F(order_key)
        return self.annotate(
            **{
                output_key: Window(
                    expression=RowNumber(),
                    order_by=ordering.asc() if ascending else ordering.desc(),
                )
            }
        )

    def annotate_proportion(
        self, total_key: str, count_key: str, output_key: str
    ) -> "PartResponseQuerySet":
        return self.annotate(
            **{
                output_key: ExpressionWrapper(
                    Cast(count_key, output_field=FloatField())
                    / NullIf(F(total_key), 0),
                    output_field=FloatField(),
                )
            }
        )

    def annotate_percentage(self, proportion_key: str, output_key: str):
        return self.annotate(
            **{
                output_key: ExpressionWrapper(
                    F(proportion_key) * Value(100), output_field=IntegerField()
                )
            }
        )

    def annotate_score_category(
        self, proportion_key: str, output_key: str
    ) -> "PartResponseQuerySet":

        default_key = CorrectnessCategory.default().pk
        cases = []
        completed_filter = Q(completed=True)

        for category in CorrectnessCategory.non_default():
            if category.lower_proportion_limit == 0.0:
                lower_filter = Q(
                    **{f"{proportion_key}__gte": category.lower_proportion_limit}
                )
            else:
                lower_filter = Q(
                    **{f"{proportion_key}__gt": category.lower_proportion_limit}
                )
            upper_filter = Q(
                **{f"{proportion_key}__lte": category.upper_proportion_limit}
            )
            cases.append(
                When(
                    completed_filter & lower_filter & upper_filter,
                    then=Value(category.pk),
                )
            )

        return self.annotate(**{output_key: Case(*cases, default=Value(default_key))})

    def annotate_question_sum_answer_time(self, output_key, filter: Q | None = None):
        # output_key will be annotated with the sum of answer time in milliseconds
        if filter is None:
            filter = Q()
        return self.annotate(
            **{
                output_key: ExpressionWrapper(
                    Subquery(
                        QuestionResponse.objects.filter(
                            partresponse=OuterRef("pk"),
                        )
                        .filter(filter)
                        .values("partresponse")
                        .annotate(total_finished_after=Sum("finished_after"))
                        .values("total_finished_after")
                    ),
                    output_field=IntegerField(),
                )
            }
        )

    def annotate_question_average_answers_per_minute(
        self, count_key, time_key, output_key
    ):
        return self.annotate(
            **{
                output_key: ExpressionWrapper(
                    (Cast(count_key, output_field=FloatField()) / F(time_key))
                    * Value(60000),  # Convert milliseconds to minutes
                    output_field=FloatField(),
                )
            }
        )


class PartResponse(PermissionsMixin, models.Model):

    objects = PartResponseQuerySet.as_manager()

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
    started_at = models.DateTimeField(
        null=True,
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

    @property
    def correctness_category_answered(self):
        correct_responses_count = self.questionresponses.filter(
            correctness=Correctness.CORRECT
        ).count()
        responses_count = self.questionresponses.count()
        correct_proportion_of_answered = float(correct_responses_count) / float(
            responses_count
        )
        return CorrectnessCategory.categorize_proportion(correct_proportion_of_answered)


class QuestionResponseQuerySet(PermissionsQuerySet):

    @property
    def model_name(self):
        return "QuestionResponse"

    def filter_user_object_permissions(self, user: User, action: str):
        if user.is_teacher:
            return self.filter(partresponse__testresponse__assignment__teacher=user)
        return self.none()


class QuestionResponse(PermissionsMixin, models.Model):

    objects = QuestionResponseQuerySet.as_manager()

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
    correctness = models.CharField(
        max_length=8, choices=Correctness.choices, null=True, blank=True
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
    actual_pronunciation = models.TextField(
        null=True,
        blank=True,
    )

    def __str__(self) -> str:
        return f"{str(self.question)} / {str(self.partresponse)}"

    def to_json(self):
        return {"correctness": self.correctness}

    @property
    def student(self):
        return self.partresponse.testresponse.student


class HandledEvent(TextChoices):
    QUESTION_DISPLAYED = "question.displayed"
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
            if self.event == HandledEvent.QUESTION_DISPLAYED:
                part = self.part_response
                if part.started_at is None:
                    part.started_at = timezone.now()
                    part.save(update_fields=["started_at"])

            elif self.event == HandledEvent.QUESTION_ANSWERED:
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
                correctness = (
                    choice.correctness if choice else self.data.get("correctness")
                )
                if correctness is not None:
                    question_response.correctness = correctness
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
                question_response.correctness = self.data.get("correctness")
                question_response.note = self.data.get("note")
                question_response.actual_pronunciation = self.data.get(
                    "actualPronunciation"
                )
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


class CategoryColorChoice(TextChoices):
    GRAY = "gray"
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"


class Category(models.Model):
    class Meta:
        abstract = True
        ordering = ["upper_proportion_limit"]

    upper_proportion_limit = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        null=True,
    )
    color_key = models.CharField(
        choices=CategoryColorChoice.choices,
        max_length=6,
        editable=False,
        null=False,
        unique=True,
    )
    label_da = models.CharField(max_length=30, null=False, blank=False)

    @classmethod
    def with_proportion(cls):
        return cls.objects.filter(upper_proportion_limit__isnull=False)

    @property
    def lower_proportion_limit(self) -> float | None:
        lower = (
            self.with_proportion()
            .filter(upper_proportion_limit__lt=self.upper_proportion_limit)
            .order_by("-upper_proportion_limit")
            .first()
        )
        if lower is None:
            return 0.0
        return lower.upper_proportion_limit

    @property
    def width(self) -> float | None:
        upper = self.upper_proportion_limit
        lower = self.lower_proportion_limit
        if upper is None or lower is None:
            return None
        return upper - lower

    @property
    def width_pct(self) -> float | None:
        width = self.width
        return 100.0 * width if width is not None else None

    @classmethod
    def categorize_proportion(cls, proportion: float) -> Self:
        if proportion < 0 or proportion > 1:
            raise ValueError("proportion must be between 0 and 1")
        qs = cls.with_proportion()
        return (
            qs.filter(upper_proportion_limit__gte=proportion)
            .order_by("upper_proportion_limit")
            .first()
        )

    @classmethod
    def validate_categories(cls):
        qs = cls.with_proportion()
        upper = qs.order_by("-id").first()
        if upper.upper_proportion_limit != 1:
            raise ValidationError(
                f"Topmost {cls.__name__} must have upper_proportion_limit 1"
            )

    @classmethod
    def pk_map(cls, reverse: bool = False):
        qs = cls.with_proportion()
        if reverse:
            qs = qs.order_by("-upper_proportion_limit")
        return {category.pk: category for category in qs}


class CorrectnessCategory(Category):
    is_default = models.BooleanField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(upper_proportion_limit__isnull=False)
                | models.Q(color_key=CategoryColorChoice.GRAY),
                name="Only color_key: GRAY may have null upper limit",
            )
        ]

    @property
    def lower_proportion_limit(self) -> float | None:
        if self.is_default:
            return None
        return super().lower_proportion_limit

    @classmethod
    def categorize_proportion(cls, proportion: float | None) -> Self:
        if proportion is None:
            return CorrectnessCategory.default()
        else:
            return super().categorize_proportion(proportion)

    @classmethod
    def validate_categories(cls):
        if CorrectnessCategory.objects.filter(is_default=True).count() > 1:
            raise ValidationError(
                "More than one CorrectnessCategory with is_default=True"
            )
        if not CorrectnessCategory.objects.filter(is_default=True).exists():
            raise ValidationError("No CorrectnessCategory with is_default=True")
        super().validate_categories()

    @classmethod
    def default(cls):
        return CorrectnessCategory.objects.get(is_default=True)

    @classmethod
    def non_default(cls):
        return CorrectnessCategory.objects.filter(is_default=False)

    @staticmethod
    def partition_question_count(
        question_count: int,
    ) -> List["CategoryRange"]:
        if question_count <= 0:
            raise ValueError()
        lower: int | None = None
        partitions: List[CategoryRange] = []
        for category in CorrectnessCategory.non_default().order_by(
            "upper_proportion_limit"
        ):
            upper: int = floor(question_count * category.upper_proportion_limit)
            partitions.append(
                CategoryRange(
                    category=category,
                    lower_bound=0 if lower is None else lower + 1,
                    upper_bound=upper,
                )
            )
            lower = upper
        return partitions


@dataclass
class CategoryRange:
    category: Category
    lower_bound: int
    upper_bound: int


class ReadingSpeedCategory(Category):
    @classmethod
    def validate_categories(cls):
        pass

    def scaled(self, scale):
        return Proxy(
            self,
            scaled_width=partial(lambda scale: scale * self.width, scale),
        )

    @classmethod
    def pk_map(cls, reverse: bool = False, scale_max: float | None = None):
        if scale_max is None:
            return super().pk_map(reverse)
        qs = cls.with_proportion()
        if reverse:
            qs = qs.order_by("-upper_proportion_limit")
        items = list(qs)
        scale_max = max(scale_max, *[x.upper_proportion_limit for x in items])
        pk_map = {}
        first = True
        lower_scale = 1.0 / scale_max
        lower_size = sum([x.width for x in items[1:]])
        upper_scale = (1.0 - lower_scale * lower_size) / items[0].width

        for category in qs:  # pragma: no branch
            pk_map[category.pk] = category.scaled(upper_scale if first else lower_scale)
            first = False
        return pk_map
