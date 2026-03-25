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
        teacher, created = Teacher.objects.update_or_create(
            username="0222222222",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Lærer",
                "last_name": "Lærersen",
                "cpr": "0222222222",
            },
        )
        if created:
            teacher.set_password("lærer")
            teacher.groups.add(teacher_group)
            teacher.save()

        # Create teacher who is not in idp (for easy-access on an ipad)
        teacher2, created = Teacher.objects.update_or_create(
            username="lærer",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Lærer",
                "last_name": "Lærersen",
                "cpr": "0222222223",
            },
        )
        if created:
            teacher2.set_password("lærer")
            teacher2.groups.add(teacher_group)
            teacher2.save()

        # Create student who is in idp
        student, created = Student.objects.update_or_create(
            username="0111111111",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev",
                "last_name": "Elevsen",
                "cpr": "0111111111",
            },
        )
        if created:
            student.set_password("elev")
            student.groups.add(student_group)

        # Create dummy student
        student2, created = Student.objects.update_or_create(
            username="0111111112",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev2",
                "last_name": "Elevsen",
                "cpr": "0111111112",
            },
        )
        if created:
            student2.set_password("elev2")
            student2.groups.add(student_group)

        # Create student who is not in idp (for easy-access on an ipad)
        student3, created = Student.objects.update_or_create(
            username="elev",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Steve",
                "last_name": "Jobs",
                "cpr": "0111111113",
            },
        )
        if created:
            student3.set_password("elev")
            student3.groups.add(student_group)

        school_year_start = (
            date.today().year if date.today().month < 7 else date.today().year - 1
        )
        for classnumber in range(0, 7):
            for letter in ("A", "B", "C"):
                c, _ = Class.objects.get_or_create(
                    school_year_start=school_year_start,
                    name=f"{classnumber}.{letter}",
                )
                c.teachers.set([teacher, teacher2])

        # Add students to classes
        student.klasse = Class.objects.get(
            school_year_start=school_year_start, name="2.A"
        )
        student.save()

        student2.klasse = Class.objects.get(
            school_year_start=school_year_start, name="0.B"
        )
        student2.save()

        student3.klasse = Class.objects.get(
            school_year_start=school_year_start, name="0.C"
        )
        student3.save()
