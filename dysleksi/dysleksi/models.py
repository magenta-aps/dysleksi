# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import TextChoices
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class UserType(TextChoices):
    Teacher = "TEACHER", _("Lærer")
    Student = "STUDENT", _("Elev")


class User(AbstractUser):
    history = HistoricalRecords()

    cpr = models.BigIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(101000000), MaxValueValidator(3112999999)],
        db_index=True,
        verbose_name=_("CPR"),
    )

    cvr = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(10000000), MaxValueValidator(99999999)],
        db_index=True,
        verbose_name=_("CVR"),
    )

    def __str__(self):
        return f"{self.username} ({self.user_type})"

    @cached_property
    def user_type(self) -> UserType:
        if self.cvr is None:
            return UserType.Student
        return UserType.Teacher
