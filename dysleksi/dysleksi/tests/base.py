# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import Group
from django.core.files.images import ImageFile
from django.test import TestCase
from django.test.client import RequestFactory

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    Class,
    PossibleAnswer,
    Student,
    Teacher,
    Test,
    TestPart,
    TestQuestion,
    TestResource,
    User,
)


class DysleksiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        Group.objects.get_or_create(name=TEACHERS)
        Group.objects.get_or_create(name=STUDENTS)
        cls.klasse = cls.create_class(2025, "A")
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
        cls.test = Test.objects.create(name="Test1")
        cls.part = TestPart.objects.create(
            name="TestPart1", test=cls.test, timeout=60, partial_score_after=30
        )
        cls.resource1 = TestResource.objects.create(
            name="TestResource1",
            text="TestOrd",
        )
        cls.resource2 = TestResource.objects.create(
            name="TestResource2",
            image=ImageFile(
                open("/app/dysleksi/tests/resources/test1.jpg", "rb"), name="test1.jpg"
            ),
        )
        cls.resource3 = TestResource.objects.create(
            name="TestResource3",
            text="TestOrd",
        )

        cls.question1 = TestQuestion.objects.create(
            part=cls.part,
            challenge=cls.resource1,
        )

        cls.possible_correct_answer1 = PossibleAnswer.objects.create(
            question=cls.question1,
            resource=cls.resource2,
            is_correct=True,
        )
        cls.possible_wrong_answer1 = PossibleAnswer.objects.create(
            question=cls.question1,
            resource=cls.resource3,
            is_correct=False,
        )

    @classmethod
    def create_class(cls, start_year: int, letter: str) -> Class:
        klasse, _ = Class.objects.get_or_create(
            start_year=start_year,
            letter=letter,
        )
        return klasse

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
