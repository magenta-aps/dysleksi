# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import tempfile
from pathlib import Path

from django.contrib.auth.models import Group
from django.core.files.images import ImageFile
from django.test import TestCase, override_settings
from django.test.client import RequestFactory

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    Class,
    PossibleAnswer,
    QuestionType,
    Student,
    Teacher,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResource,
    TestResponse,
    TestType,
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
        cls.other_user, _ = User.objects.update_or_create(
            username="TestOtherUser",
            first_name="Test",
            last_name="OtherUser",
            is_superuser=False,
            is_staff=False,
        )
        cls.test, _ = Test.objects.get_or_create(
            name="Test1", test_type=TestType.INDIVIDUAL
        )
        cls.part, _ = TestPart.objects.get_or_create(
            name="TestPart1",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.test.parts.add(cls.part)
        cls.group_test, _ = Test.objects.get_or_create(
            name="Test2", test_type=TestType.GROUP
        )
        cls.group_test_part, _ = TestPart.objects.get_or_create(
            name="GroupTestPart1",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.group_test.parts.add(cls.group_test_part)
        cls.resource1, _ = TestResource.objects.get_or_create(
            name="TestResource1",
            text="TestOrd",
        )
        cls.resource2, _ = TestResource.objects.get_or_create(
            name="TestResource2",
            image=ImageFile(
                open("/app/dysleksi/tests/resources/test1.jpg", "rb"), name="test1.jpg"
            ),
        )
        cls.resource3 = TestResource.objects.create(
            name="TestResource3",
            text="TestOrd",
        )
        cls.resource4 = TestResource.objects.create(
            name="TestResource4",
            sound="foo.mp3",
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
        cls.question2 = TestQuestion.objects.create(
            part=cls.part,
            challenge=cls.resource2,
            question_type=QuestionType.MULTIPLE_CHOICE,
        )
        cls.question3 = TestQuestion.objects.create(
            part=cls.part,
            challenge=None,
            question_type=QuestionType.NO_INPUT_REQUIRED,
        )
        cls.question4 = TestQuestion.objects.create(
            part=cls.part,
            challenge=cls.resource4,
            question_type=QuestionType.FREE_TEXT,
        )

        cls.klasse, _ = Class.objects.get_or_create(start_year=2025, letter="A")
        cls.teacher.classes.add(cls.klasse)
        for student in ("elev1", "elev2"):
            cls.klasse.student_set.add(cls.create_student(student))

        cls.test_assignment_student, _ = TestAssignment.objects.get_or_create(
            test=cls.test,  # individual test
            teacher=cls.teacher,
            student=cls.student,
        )
        cls.test_assignment_class, _ = TestAssignment.objects.get_or_create(
            test=cls.group_test,
            teacher=cls.teacher,
            klasse=cls.klasse,
        )
        cls.test_response_class, _ = TestResponse.objects.get_or_create(
            assignment=cls.test_assignment_class,
            student=cls.klasse.student_set.first(),
        )

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Create a temporary MEDIA_ROOT for this test process
        cls._temp_media = tempfile.TemporaryDirectory()
        cls.override_media = override_settings(MEDIA_ROOT=cls._temp_media.name)
        cls.override_media.enable()

        # Create wordspelling_dummy folder
        cls.wordspelling_dummy_dir = Path(cls._temp_media.name) / "wordspelling_dummy"
        cls.wordspelling_dummy_dir.mkdir(parents=True, exist_ok=True)

        # Create dummy sound file
        cls.dummy_sound_path = cls.wordspelling_dummy_dir / "iki.mp3"
        cls.dummy_sound_path.write_bytes(b"FAKE MP3 DATA")  # dummy content

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.override_media.disable()
        cls._temp_media.cleanup()

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

    def setup_view(self, view_class, user: User, get: bool = True, **kwargs):
        request_factory = RequestFactory()
        request = request_factory.get("")
        request.user = user
        view = view_class()
        view.setup(request, **kwargs)
        if get:
            view.get(request, **kwargs)
        return view
