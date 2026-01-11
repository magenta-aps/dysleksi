# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import Group
from django.test import TestCase
from django.test.client import RequestFactory

from dysleksi.models import STUDENTS, TEACHERS, Class, Student, Teacher, User


class DysleksiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        Group.objects.get_or_create(name=TEACHERS)
        Group.objects.get_or_create(name=STUDENTS)
        cls.klasse, _ = Class.objects.get_or_create(start_year=2025, letter="A")
        cls.student = cls.create_student(
            "TestStudent",
            cpr=1234567890,
            first_name="Test",
            last_name="Elev",
            klasse=cls.klasse,
        )
        cls.teacher = cls.create_teacher(
            "TestTeacher",
            cpr=2233445566,
            school="TestSchool",
            first_name="Test",
            last_name="Lærer",
        )
        cls.admin, _ = User.objects.update_or_create(
            username="TestAdmin",
            first_name="Test",
            last_name="Admin",
            is_superuser=True,
        )

    @classmethod
    def create_teacher(cls, username: str, **kwargs) -> Teacher:
        teacher, _ = Teacher.objects.update_or_create(
            username=username,
            defaults=kwargs,
        )
        return teacher

    @classmethod
    def create_student(cls, username: str, **kwargs) -> Student:
        student, _ = Student.objects.update_or_create(
            username=username,
            defaults=kwargs,
        )
        return student

    def setup_view(self, view_class, user: User):
        request_factory = RequestFactory()
        request = request_factory.get("")
        request.user = user
        view = view_class()
        view.setup(request)
        return view
