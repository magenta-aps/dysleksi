# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import date
from typing import List

from django.contrib.auth.models import AbstractUser, Group
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
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
