# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import date
from typing import List

from django.contrib.auth.models import AbstractUser, Group
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import CheckConstraint
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

# Do not change these values;
# they are present in the database as Group names, and rows are searched for by these
TEACHERS = "Lærere"
STUDENTS = "Elever"


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
        return f"{self.first_name} {self.last_name} ({self.user_type})"


class Student(User):
    klasse = models.ForeignKey(
        "Class",
        on_delete=models.SET_NULL,
        null=True,
    )

    is_student = True
    is_teacher = False


@receiver(post_save, sender=Student)
def on_update_student(sender, instance: Student, created: bool, **kwargs):
    if created:  # pragma: no branch
        instance.groups.add(Group.objects.get(name=STUDENTS))


class Teacher(User):
    school = models.CharField(max_length=255, blank=True)

    is_student = False
    is_teacher = True


@receiver(post_save, sender=Teacher)
def on_update_teacher(sender, instance: Teacher, created: bool, **kwargs):
    if created:  # pragma: no branch
        instance.groups.add(Group.objects.get(name=TEACHERS))


class Class(models.Model):
    start_year = models.PositiveSmallIntegerField(
        null=False,
        blank=False,
    )
    letter = models.CharField(
        max_length=1,
        null=True,
        blank=True,
    )
    teachers = models.ManyToManyField(
        Teacher,
    )

    @property
    def number(self) -> int:
        # Klassetrin beregnet udfra start_year
        # Så en klasse der begynder i sommeren år X
        # vil have nummer 1 indtil sommeren år X+1, nummer 2 indtil X+2 osv.
        today = date.today()
        years = today.year - self.start_year
        if today.month >= 7:  # Skæringspunkt mellem juni og juli
            years += 1
        return years

    def __str__(self) -> str:
        return f"{self.number}.{self.letter}"


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


class Test(models.Model):
    name = models.CharField(max_length=255)


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


class TestPart(models.Model):
    test = models.ForeignKey(
        Test,
        on_delete=models.CASCADE,
        related_name="parts",
        null=False,
    )
    name = models.CharField(max_length=255)
    instructions = models.FileField(upload_to="instructions", blank=True, null=True)
    intro = models.TextField(blank=True, null=True)
    timeout = models.PositiveSmallIntegerField(blank=False, null=False)
    partial_score_after = models.PositiveSmallIntegerField(blank=False, null=False)


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
        blank=False,
        null=False,
    )


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


class TestResponse(models.Model):

    def clean(self):
        if self.assignment.student is not None:
            if self.student != self.assignment.student:
                raise ValidationError({"student": _("Student must match assignment.")})
        else:
            if self.student.klasse != self.assignment.klasse:
                raise ValidationError(
                    {"student": _("Student class must match assignment class.")}
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


class PartResponse(models.Model):
    testresponse = models.ForeignKey(
        TestResponse,
        on_delete=models.CASCADE,
        related_name="partresponses",
    )
    finished_after = models.PositiveSmallIntegerField(
        blank=False,
        null=False,
    )


class QuestionResponse(models.Model):

    class Meta:
        constraints = [
            CheckConstraint(
                check=models.Q(answer_option__isnull=False)
                | models.Q(answer_text__isnull=False)
                | models.Q(answer_sound__isnull=False),
                name="answer_must_be_set",
            )
        ]

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

    correct = models.BooleanField(blank=False, null=False)
    submitted_at = models.DateTimeField(auto_now_add=True)
    finished_after = models.PositiveSmallIntegerField(blank=False, null=False)
