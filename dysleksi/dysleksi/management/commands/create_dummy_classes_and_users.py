# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import date

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from dysleksi.models import Class, Student, Teacher


class Command(BaseCommand):
    def handle(self, *args, **options):

        teacher_group = Group.objects.get(name="Lærere")
        student_group = Group.objects.get(name="Elever")

        # Create teacher who is in idp
        teacher, _ = Teacher.objects.update_or_create(
            username="0222222222",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Lærer",
                "last_name": "Lærersen",
                "cpr": "0222222222",
            },
        )
        teacher.set_password("lærer")
        teacher.groups.add(teacher_group)

        # Create student who is in idp
        student, _ = Student.objects.update_or_create(
            username="0111111111",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev",
                "last_name": "Elevsen",
                "cpr": "0111111111",
            },
        )
        student.set_password("elev")
        student.groups.add(student_group)

        # Create dummy student
        student2, _ = Student.objects.update_or_create(
            username="0111111112",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev2",
                "last_name": "Elevsen",
                "cpr": "0111111112",
            },
        )
        student2.set_password("elev2")
        student2.groups.add(student_group)

        # Create classes
        current_year = date.today().year
        for start_year in range(current_year, current_year - 7, -1):
            for letter in ("A", "B", "C"):
                c, _ = Class.objects.get_or_create(
                    start_year=start_year,
                    letter=letter,
                )
                c.teachers.set([teacher])

        # Add students to classes
        student.klasse = Class.objects.get(start_year=current_year - 2, letter="A")
        student.save()

        student2.klasse = Class.objects.get(start_year=current_year, letter="B")
        student2.save()
