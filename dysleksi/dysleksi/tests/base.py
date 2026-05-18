# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import tempfile
from datetime import datetime
from pathlib import Path

from django.contrib.auth.models import Group
from django.core.files.images import ImageFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.test.client import RequestFactory
from django.utils import timezone

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    Class,
    Institution,
    PartResponse,
    PossibleAnswer,
    QuestionResponse,
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
        cls.school = cls.create_school(number="test123", name="TestSkolen")
        cls.klasse = cls.create_class(2025, "1.A")
        cls.student = cls.create_student(
            "TestStudent", cpr=1234567890, first_name="Test", last_name="Elev"
        )
        cls.klasse.students.add(cls.student)
        cls.teacher = cls.create_teacher(
            "TestTeacher",
            cpr=2233445566,
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
        cls.group_test_part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(3, 4), (5, 6), (7, 8), (9, 11), (12, 15)]
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
            reminder=5000,
            reminder_source=cls.resource4,
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

        cls.teacher.classes.add(cls.klasse)
        for student in ("elev1", "elev2"):
            cls.klasse.students.add(cls.create_student(student))

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
            student=cls.klasse.students.first(),
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
    def create_school(cls, number: str, name: str):
        school, _ = Institution.objects.get_or_create(number=number, name=name)
        return school

    @classmethod
    def create_class(cls, school_year_start: int, name: str) -> Class:
        klasse, _ = Class.objects.get_or_create(
            institution=cls.school,
            school_year_start=school_year_start,
            name=name,
            group_id=name,
        )
        return klasse

    @classmethod
    def create_teacher(cls, username: str, **kwargs) -> Teacher:
        teacher, _ = Teacher.objects.update_or_create(
            institution=cls.school,
            username=username,
            defaults=kwargs,
        )
        return teacher

    @classmethod
    def create_student(cls, username: str, **kwargs) -> Student:
        student, _ = Student.objects.update_or_create(
            institution=cls.school,
            username=username,
            defaults=kwargs,
        )
        return student

    def setup_view(
        self,
        view_class,
        user: User,
        get: bool = True,
        query_params: dict | None = None,
        **kwargs
    ):
        request_factory = RequestFactory()
        request = request_factory.get("", query_params=query_params)
        request.user = user
        view = view_class()
        view.setup(request, **kwargs)
        if get:
            view.response = view.get(request, **kwargs)
        return view

    @staticmethod
    def html_table_to_list(soup_element):
        return [
            [
                list(filter(lambda x: x, [item.strip() for item in cell.strings]))
                for cell in row.find_all(["td", "th"])
            ]
            for row in soup_element.find_all("tr")
        ]


class ResponseTest(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        call_command("create_result_categories")

        students = cls.klasse.students.all().order_by("pk")
        student1 = students[0]
        student2 = students[1]

        cls.group_question_1 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=cls.resource1,
            reminder=5000,
            reminder_source=cls.resource4,
        )
        cls.possible_correct_answer1 = PossibleAnswer.objects.create(
            question=cls.group_question_1,
            resource=cls.resource2,
            is_correct=True,
        )
        cls.possible_wrong_answer1 = PossibleAnswer.objects.create(
            question=cls.group_question_1,
            resource=cls.resource3,
            is_correct=False,
        )
        cls.group_question_2 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=cls.resource2,
            question_type=QuestionType.MULTIPLE_CHOICE,
        )
        cls.possible_correct_answer2 = PossibleAnswer.objects.create(
            question=cls.group_question_2,
            resource=cls.resource3,
            is_correct=True,
        )
        cls.possible_wrong_answer2 = PossibleAnswer.objects.create(
            question=cls.group_question_2,
            resource=cls.resource4,
            is_correct=False,
        )
        cls.group_question_3 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=None,
            question_type=QuestionType.NO_INPUT_REQUIRED,
        )
        cls.group_question_4 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=cls.resource4,
            question_type=QuestionType.FREE_TEXT,
        )

        cls.group_testresponse_1 = TestResponse.objects.create(
            assignment=cls.test_assignment_class, student=student1, completed=True
        )
        cls.group_testresponse_2 = TestResponse.objects.create(
            assignment=cls.test_assignment_class, student=student2, completed=True
        )

        tz = timezone.get_current_timezone()
        cls.group_partresponse_1 = PartResponse.objects.create(
            testresponse=cls.group_testresponse_1,
            testpart=cls.group_test_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=tz),
        )
        cls.group_partresponse_2 = PartResponse.objects.create(
            testresponse=cls.group_testresponse_2,
            testpart=cls.group_test_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 14, 0, 0, tzinfo=tz),
        )

        cls.group_questionresponse_1_1 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_1,
            answer_option=cls.possible_correct_answer1,
            correct=True,
        )
        cls.group_questionresponse_1_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 10, tzinfo=tz
        )
        cls.group_questionresponse_1_1.save()

        cls.group_questionresponse_1_2 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_2,
            correct=True,
        )
        cls.group_questionresponse_1_2.submitted_at = datetime(
            2026, 5, 1, 12, 0, 15, tzinfo=tz
        )
        cls.group_questionresponse_1_2.save()

        cls.group_questionresponse_1_3 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_3,
            correct=True,
        )
        cls.group_questionresponse_1_3.submitted_at = datetime(
            2026, 5, 1, 12, 0, 25, tzinfo=tz
        )
        cls.group_questionresponse_1_3.save()

        cls.group_questionresponse_1_4 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_4,
            correct=True,
        )
        cls.group_questionresponse_1_4.submitted_at = datetime(
            2026, 5, 1, 12, 0, 40, tzinfo=tz
        )
        cls.group_questionresponse_1_4.save()

        cls.group_questionresponse_2_1 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_1,
            answer_option=cls.possible_correct_answer1,
            correct=True,
        )
        cls.group_questionresponse_2_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 12, tzinfo=tz
        )
        cls.group_questionresponse_2_1.save()

        cls.group_questionresponse_2_2 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_2,
            correct=False,
        )
        cls.group_questionresponse_2_2.submitted_at = datetime(
            2026, 5, 1, 12, 0, 25, tzinfo=tz
        )
        cls.group_questionresponse_2_2.save()

        cls.group_questionresponse_2_3 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_3,
            correct=False,
        )
        cls.group_questionresponse_2_3.submitted_at = datetime(
            2026, 5, 1, 12, 0, 40, tzinfo=tz
        )
        cls.group_questionresponse_2_3.save()

        cls.group_questionresponse_2_4 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_4,
            correct=False,
        )
        cls.group_questionresponse_2_4.submitted_at = datetime(
            2026, 5, 1, 12, 0, 55, tzinfo=tz
        )
        cls.group_questionresponse_2_4.save()
