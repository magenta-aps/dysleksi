# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import date

from django.core.management.base import BaseCommand

from dysleksi.models import Class, Teacher


class Command(BaseCommand):
    def handle(self, *args, **options):
        current_year = date.today().year
        teachers_count = Teacher.objects.count()
        for start_year in range(current_year, current_year - 7, -1):
            for letter in ("A", "B", "C"):
                c, _ = Class.objects.get_or_create(
                    start_year=start_year,
                    letter=letter,
                )
                print(f"Created class {c}")
                c.teachers.set(Teacher.objects.order_by("?")[0:teachers_count])
                print(f"  Added teachers: {[teacher for teacher in c.teachers.all()]}")
