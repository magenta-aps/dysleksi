# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import date

from django.core.management.base import BaseCommand

from dysleksi.models import Class, Institution, ReadingSupervisor, Student, Teacher


class Command(BaseCommand):
    def handle(self, *args, **options):

        school, _ = Institution.objects.get_or_create(name="TestSkolen", number="1234")

        # Create teacher who is in idp
        teacher, created = Teacher.objects.update_or_create(
            username="0222222222",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Lærer",
                "last_name": "Lærersen",
                "cpr": "0222222222",
                "institution": school,
                "uniid": "0222222222",
            },
        )
        if created:
            teacher.set_password("lærer")
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
                "institution": school,
                "uniid": "0222222223",
            },
        )
        if created:
            teacher2.set_password("lærer")
            teacher2.save()

        # Create teacher who is also an admin (to access Django admin *and* teacher UI)
        teacher3, created = Teacher.objects.update_or_create(
            username="admin",
            defaults={
                "is_staff": True,
                "is_superuser": True,
                "first_name": "Admin",
                "last_name": "Adminsen",
                "cpr": "0222222224",
                "institution": school,
                "uniid": "0222222224",
            },
        )
        if created:
            teacher3.set_password("admin")
            teacher3.save()

        # Create læsevejleder, who can see all classes at the school
        reading_supervisor, created = ReadingSupervisor.objects.update_or_create(
            username="læsevejleder",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Læsevejleder",
                "last_name": "Vejledersen",
                "cpr": "0222222225",
                "uniid": "0222222225",
            },
        )
        if created:
            reading_supervisor.set_password("læsevejleder")
            reading_supervisor.save()
        reading_supervisor.institutions.add(school)

        # Create student who is in idp
        student, created = Student.objects.update_or_create(
            username="0111111111",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev",
                "last_name": "Elevsen",
                "cpr": "0111111111",
                "institution": school,
                "uniid": "1a2b3c4d5e",
            },
        )
        if created:
            student.set_password("elev")

        # Create dummy student
        student2, created = Student.objects.update_or_create(
            username="0111111112",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Elev2",
                "last_name": "Elevsen",
                "cpr": "0111111112",
                "institution": school,
                "uniid": "1a3b5c7d9e",
            },
        )
        if created:
            student2.set_password("elev2")

        # Create student who is not in idp (for easy-access on an ipad)
        student3, created = Student.objects.update_or_create(
            username="elev",
            defaults={
                "is_staff": False,
                "is_superuser": False,
                "first_name": "Steve",
                "last_name": "Jobs",
                "cpr": "0111111113",
                "institution": school,
            },
        )
        if created:
            student3.set_password("elev")
            student3.save()

        # create some more students for group-test-testing
        group_test_students = []
        for student_id in range(5):

            group_test_student, created = Student.objects.update_or_create(
                username=f"elev{student_id}",
                defaults={
                    "is_staff": False,
                    "is_superuser": False,
                    "first_name": f"Dummy{student_id}",
                    "last_name": f"Student{student_id}",
                    "cpr": f"011111112{student_id}",
                    "institution": school,
                },
            )
            if created:
                group_test_student.set_password(f"elev{student_id}")
                group_test_student.save()
            group_test_students.append(group_test_student)

        school_year_start = (
            date.today().year if date.today().month < 7 else date.today().year - 1
        )
        for classnumber in range(0, 7):
            for letter in ("A", "B", "C"):
                c, _ = Class.objects.get_or_create(
                    group_id=f"{classnumber}_{letter}_"
                    f"{school.name}_{school_year_start}",
                    defaults={
                        "school_year_start": school_year_start,
                        "name": f"{classnumber}.{letter}",
                        "is_main": True,
                        "institution": school,
                    },
                )
                c.teachers.set([teacher, teacher3])

        # Add students to classes

        secondary_class, _ = Class.objects.get_or_create(
            group_id=f"Dansk_1_{school.name}_{school_year_start}",
            school_year_start=school_year_start,
            name="Dansk 1",
            is_main=False,
            institution=school,
        )
        secondary_class.teachers.set([teacher, teacher2, teacher3])

        klasse = Class.objects.get(school_year_start=school_year_start, name="2.A")
        klasse.students.add(student)

        klasse = Class.objects.get(school_year_start=school_year_start, name="0.B")
        klasse.students.add(student2)

        klasse = Class.objects.get(school_year_start=school_year_start, name="0.C")
        klasse.students.add(student3)
        secondary_class.students.add(student3)

        for group_test_student in group_test_students:
            klasse.students.add(group_test_student)
            secondary_class.students.add(group_test_student)
