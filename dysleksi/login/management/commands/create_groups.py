# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from dysleksi.models import READING_SUPERVISORS, STUDENTS, TEACHERS


class Command(BaseCommand):
    help = "Creates groups"

    def handle(self, *args, **options):
        # Med disse rettigheder på plads vil et forsøg på at køre en
        # REST-kommando, som man ikke har adgang til, resultere i en HTTP 403 fra API'et
        teacher_group, _ = Group.objects.update_or_create(
            name=TEACHERS,
        )
        student_group, _ = Group.objects.update_or_create(
            name=STUDENTS,
        )
        reading_supervisor_group, _ = Group.objects.update_or_create(
            name=READING_SUPERVISORS,
        )
