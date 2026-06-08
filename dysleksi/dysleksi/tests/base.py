# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import tempfile
from datetime import datetime
from pathlib import Path

from django.contrib.auth.models import AnonymousUser, Group, Permission
from django.core.files.images import ImageFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.test.client import RequestFactory
from django.utils import timezone

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    CategoryColorChoice,
    Class,
    Correctness,
    Institution,
    PartResponse,
    PossibleAnswer,
    QuestionResponse,
    QuestionType,
    ReadingSpeedCategory,
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
        cls.klasse = cls.create_class(2025, "1.A", is_main=True)
        cls.student1 = cls.create_student(
            "TestStudent1", cpr=1234567890, first_name="Test1", last_name="Elev"
        )
        cls.student2 = cls.create_student(
            "TestStudent2", cpr=1234567891, first_name="Test2", last_name="Elev"
        )
        cls.klasse.students.add(cls.student1)
        cls.klasse.students.add(cls.student2)
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
        cls.other_teacher = cls.create_teacher(
            "Vikar",
            cpr=1133557799,
            first_name="Vikar",
            last_name="Vikarsen",
        )
        cls.inactive_user = cls.create_teacher(
            "Intruder",
            cpr=6666666666,
            first_name="Intruder",
            last_name="Impostorsson",
            is_active=False,
        )
        cls.not_logged_in_user = AnonymousUser()
        cls.privileged_user = cls.create_teacher("Skoleinspektør", cpr="0000000000")
        for permission in Permission.objects.all():
            cls.privileged_user.user_permissions.add(permission)

        cls.individual_test, _ = Test.objects.get_or_create(
            name="Test1", test_type=TestType.INDIVIDUAL
        )
        cls.group_test, _ = Test.objects.get_or_create(
            name="Test2", test_type=TestType.GROUP
        )

        cls.teacher.classes.add(cls.klasse)

        cls.test_assignment_student, _ = TestAssignment.objects.get_or_create(
            test=cls.individual_test,
            teacher=cls.teacher,
            student=cls.student1,
        )
        cls.test_assignment_class, _ = TestAssignment.objects.get_or_create(
            test=cls.group_test,
            teacher=cls.teacher,
            klasse=cls.klasse,
        )

    @classmethod
    def create_resources(cls):
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
        cls.resource3, _ = TestResource.objects.get_or_create(
            name="TestResource3",
            text="TestOrd",
        )
        cls.resource4, _ = TestResource.objects.get_or_create(
            name="TestResource4",
            sound="foo.mp3",
        )

    @classmethod
    def create_parts(cls):
        cls.create_resources()
        cls.part, _ = TestPart.objects.get_or_create(
            name="TestPart1",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.individual_test.parts.add(cls.part)
        cls.group_test_part, _ = TestPart.objects.get_or_create(
            name="GroupTestPart1",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.group_test_part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(3, 4), (5, 6), (7, 8), (9, 11), (12, 15)]
        )
        cls.group_test.parts.add(cls.group_test_part)

        cls.question1 = TestQuestion.objects.create(
            part=cls.part,
            challenge=cls.resource1,
            reminder=5000,
            reminder_source=cls.resource4,
            hint_source=cls.resource4,
        )

        cls.possible_correct_answer1 = PossibleAnswer.objects.create(
            question=cls.question1,
            resource=cls.resource2,
            correctness=Correctness.CORRECT,
        )
        cls.possible_wrong_answer1 = PossibleAnswer.objects.create(
            question=cls.question1,
            resource=cls.resource3,
            correctness=Correctness.WRONG,
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

    @classmethod
    def create_wordspelling_part(cls, individual: bool = False):
        cls.create_resources()
        cls.wordspelling_part, _ = TestPart.objects.get_or_create(
            name="WordSpelling",
            timeout=60000,
            partial_score_after=30000,
        )
        test = cls.individual_test if individual else cls.group_test
        test.parts.add(cls.wordspelling_part)

        cls.wordspelling_question_1 = TestQuestion.objects.create(
            part=cls.wordspelling_part,
            challenge=cls.resource1,
            question_type=QuestionType.FREE_TEXT,
            result_group="Nemme ord",
        )
        cls.wordspelling_option_1_1 = PossibleAnswer.objects.create(
            question=cls.wordspelling_question_1,
            resource=cls.resource3,
            correctness=Correctness.CORRECT,
        )
        cls.wordspelling_option_1_2 = PossibleAnswer.objects.create(
            question=cls.wordspelling_question_1,
            resource=cls.resource4,
            correctness=Correctness.PARTIAL,
        )
        cls.wordspelling_question_2 = TestQuestion.objects.create(
            part=cls.wordspelling_part,
            challenge=cls.resource2,
            question_type=QuestionType.FREE_TEXT,
            result_group="Lette ord",
        )
        cls.wordspelling_option_2_1 = PossibleAnswer.objects.create(
            question=cls.wordspelling_question_2,
            resource=cls.resource3,
            correctness=Correctness.CORRECT,
        )
        cls.wordspelling_option_2_2 = PossibleAnswer.objects.create(
            question=cls.wordspelling_question_2,
            resource=cls.resource4,
            correctness=Correctness.PARTIAL,
        )

    @classmethod
    def create_sentencereading_part(cls, individual: bool = False):
        cls.create_resources()
        # TODO: Move other test creations into methods like this,
        # and let individual Test classes decide what to initialize
        cls.sentencereading_part, _ = TestPart.objects.get_or_create(
            name="SentenceReading",
            timeout=60000,
            partial_score_after=30000,
        )
        test = cls.individual_test if individual else cls.group_test
        test.parts.add(cls.sentencereading_part)

        cls.sentencereading_question = TestQuestion.objects.create(
            part=cls.sentencereading_part,
            challenge=cls.resource1,
            reminder=5000,
            reminder_source=cls.resource4,
            hint_source=cls.resource4,
        )
        cls.sentencereading_resource_1 = TestResource.objects.create(
            name="TestResource5a",
            text="true",
        )
        cls.sentencereading_option_1 = PossibleAnswer.objects.create(
            question=cls.sentencereading_question,
            resource=cls.sentencereading_resource_1,
            correctness=Correctness.CORRECT,
        )
        cls.sentencereading_resource_2 = TestResource.objects.create(
            name="TestResource5b",
            text="false",
        )
        cls.sentencereading_option_2 = PossibleAnswer.objects.create(
            question=cls.sentencereading_question,
            resource=cls.sentencereading_resource_2,
            correctness=Correctness.WRONG,
        )

    @classmethod
    def create_wordreading_part(cls, individual: bool = False):
        cls.create_resources()
        # TODO: Move other test creations into methods like this,
        # and let individual Test classes decide what to initialize
        cls.wordreading_part, _ = TestPart.objects.get_or_create(
            name="wordreading",
            timeout=60000,
            partial_score_after=30000,
            show_normscore_speed_plot=True,
        )
        test = cls.individual_test if individual else cls.group_test
        test.parts.add(cls.wordreading_part)

        cls.wordreading_question = TestQuestion.objects.create(
            part=cls.wordreading_part,
            challenge=cls.resource1,
            reminder=5000,
            reminder_source=cls.resource4,
            hint_source=cls.resource4,
        )
        cls.wordreading_resource_1 = TestResource.objects.create(
            name="TestResource6a",
            text="true",
        )
        cls.wordreading_option_1 = PossibleAnswer.objects.create(
            question=cls.wordreading_question,
            resource=cls.wordreading_resource_1,
            correctness=Correctness.CORRECT,
        )
        cls.wordreading_resource_2 = TestResource.objects.create(
            name="TestResource6b",
            text="false",
        )
        cls.wordreading_option_2 = PossibleAnswer.objects.create(
            question=cls.wordreading_question,
            resource=cls.wordreading_resource_2,
            correctness=Correctness.WRONG,
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
    def create_class(cls, school_year_start: int, name: str, **kwargs) -> Class:
        klasse, _ = Class.objects.get_or_create(
            institution=cls.school,
            school_year_start=school_year_start,
            name=name,
            group_id=name,
            **kwargs,
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

    @classmethod
    def create_readingspeed_categories(cls):
        ReadingSpeedCategory.objects.get_or_create(
            id=1,
            defaults={
                "color_key": CategoryColorChoice.RED,
                "upper_proportion_limit": 1,
                "label_da": "Meget lavt",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=2,
            defaults={
                "color_key": CategoryColorChoice.YELLOW,
                "upper_proportion_limit": 3.5,
                "label_da": "Lavt",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=3,
            defaults={
                "color_key": CategoryColorChoice.GREEN,
                "upper_proportion_limit": 7.5,
                "label_da": "Middel",
            },
        )
        ReadingSpeedCategory.objects.get_or_create(
            id=4,
            defaults={
                "color_key": CategoryColorChoice.BLUE,
                "upper_proportion_limit": 10,
                "label_da": "Højt",
            },
        )


class ResponseTest(DysleksiTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        call_command("create_result_categories")

        students = cls.klasse.students.all().order_by("pk")
        cls.student1 = students[0]
        cls.student2 = students[1]

        cls.test_response_student, _ = TestResponse.objects.get_or_create(
            assignment=cls.test_assignment_student,
            student=cls.klasse.students.first(),
        )
        cls.test_response_class_1, _ = TestResponse.objects.get_or_create(
            assignment=cls.test_assignment_class,
            student=cls.student1,
            completed=True,
        )
        cls.test_response_class_2, _ = TestResponse.objects.get_or_create(
            assignment=cls.test_assignment_class,
            student=cls.student2,
            completed=True,
        )

    @classmethod
    def create_parts(cls):
        super().create_parts()
        tz = timezone.get_current_timezone()
        cls.group_question_1 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=cls.resource1,
            reminder=5000,
            reminder_source=cls.resource4,
        )
        possible_correct_answer1 = PossibleAnswer.objects.create(
            question=cls.group_question_1,
            resource=cls.resource2,
            correctness=Correctness.CORRECT,
        )
        PossibleAnswer.objects.create(
            question=cls.group_question_1,
            resource=cls.resource3,
            correctness=Correctness.WRONG,
        )
        cls.group_question_2 = TestQuestion.objects.create(
            part=cls.group_test_part,
            challenge=cls.resource2,
            question_type=QuestionType.MULTIPLE_CHOICE,
        )
        PossibleAnswer.objects.create(
            question=cls.group_question_2,
            resource=cls.resource3,
            correctness=Correctness.CORRECT,
        )
        PossibleAnswer.objects.create(
            question=cls.group_question_2,
            resource=cls.resource4,
            correctness=Correctness.WRONG,
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

        cls.group_partresponse_1 = PartResponse.objects.create(
            testresponse=cls.test_response_class_1,
            testpart=cls.group_test_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=tz),
        )
        cls.group_partresponse_2 = PartResponse.objects.create(
            testresponse=cls.test_response_class_2,
            testpart=cls.group_test_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 14, 0, 0, tzinfo=tz),
        )

        cls.group_questionresponse_1_1 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_1,
            answer_option=possible_correct_answer1,
            correctness=Correctness.CORRECT,
            finished_after=3000,
        )
        cls.group_questionresponse_1_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 10, tzinfo=tz
        )
        cls.group_questionresponse_1_1.save()

        cls.group_questionresponse_1_2 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_2,
            correctness=Correctness.CORRECT,
            finished_after=4000,
        )
        cls.group_questionresponse_1_2.submitted_at = datetime(
            2026, 5, 1, 12, 0, 15, tzinfo=tz
        )
        cls.group_questionresponse_1_2.save()

        cls.group_questionresponse_1_3 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_3,
            correctness=Correctness.CORRECT,
            finished_after=5000,
        )
        cls.group_questionresponse_1_3.submitted_at = datetime(
            2026, 5, 1, 12, 0, 25, tzinfo=tz
        )
        cls.group_questionresponse_1_3.save()

        cls.group_questionresponse_1_4 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_1,
            question=cls.group_question_4,
            correctness=Correctness.CORRECT,
            finished_after=6000,
        )
        cls.group_questionresponse_1_4.submitted_at = datetime(
            2026, 5, 1, 12, 0, 40, tzinfo=tz
        )
        cls.group_questionresponse_1_4.save()

        cls.group_questionresponse_2_1 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_1,
            answer_option=possible_correct_answer1,
            correctness=Correctness.CORRECT,
            finished_after=5000,
        )
        cls.group_questionresponse_2_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 12, tzinfo=tz
        )
        cls.group_questionresponse_2_1.save()

        cls.group_questionresponse_2_2 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_2,
            correctness=Correctness.WRONG,
            finished_after=4000,
        )
        cls.group_questionresponse_2_2.submitted_at = datetime(
            2026, 5, 1, 12, 0, 25, tzinfo=tz
        )
        cls.group_questionresponse_2_2.save()

        cls.group_questionresponse_2_3 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_3,
            correctness=Correctness.WRONG,
            finished_after=3000,
        )
        cls.group_questionresponse_2_3.submitted_at = datetime(
            2026, 5, 1, 12, 0, 40, tzinfo=tz
        )
        cls.group_questionresponse_2_3.save()

        cls.group_questionresponse_2_4 = QuestionResponse.objects.create(
            partresponse=cls.group_partresponse_2,
            question=cls.group_question_4,
            correctness=Correctness.WRONG,
            finished_after=4000,
        )
        cls.group_questionresponse_2_4.submitted_at = datetime(
            2026, 5, 1, 12, 0, 55, tzinfo=tz
        )
        cls.group_questionresponse_2_4.save()

    @classmethod
    def create_wordspelling_part(cls, individual: bool = False):
        super().create_wordspelling_part(individual)
        tz = timezone.get_current_timezone()
        testresponse = (
            cls.test_response_student if individual else cls.test_response_class_1
        )

        cls.wordspelling_partresponse = PartResponse.objects.create(
            testresponse=testresponse,
            testpart=cls.wordspelling_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=tz),
        )
        cls.wordspelling_questionresponse_1_1 = QuestionResponse.objects.create(
            partresponse=cls.wordspelling_partresponse,
            question=cls.wordspelling_question_1,
            answer_option=cls.wordspelling_option_1_1,
            correctness=Correctness.CORRECT,
        )
        cls.wordspelling_questionresponse_2_1 = QuestionResponse.objects.create(
            partresponse=cls.wordspelling_partresponse,
            question=cls.wordspelling_question_2,
            answer_option=cls.wordspelling_option_2_2,
            correctness=Correctness.PARTIAL,
            finished_after=5000,
        )
        cls.wordspelling_questionresponse_1_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 10, tzinfo=tz
        )
        cls.wordspelling_questionresponse_1_1.save()

    @classmethod
    def create_sentencereading_part(cls, individual: bool = False):
        super().create_sentencereading_part(individual)
        tz = timezone.get_current_timezone()
        testresponse = (
            cls.test_response_student if individual else cls.test_response_class_1
        )

        cls.sentencereading_partresponse_1 = PartResponse.objects.create(
            testresponse=testresponse,
            testpart=cls.sentencereading_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=tz),
        )
        cls.sentencereading_questionresponse_1 = QuestionResponse.objects.create(
            partresponse=cls.sentencereading_partresponse_1,
            question=cls.sentencereading_question,
            correctness=Correctness.CORRECT,
            answer_option=cls.sentencereading_option_1,
            finished_after=5000,
        )
        cls.sentencereading_questionresponse_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 40, tzinfo=tz
        )
        cls.sentencereading_questionresponse_1.save()

    @classmethod
    def create_wordreading_part(cls, individual: bool = False):
        super().create_wordreading_part(individual)
        tz = timezone.get_current_timezone()
        testresponse = (
            cls.test_response_student if individual else cls.test_response_class_1
        )

        cls.wordreading_partresponse_1 = PartResponse.objects.create(
            testresponse=testresponse,
            testpart=cls.wordreading_part,
            completed=True,
            started_at=datetime(2026, 5, 1, 12, 0, 0, tzinfo=tz),
        )
        cls.wordreading_questionresponse_1 = QuestionResponse.objects.create(
            partresponse=cls.wordreading_partresponse_1,
            question=cls.wordreading_question,
            answer_option=cls.wordreading_option_1,
            correctness=Correctness.CORRECT,
            finished_after=5000,
        )
        cls.wordreading_questionresponse_1.submitted_at = datetime(
            2026, 5, 1, 12, 0, 10, tzinfo=tz
        )
        cls.wordreading_questionresponse_1.save()
