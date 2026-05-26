# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import base64
import os
from datetime import datetime
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError
from django.db.models import Q
from django.db.models.fields.files import FieldFile
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    CategoryColorChoice,
    CategoryRange,
    Class,
    Correctness,
    CorrectnessCategory,
    Instruction,
    InstructionAction,
    InstructionSequence,
    Message,
    PartResponse,
    PlannedDateTime,
    PossibleAnswer,
    QuestionResponse,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResource,
    TestResponse,
    User,
)
from dysleksi.tests.base import DysleksiTest, ResponseTest


class TestUser(DysleksiTest):
    def test_str(self):
        unknown_user = User(
            username="UnknownUser", first_name="Unknown", last_name="User"
        )
        cases: list[tuple[User, str]] = [
            (self.admin, f"Test Admin (type=Administrator, pk={self.admin.pk})"),
            (self.student, f"Test Elev (type=Elev, pk={self.student.pk})"),
            (self.teacher, f"Test Lærer (type=Lærer, pk={self.teacher.pk})"),
            (
                self.other_user,
                f"Test OtherUser (type=Ukendt brugertype, pk={self.other_user.pk})",
            ),
            (unknown_user, "Unknown User (type=Ukendt brugertype, pk=None)"),
        ]
        for user, expected_str in cases:
            with self.subTest(user=user, expected_str=expected_str):
                self.assertEqual(str(user), expected_str)

    def test_group(self):
        cases: list[tuple[User, str]] = [
            (self.student, STUDENTS),
            (self.teacher, TEACHERS),
        ]
        for user, expected_groupname in cases:
            with self.subTest(user=user, expected_str=expected_groupname):
                self.assertTrue(user.has_group(expected_groupname))


class TestClass(DysleksiTest):
    def test_str(self):
        self.assertEqual(str(self.klasse), "1.A")

    def test_school_year(self):
        self.assertEqual(self.klasse.school_year_start, 2025)
        self.assertEqual(self.klasse.school_year_end, 2026)

    def test_current(self):
        with freeze_time("2025-12-01 00:00:00Z"):
            self.assertIn(self.klasse, Class.objects.all().current())
        with freeze_time("2026-06-01 00:00:00Z"):
            self.assertIn(self.klasse, Class.objects.all().current())
        with freeze_time("2026-12-01 00:00:00Z"):
            self.assertNotIn(self.klasse, Class.objects.all().current())

    def test_access(self):
        for user in (self.admin, self.privileged_user):
            self.assertQuerySetEqual(
                Class.objects.filter_user_permissions(user, "view"),
                Class.objects.all(),
                msg=user.username,
            )
        for user in (
            self.inactive_user,
            self.not_logged_in_user,
            self.other_teacher,
            self.student,
        ):
            self.assertQuerySetEqual(
                Class.objects.filter_user_permissions(user, "view"),
                Class.objects.none(),
                msg=user.username,
            )
        self.assertQuerySetEqual(
            Class.objects.filter_user_permissions(self.teacher, "view"),
            Class.objects.filter(pk=self.klasse.pk),
        )


class TestPartResponse(ResponseTest):
    def test_str(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            student=self.student,
        )
        response = TestResponse(
            assignment=assignment,
            student=self.student,
        )
        pr = PartResponse(testresponse=response)
        pr.finished_after = "World"
        self.assertEqual(str(pr), f"{str(pr.testresponse)} / {str(pr.finished_after)}")

    def test_correctness_category_answered(self):
        self.assertEqual(
            self.group_partresponse_1.correctness_category_answered,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE),
        )
        self.assertEqual(
            self.group_partresponse_2.correctness_category_answered,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.YELLOW),
        )

    def test_access(self):
        for user in (self.admin, self.privileged_user):
            self.assertQuerySetEqual(
                PartResponse.objects.filter_user_permissions(user, "view").order_by(
                    "pk"
                ),
                PartResponse.objects.all().order_by("pk"),
                msg=user.username,
            )
        for user in (
            self.inactive_user,
            self.not_logged_in_user,
            self.other_teacher,
            self.student,
        ):
            self.assertQuerySetEqual(
                PartResponse.objects.filter_user_permissions(user, "view"),
                PartResponse.objects.none(),
                msg=user.username,
            )
        self.assertQuerySetEqual(
            PartResponse.objects.filter_user_permissions(self.teacher, "view").order_by(
                "pk"
            ),
            PartResponse.objects.filter(
                pk__in=(self.group_partresponse_1.pk, self.group_partresponse_2.pk)
            ).order_by("pk"),
        )


class TestQuestionResponse(ResponseTest):
    def test_str(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            student=self.student,
        )
        response = TestResponse(
            assignment=assignment,
            student=self.student,
        )
        pr = PartResponse(testresponse=response)
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        qr = QuestionResponse(partresponse=pr, question=question)
        qr.finished_after = "World"
        self.assertEqual(str(qr), f"{str(qr.question)} / {str(qr.partresponse)}")

    def test_access(self):
        for user in (self.admin, self.privileged_user):
            self.assertQuerySetEqual(
                QuestionResponse.objects.filter_user_permissions(user, "view").order_by(
                    "pk"
                ),
                QuestionResponse.objects.all().order_by("pk"),
                msg=user.username,
            )
        for user in (
            self.inactive_user,
            self.not_logged_in_user,
            self.other_teacher,
            self.student,
        ):
            self.assertQuerySetEqual(
                QuestionResponse.objects.filter_user_permissions(user, "view"),
                QuestionResponse.objects.none(),
                msg=user.username,
            )
        self.assertQuerySetEqual(
            QuestionResponse.objects.filter_user_permissions(
                self.teacher, "view"
            ).order_by("pk"),
            QuestionResponse.objects.filter(
                pk__in=(
                    self.group_questionresponse_1_1.pk,
                    self.group_questionresponse_1_2.pk,
                    self.group_questionresponse_1_3.pk,
                    self.group_questionresponse_1_4.pk,
                    self.group_questionresponse_2_1.pk,
                    self.group_questionresponse_2_2.pk,
                    self.group_questionresponse_2_3.pk,
                    self.group_questionresponse_2_4.pk,
                )
            ).order_by("pk"),
        )


class TestTestPart(DysleksiTest):
    def test_str(self):
        test_part = TestPart(name="Test")
        self.assertEqual(str(test_part), "Test")

    def test_breakdown_ranges(self):
        test_part = TestPart.objects.create(
            name="Test", timeout=30000, partial_score_after=15000
        )
        with self.assertRaises(ValueError):
            test_part.set_data_breakdown_ranges("foobar", [(1 - 2)])
        test_part.set_data_breakdown_ranges(
            "answer_time_data_breakdown", [(None, 5), (5, None)]
        )
        self.assertTrue(
            test_part.answer_time_data_breakdown.filter(
                lower__isnull=True, upper=5
            ).exists()
        )
        self.assertTrue(
            test_part.answer_time_data_breakdown.filter(
                lower=5, upper__isnull=True
            ).exists()
        )
        test_part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(1, 5), (6, None)]
        )
        self.assertTrue(
            test_part.wordlength_data_breakdown.filter(lower=1, upper=5).exists()
        )
        self.assertTrue(
            test_part.wordlength_data_breakdown.filter(
                lower=6, upper__isnull=True
            ).exists()
        )


class TestPlannedDateTime(DysleksiTest):
    def test_str(self):
        tz = timezone.get_current_timezone()
        planned_date_time = PlannedDateTime.objects.create(
            period=(
                datetime(2020, 1, 1, 12, 0, tzinfo=tz),
                datetime(2020, 1, 1, 13, 0, tzinfo=tz),
            )
        )
        planned_date_time.refresh_from_db()
        self.assertEqual(
            str(planned_date_time),
            "[2020-01-01 16:00:00+01:00, 2020-01-01 17:00:00+01:00)",
        )


class TestTestAssignment(ResponseTest):
    def test_str(self):
        test = Test.objects.create(name="Test")
        ta = TestAssignment(test=test, teacher=self.teacher, student=self.student)
        self.assertTrue(
            str(ta) == f"{ta.test.name}/{str(ta.teacher)} ({str(ta.student)})"
        )

    def test_validation(self):
        test = Test.objects.create(name="Test")
        with self.assertRaises(IntegrityError) as cm:
            TestAssignment.objects.create(
                test=test,
                teacher=self.teacher,
            )
        exception = cm.exception
        self.assertTrue(
            str(exception).startswith(
                'new row for relation "dysleksi_testassignment" violates '
                'check constraint "student_or_class_must_be_set"'
            )
        )

    def test_access(self):
        for user in (self.admin, self.privileged_user):
            self.assertQuerySetEqual(
                PartResponse.objects.filter_user_permissions(user, "view").order_by(
                    "pk"
                ),
                PartResponse.objects.all().order_by("pk"),
                msg=user.username,
            )
        for user in (
            self.inactive_user,
            self.not_logged_in_user,
            self.other_teacher,
            self.student,
        ):
            self.assertQuerySetEqual(
                PartResponse.objects.filter_user_permissions(user, "view"),
                PartResponse.objects.none(),
                msg=user.username,
            )
        self.assertQuerySetEqual(
            PartResponse.objects.filter_user_permissions(self.teacher, "view").order_by(
                "pk"
            ),
            PartResponse.objects.filter(
                pk__in=(self.group_partresponse_1.pk, self.group_partresponse_2.pk)
            ).order_by("pk"),
        )


class TestTestResponse(ResponseTest):
    def test_str(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            student=self.student,
        )
        response = TestResponse(
            assignment=assignment,
            student=self.student,
        )
        self.assertEqual(
            str(response), f"{str(response.assignment)} / {str(self.student)}"
        )

    def test_validation_1(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            student=self.student,
        )
        student2 = self.create_student("TestStudent2")

        with self.assertRaises(ValidationError) as cm:
            response = TestResponse(
                assignment=assignment,
                student=student2,
            )
            response.full_clean()
        exception: ValidationError = cm.exception

        self.assertEqual(
            dict(exception), {"student": ["Student must match assignment."]}
        )

    def test_validation_2(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            klasse=self.klasse,
        )
        klasse2 = self.create_class(2025, "1.B")
        student2 = self.create_student("TestStudent2")
        klasse2.students.add(student2)

        with self.assertRaises(ValidationError) as cm:
            response = TestResponse(
                assignment=assignment,
                student=student2,
            )
            response.full_clean()
        exception: ValidationError = cm.exception

        self.assertEqual(
            dict(exception),
            {
                "student": [
                    f"Student classes (pk=[{klasse2.pk}]) must match "
                    f"assignment class (pk={self.klasse.pk})."
                ]
            },
        )

    def test_validation_3(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            student=self.student,
        )

        response = TestResponse(
            assignment=assignment,
            student=self.student,
        )
        response.full_clean()

    def test_validation_4(self):
        test = Test.objects.create(name="Test")
        assignment = TestAssignment.objects.create(
            test=test,
            teacher=self.teacher,
            klasse=self.klasse,
        )

        response = TestResponse(
            assignment=assignment,
            student=self.student,
        )
        response.full_clean()

    def test_access(self):
        for user in (self.admin, self.privileged_user):
            self.assertQuerySetEqual(
                TestResponse.objects.filter_user_permissions(user, "view").order_by(
                    "pk"
                ),
                TestResponse.objects.all().order_by("pk"),
                msg=user.username,
            )
        for user in (
            self.inactive_user,
            self.not_logged_in_user,
            self.other_teacher,
            self.student,
        ):
            self.assertQuerySetEqual(
                TestResponse.objects.filter_user_permissions(user, "view"),
                TestResponse.objects.none(),
                msg=user.username,
            )
        self.assertQuerySetEqual(
            TestResponse.objects.filter_user_permissions(self.teacher, "view").order_by(
                "pk"
            ),
            TestResponse.objects.filter(assignment__teacher=self.teacher).order_by(
                "pk"
            ),
        )


class TestTestResource(DysleksiTest):
    def test_str(self):
        test_resource = TestResource(name="StrTest")
        self.assertTrue(str(test_resource)) == "StrTest"

    def test_constraints(self):
        with self.assertRaises(IntegrityError) as cm:
            TestResource.objects.create(name="TestResource")
        exception = cm.exception
        self.assertTrue(
            str(exception).startswith(
                'new row for relation "dysleksi_testresource" violates '
                'check constraint "image_or_sound_or_text_must_be_set"'
            )
        )


class TestTestQuestion(DysleksiTest):
    def test_str(self):
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        quest_str = f"{str(question.part)} / {question.pk}"
        self.assertEqual(quest_str, str(question))

    def test_create(self):
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        test = question.part.tests.first()
        self.assertEqual(question.part, self.part)
        self.assertEqual(question.challenge, self.resource1)
        self.assertEqual(test.name, "Test1")
        answer1 = PossibleAnswer.objects.create(
            question=question, resource=self.resource2, correctness=Correctness.CORRECT
        )
        self.assertEqual(answer1.question, question)
        self.assertEqual(answer1.resource.name, "TestResource2")


class TestPossibleAnswer(DysleksiTest):
    def test_str(self):
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        pa = PossibleAnswer.objects.create(
            question=question, resource=self.resource2, correctness=Correctness.CORRECT
        )
        self.assertEqual(str(pa), f"{str(pa.question)} / Correct")


class TestTest(DysleksiTest):
    def test_str(self):
        test = Test(name="StrTest")
        self.assertTrue(str(test) == "StrTest")

    def test_to_json(self):
        json = self.test.to_json()

        # Test basic Test -> parts
        self.assertEqual(self.test.parts.count(), 1)
        self.assertEqual(len(json["parts"]), self.test.parts.count())

        part_model = self.test.parts.all().order_by("id")[0]
        part_json = json["parts"][0]

        self.assertEqual(part_model.name, "TestPart1")
        self.assertEqual(part_json["name"], part_model.name)
        self.assertEqual(part_model.timeout, part_json["timeout"])
        self.assertEqual(
            part_model.partial_score_after, part_json["partial_score_after"]
        )
        self.assertEqual(
            part_model.instructions.url if part_model.instructions else None,
            part_json["instructions_url"],
        )

        # Test questions
        self.assertEqual(part_model.questions.count(), 4)
        self.assertEqual(len(part_json["questions"]), part_model.questions.count())

        question_model = part_model.questions.all().order_by("id")[0]
        question_json = part_json["questions"][0]

        self.assertEqual(question_model.challenge.name, question_json["challenge_name"])
        self.assertEqual(
            question_model.reminder_source.url, question_json["reminderSource"]
        )
        self.assertEqual(question_model.hint_source.url, question_json["hintSource"])
        self.assertEqual(
            (
                question_model.challenge.image.url
                if question_model.challenge.image
                else None
            ),
            question_json["challenge_image_url"],
        )
        self.assertEqual(
            (
                question_model.challenge.sound.url
                if question_model.challenge.sound
                else None
            ),
            question_json["challenge_sound_url"],
        )
        self.assertEqual(question_model.challenge.text, question_json["challenge_text"])

        # Test possible answers
        self.assertEqual(question_model.possible_answers.count(), 2)
        self.assertEqual(
            len(question_json["possible_answers"]),
            question_model.possible_answers.count(),
        )

        for ans_model, ans_json in zip(
            question_model.possible_answers.all().order_by("id"),
            question_json["possible_answers"],
        ):
            self.assertEqual(ans_model.resource.name, ans_json["resource_name"])
            self.assertEqual(
                ans_model.resource.image.url if ans_model.resource.image else None,
                ans_json["resource_image_url"],
            )
            self.assertEqual(
                ans_model.resource.sound.url if ans_model.resource.sound else None,
                ans_json["resource_sound_url"],
            )
            self.assertEqual(ans_model.resource.text, ans_json["resource_text"])
            self.assertEqual(ans_model.correctness, ans_json["correctness"])

        question2 = part_json["questions"][1]
        self.assertEqual(question2.get("possible_answers"), [])
        self.assertEqual(question2.get("challenge_name"), self.resource2.name)
        self.assertEqual(question2.get("challenge_image_url"), self.resource2.image.url)
        self.assertIsNone(question2.get("challenge_text"))
        self.assertIsNone(question2.get("challenge_sound_url"))

        question3 = part_json["questions"][2]
        self.assertIsNone(question3.get("challenge_id"))
        self.assertIsNone(question3.get("challenge_name"))
        self.assertIsNone(question3.get("challenge_text"))
        self.assertIsNone(question3.get("challenge_image_url"))
        self.assertIsNone(question3.get("challenge_sound_url"))
        self.assertEqual(question3.get("possible_answers"), [])

        question4 = part_json["questions"][3]
        self.assertEqual(question4.get("possible_answers"), [])
        self.assertEqual(question4.get("challenge_name"), self.resource4.name)
        self.assertEqual(question4.get("challenge_sound_url"), self.resource4.sound.url)
        self.assertIsNone(question4.get("challenge_text"))
        self.assertIsNone(question4.get("challenge_image_url"))


class TestMessage(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.individual_assignment = TestAssignment.objects.create(
            test=cls.test,
            teacher=cls.teacher,
            student=cls.student,
        )
        cls.group_assignment = TestAssignment.objects.create(
            test=cls.group_test,
            teacher=cls.teacher,
            klasse=cls.klasse,
        )

    def test_question_answer(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="question.answered",
            data={
                "assignmentId": self.individual_assignment.pk,
                "partId": self.part.pk,
                "questionId": self.question1.pk,
                "choiceId": self.possible_correct_answer1.pk,
                "duration": 10000,
            },
            user=self.student,
        )
        message.handle()
        testresponse = TestResponse.objects.filter(
            assignment__pk=self.individual_assignment.pk,
            student__pk=self.student.pk,
        ).first()
        self.assertIsNotNone(testresponse)

        partresponse = PartResponse.objects.filter(
            testresponse=testresponse,
            testpart=self.part,
        ).first()
        self.assertIsNotNone(partresponse)

        questionresponse = QuestionResponse.objects.filter(
            partresponse=partresponse,
            question__pk=self.question1.pk,
        ).first()
        self.assertIsNotNone(questionresponse)

        self.assertEqual(questionresponse.answer_option, self.possible_correct_answer1)
        self.assertTrue(questionresponse.correctness == Correctness.CORRECT)

    def test_question_answer_with_sound(self):
        with open(
            os.path.join(settings.MEDIA_ROOT, "wordspelling_dummy", "iki.mp3"), "rb"
        ) as file:
            sounddata: bytes = file.read()
            sound_base64 = base64.b64encode(sounddata).decode("utf-8")
        message = Message.objects.create(
            uuid=uuid4(),
            event="question.answered",
            data={
                "assignmentId": self.individual_assignment.pk,
                "partId": self.part.pk,
                "questionId": self.question1.pk,
                "choiceId": self.possible_correct_answer1.pk,
                "duration": 10000,
                "recordingBase64": (
                    f'data:audio/mp3; codecs="mpeg, mp4a.40.2";base64,{sound_base64}'
                ),
            },
            user=self.student,
        )
        message.handle()
        testresponse = TestResponse.objects.filter(
            assignment__pk=self.individual_assignment.pk,
            student__pk=self.student.pk,
        ).first()
        self.assertIsNotNone(testresponse)

        partresponse = PartResponse.objects.filter(
            testresponse=testresponse,
            testpart=self.part,
        ).first()
        self.assertIsNotNone(partresponse)

        questionresponse = QuestionResponse.objects.filter(
            partresponse__testresponse__assignment__pk=self.individual_assignment.pk,
            partresponse__testresponse__student__pk=self.student.pk,
            partresponse__testpart=self.part,
            question__pk=self.question1.pk,
        ).first()
        self.assertIsNotNone(questionresponse)
        answer_sound = questionresponse.answer_sound
        self.assertIsNotNone(answer_sound)
        self.assertEqual(type(answer_sound), FieldFile)
        self.assertEqual(answer_sound.size, 13)
        with answer_sound.open() as file:
            answer_sound_data: bytes = file.read()
        self.assertEqual(answer_sound_data, sounddata)

    def test_question_missing_id(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="question.answered",
            data={
                "assignmentId": self.individual_assignment.pk,
                "partId": self.part.pk,
                "choiceId": self.possible_correct_answer1.pk,
                "duration": 10000,
            },
            user=self.student,
        )
        message.handle()
        self.assertEqual(message.error, f"No questionId in message {message.uuid}")

    def test_part_complete(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="part.complete",
            data={
                "assignmentId": self.individual_assignment.pk,
                "partIndex": 0,
                "partId": self.part.pk,
                "duration": 10000,
            },
            user=self.student,
        )
        message.handle()
        testresponse = TestResponse.objects.filter(
            assignment=self.individual_assignment,
            student=self.student,
        ).first()
        self.assertIsNotNone(testresponse)

        partresponse = PartResponse.objects.filter(
            testresponse=testresponse,
            testpart=self.part,
        ).first()
        self.assertIsNotNone(partresponse)
        self.assertEqual(partresponse.finished_after, 10000)

    def test_part_missing_id(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="part.complete",
            data={
                "assignmentId": self.individual_assignment.pk,
                "partIndex": 0,
                "duration": 10000,
            },
            user=self.student,
        )
        message.handle()
        self.assertEqual(message.error, f"No partId in message {message.uuid}")

    def test_test_complete(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="test.complete",
            data={
                "assignmentId": self.individual_assignment.pk,
            },
            user=self.student,
        )
        message.handle()
        testresponse = TestResponse.objects.filter(
            assignment=self.individual_assignment,
            student=self.student,
        ).first()
        self.assertIsNotNone(testresponse)
        self.assertTrue(testresponse.completed)

    def test_test_missing_id(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="test.complete",
            data={},
            user=self.student,
        )
        message.handle()
        self.assertEqual(message.error, f"No assignmentId in message {message.uuid}")

    def test_student_from_assignment(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="test.event",
            data={"assignmentId": self.individual_assignment.pk},
            user=self.teacher,
        )
        self.assertEqual(message.student, self.student)

    def test_student_from_message(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="test.event",
            data={"assignmentId": self.group_assignment.pk},
            user=self.student,
        )
        self.assertEqual(message.student, self.student)

    def test_no_student(self):
        message = Message.objects.create(
            uuid=uuid4(),
            event="test.event",
            data={"assignmentId": self.group_assignment.pk},
            user=self.teacher,
        )
        self.assertIsNone(message.student)


class TestInstructionSequence(DysleksiTest):
    def test_str(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        self.assertEqual(
            str(seq),
            f"{self.question1.part.name}: sequence {seq.pk} "
            f"(question {self.question1.id})",
        )

    def test_to_json(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        # Two instructions, but intentionally out of order in creation
        Instruction.objects.create(
            sequence=seq,
            order=2,
            action=InstructionAction.HIDE,
            element="choices",
            delay_after=123,
        )
        Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SHOW,
            element="intro",
            delay_after=0,
        )

        data = seq.to_json()

        self.assertIn("instructions", data)
        self.assertEqual(len(data["instructions"]), 2)

        # Must be ordered by "order"
        self.assertEqual(data["instructions"][0]["action"], InstructionAction.SHOW)
        self.assertEqual(data["instructions"][0]["element"], "intro")
        self.assertEqual(data["instructions"][0]["delayAfter"], 0)

        self.assertEqual(data["instructions"][1]["action"], InstructionAction.HIDE)
        self.assertEqual(data["instructions"][1]["element"], "choices")
        self.assertEqual(data["instructions"][1]["delayAfter"], 123)


class TestInstruction(DysleksiTest):
    def test_str(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SHOW,
            element="intro",
            delay_after=500,
        )

        self.assertEqual(str(instr), f"{str(seq)} [{instr.order}] {instr.action}")

    def test_to_json_minimal(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.FADE_OUT,
            delay_after=0,
        )

        data = instr.to_json()
        self.assertEqual(data, {"action": InstructionAction.FADE_OUT, "delayAfter": 0})

    def test_to_json_with_element(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.HIGHLIGHT,
            element="choice-isi",
            delay_after=250,
        )

        data = instr.to_json()
        self.assertEqual(data["action"], InstructionAction.HIGHLIGHT)
        self.assertEqual(data["delayAfter"], 250)
        self.assertEqual(data["element"], "choice-isi")

    def test_to_json_with_resource_sound(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.PLAY_SOUND,
            resource=self.resource4,
            delay_after=0,
        )

        data = instr.to_json()
        self.assertEqual(data["action"], InstructionAction.PLAY_SOUND)
        self.assertEqual(data["delayAfter"], 0)

        self.assertIn("url", data)
        self.assertTrue(data["url"])

    def test_to_json_with_resource_image(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SHOW,
            resource=self.resource2,
            delay_after=0,
        )

        data = instr.to_json()
        self.assertEqual(data["action"], InstructionAction.SHOW)
        self.assertEqual(data["delayAfter"], 0)

        self.assertIn("url", data)
        self.assertTrue(data["url"])

    def test_to_json_with_resource_text(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        instr = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SHOW,
            resource=self.resource1,
            delay_after=0,
        )

        data = instr.to_json()
        self.assertEqual(data["action"], InstructionAction.SHOW)
        self.assertEqual(data["delayAfter"], 0)

        self.assertNotIn("url", data)

    def test_constraint_play_sound_requires_resource(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        with self.assertRaises(IntegrityError) as cm:
            Instruction.objects.create(
                sequence=seq,
                order=1,
                action=InstructionAction.PLAY_SOUND,
                resource=None,
                delay_after=0,
            )

        exception = cm.exception
        self.assertIn("play_sound_requires_resource", str(exception))

    def test_to_json_with_data(self):
        seq = InstructionSequence.objects.create(question=self.question1)
        instruction = Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SET_REPEAT_BUTTON_DESTINATION,
            data="1",
        )
        data = instruction.to_json()
        self.assertEqual(
            data["action"],
            InstructionAction.SET_REPEAT_BUTTON_DESTINATION,
        )
        self.assertEqual(data["data"], "1")

    def test_default_ordering(self):
        seq = InstructionSequence.objects.create(question=self.question1)

        Instruction.objects.create(
            sequence=seq,
            order=3,
            action=InstructionAction.SHOW,
            element="a",
        )
        Instruction.objects.create(
            sequence=seq,
            order=1,
            action=InstructionAction.SHOW,
            element="b",
        )
        Instruction.objects.create(
            sequence=seq,
            order=2,
            action=InstructionAction.SHOW,
            element="c",
        )

        orders = list(seq.instructions.values_list("order", flat=True))
        self.assertEqual(orders, [1, 2, 3])


class TestResultCategory(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("create_result_categories")
        cls.gray = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.GRAY)
        cls.red = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.RED)
        cls.yellow = CorrectnessCategory.objects.get(
            color_key=CategoryColorChoice.YELLOW
        )
        cls.green = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.GREEN)
        cls.blue = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE)

    def test_gray(self):
        self.assertIsNone(self.gray.lower_proportion_limit)
        self.assertIsNone(self.gray.upper_proportion_limit)
        self.assertTrue(self.gray.is_default)
        self.assertEqual(self.gray.label_da, "Ikke fuldført")
        self.assertIsNone(self.gray.width)
        self.assertIsNone(self.gray.width_pct)

    def test_red(self):
        self.assertEqual(self.red.lower_proportion_limit, 0.0)
        self.assertEqual(self.red.upper_proportion_limit, 0.1)
        self.assertFalse(self.red.is_default)
        self.assertEqual(self.red.label_da, "Betydeligt under middel")
        self.assertAlmostEqual(self.red.width, 0.1)
        self.assertAlmostEqual(self.red.width_pct, 10.0)

    def test_yellow(self):
        self.assertEqual(self.yellow.lower_proportion_limit, 0.1)
        self.assertEqual(self.yellow.upper_proportion_limit, 0.35)
        self.assertFalse(self.yellow.is_default)
        self.assertEqual(self.yellow.label_da, "Under middel")
        self.assertAlmostEqual(self.yellow.width, 0.25)
        self.assertAlmostEqual(self.yellow.width_pct, 25.0)

    def test_green(self):
        self.assertEqual(self.green.lower_proportion_limit, 0.35)
        self.assertEqual(self.green.upper_proportion_limit, 0.75)
        self.assertFalse(self.green.is_default)
        self.assertEqual(self.green.label_da, "Middel")
        self.assertAlmostEqual(self.green.width, 0.4)
        self.assertAlmostEqual(self.green.width_pct, 40.0)

    def test_blue(self):
        self.assertEqual(self.blue.lower_proportion_limit, 0.75)
        self.assertEqual(self.blue.upper_proportion_limit, 1.0)
        self.assertFalse(self.blue.is_default)
        self.assertEqual(self.blue.label_da, "Over middel")
        self.assertAlmostEqual(self.blue.width, 0.25)
        self.assertAlmostEqual(self.blue.width_pct, 25.0)

    def test_default(self):
        self.assertEqual(CorrectnessCategory.default(), self.gray)

    def test_non_default(self):
        qs = CorrectnessCategory.non_default()
        self.assertIn(self.red, qs)
        self.assertIn(self.yellow, qs)
        self.assertIn(self.green, qs)
        self.assertIn(self.blue, qs)
        self.assertNotIn(self.gray, qs)

    def test_categorize_proportion(self):
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.0), self.red)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.05), self.red)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.15), self.yellow)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.35), self.yellow)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.36), self.green)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.70), self.green)
        self.assertEqual(CorrectnessCategory.categorize_proportion(0.85), self.blue)
        self.assertEqual(CorrectnessCategory.categorize_proportion(1.0), self.blue)
        self.assertEqual(CorrectnessCategory.categorize_proportion(None), self.gray)
        with self.assertRaises(ValueError):
            CorrectnessCategory.categorize_proportion(-0.01)
        with self.assertRaises(ValueError):
            CorrectnessCategory.categorize_proportion(1.01)

    def test_validate_categories_two_defaults(self):
        self.green.is_default = True
        self.green.save()
        with self.assertRaises(ValidationError) as cm:
            CorrectnessCategory.validate_categories()
        self.assertEqual(
            cm.exception.message,
            "More than one CorrectnessCategory with is_default=True",
        )

    def test_validate_categories_no_defaults(self):
        CorrectnessCategory.objects.filter(is_default=True).delete()
        with self.assertRaises(ValidationError) as cm:
            CorrectnessCategory.validate_categories()
        self.assertEqual(
            cm.exception.message, "No CorrectnessCategory with is_default=True"
        )

    def test_validate_categories_upper_1(self):
        self.blue.upper_proportion_limit = 2.0
        self.blue.save()
        with self.assertRaises(ValidationError) as cm:
            CorrectnessCategory.validate_categories()
        self.assertEqual(
            cm.exception.message,
            "Topmost CorrectnessCategory must have upper_proportion_limit 1",
        )


class TestTestResponseQuerySet(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.qs = TestResponse.objects.filter(
            pk__in=(cls.group_testresponse_1.pk, cls.group_testresponse_2.pk)
        ).order_by("student__pk")

    def test_annotate_correct_count(self):
        qs = self.qs.annotate_correct_count("correct_count")
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.correct_count, 4)
        self.assertEqual(student2_answer.correct_count, 1)

        qs = self.qs.annotate_correct_count(
            "correct_count", Q(partresponses__testpart=self.group_test_part)
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.correct_count, 4)
        self.assertEqual(student2_answer.correct_count, 1)

    def test_annotate_ordering(self):
        qs = self.qs.annotate_correct_count("correct_count").annotate_ordering(
            "correct_count", "ranking", False
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.ranking, 1)
        self.assertEqual(student2_answer.ranking, 2)

        qs = self.qs.annotate_correct_count("correct_count").annotate_ordering(
            "correct_count", "ranking", True
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.ranking, 2)
        self.assertEqual(student2_answer.ranking, 1)

    def test_annotate_proportion(self):
        qs = self.qs.annotate_correct_count("correct_count").annotate_proportion(
            "correct_count",
            "proportion",
            TestQuestion.objects.filter(part__tests=self.test).count(),
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.proportion, 1)
        self.assertEqual(student2_answer.proportion, 0.25)

    def test_annotate_score_category(self):
        qs = (
            self.qs.annotate_correct_count("correct_count")
            .annotate_proportion(
                "correct_count",
                "proportion",
                TestQuestion.objects.filter(part__tests=self.test).count(),
            )
            .annotate_score_category("proportion", "category")
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(
            student1_answer.category,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE).pk,
        )
        self.assertEqual(
            student2_answer.category,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.YELLOW).pk,
        )

    def test_partition_question_count(self):
        self.maxDiff = None
        red = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.RED)
        yellow = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.YELLOW)
        green = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.GREEN)
        blue = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE)
        self.assertEqual(
            CorrectnessCategory.partition_question_count(10),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=1),
                CategoryRange(category=yellow, lower_bound=2, upper_bound=3),
                CategoryRange(category=green, lower_bound=4, upper_bound=7),
                CategoryRange(category=blue, lower_bound=8, upper_bound=10),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(15),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=1),
                CategoryRange(category=yellow, lower_bound=2, upper_bound=5),
                CategoryRange(category=green, lower_bound=6, upper_bound=11),
                CategoryRange(category=blue, lower_bound=12, upper_bound=15),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(20),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=2),
                CategoryRange(category=yellow, lower_bound=3, upper_bound=7),
                CategoryRange(category=green, lower_bound=8, upper_bound=15),
                CategoryRange(category=blue, lower_bound=16, upper_bound=20),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(22),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=2),
                CategoryRange(category=yellow, lower_bound=3, upper_bound=7),
                CategoryRange(category=green, lower_bound=8, upper_bound=16),
                CategoryRange(category=blue, lower_bound=17, upper_bound=22),
            ],
        )
        with self.assertRaises(ValueError):
            CorrectnessCategory.partition_question_count(0)
        with self.assertRaises(ValueError):
            CorrectnessCategory.partition_question_count(-1)


class TestPartResponseQuerySet(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.qs: TestPartResponseQuerySet = PartResponse.objects.filter(
            pk__in=(cls.group_partresponse_1.pk, cls.group_partresponse_2.pk)
        ).order_by("testresponse__student__pk")

    def test_annotate_responses_count(self):
        qs = self.qs.annotate_questionresponses_count("responses_count")
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.responses_count, 4)
        self.assertEqual(student2_answer.responses_count, 4)

        qs = self.qs.annotate_questionresponses_count(
            "responses_count", Q(correctness=Correctness.CORRECT)
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.responses_count, 4)
        self.assertEqual(student2_answer.responses_count, 1)

    def test_annotate_questions_count(self):
        qs = self.qs.annotate_questions_count("questions_count")
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.questions_count, 4)
        self.assertEqual(student2_answer.questions_count, 4)

        qs = self.qs.annotate_questions_count("questions_count", Q(is_practice=False))
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.questions_count, 4)
        self.assertEqual(student2_answer.questions_count, 4)

    def test_annotate_ordering(self):
        qs = self.qs.annotate_questionresponses_count(
            "correct_count", Q(correctness=Correctness.CORRECT)
        ).annotate_ordering("correct_count", "ranking", False)
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.ranking, 1)
        self.assertEqual(student2_answer.ranking, 2)

        qs = self.qs.annotate_questionresponses_count(
            "correct_count", Q(correctness=Correctness.CORRECT)
        ).annotate_ordering("correct_count", "ranking", True)
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.ranking, 2)
        self.assertEqual(student2_answer.ranking, 1)

    def test_annotate_proportion(self):
        qs = (
            self.qs.annotate_questionresponses_count(
                "responses_count",
            )
            .annotate_questionresponses_count(
                "correct_count", Q(correctness=Correctness.CORRECT)
            )
            .annotate_proportion(
                "responses_count",
                "correct_count",
                "proportion",
            )
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.proportion, 1)
        self.assertEqual(student2_answer.proportion, 0.25)

    def test_annotate_correct_percentage(self):
        qs = (
            self.qs.annotate_questionresponses_count(
                "responses_count",
            )
            .annotate_questionresponses_count(
                "correct_count", Q(correctness=Correctness.CORRECT)
            )
            .annotate_proportion(
                "responses_count",
                "correct_count",
                "proportion",
            )
            .annotate_percentage("proportion", "percentage")
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(student1_answer.percentage, 100)
        self.assertEqual(student2_answer.percentage, 25)

    def test_annotate_score_category(self):
        qs = (
            self.qs.annotate_questionresponses_count(
                "responses_count",
            )
            .annotate_questionresponses_count(
                "correct_count", Q(correctness=Correctness.CORRECT)
            )
            .annotate_proportion(
                "responses_count",
                "correct_count",
                "proportion",
            )
            .annotate_score_category("proportion", "category")
        )
        student1_answer = qs[0]
        student2_answer = qs[1]
        self.assertEqual(
            student1_answer.category,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE).pk,
        )
        self.assertEqual(
            student2_answer.category,
            CorrectnessCategory.objects.get(color_key=CategoryColorChoice.YELLOW).pk,
        )

    def test_partition_question_count(self):
        self.maxDiff = None
        red = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.RED)
        yellow = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.YELLOW)
        green = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.GREEN)
        blue = CorrectnessCategory.objects.get(color_key=CategoryColorChoice.BLUE)
        self.assertEqual(
            CorrectnessCategory.partition_question_count(10),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=1),
                CategoryRange(category=yellow, lower_bound=2, upper_bound=3),
                CategoryRange(category=green, lower_bound=4, upper_bound=7),
                CategoryRange(category=blue, lower_bound=8, upper_bound=10),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(15),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=1),
                CategoryRange(category=yellow, lower_bound=2, upper_bound=5),
                CategoryRange(category=green, lower_bound=6, upper_bound=11),
                CategoryRange(category=blue, lower_bound=12, upper_bound=15),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(20),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=2),
                CategoryRange(category=yellow, lower_bound=3, upper_bound=7),
                CategoryRange(category=green, lower_bound=8, upper_bound=15),
                CategoryRange(category=blue, lower_bound=16, upper_bound=20),
            ],
        )
        self.assertEqual(
            CorrectnessCategory.partition_question_count(22),
            [
                CategoryRange(category=red, lower_bound=0, upper_bound=2),
                CategoryRange(category=yellow, lower_bound=3, upper_bound=7),
                CategoryRange(category=green, lower_bound=8, upper_bound=16),
                CategoryRange(category=blue, lower_bound=17, upper_bound=22),
            ],
        )
        with self.assertRaises(ValueError):
            CorrectnessCategory.partition_question_count(0)
        with self.assertRaises(ValueError):
            CorrectnessCategory.partition_question_count(-1)
