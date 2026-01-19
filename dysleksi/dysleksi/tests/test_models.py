# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from freezegun import freeze_time

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    PartResponse,
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
from dysleksi.tests.base import DysleksiTest


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
        self.assertEqual(self.klasse.start_year, 2025)
        with freeze_time("2025-08-01"):
            self.assertEqual(str(self.klasse), "1.A")
        with freeze_time("2026-01-01"):
            self.assertEqual(str(self.klasse), "1.A")
        with freeze_time("2026-06-30"):
            self.assertEqual(str(self.klasse), "1.A")

        with freeze_time("2026-07-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2026-08-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2027-01-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2027-06-30"):
            self.assertEqual(str(self.klasse), "2.A")

        with freeze_time("2027-07-01"):
            self.assertEqual(str(self.klasse), "3.A")


class TestPartResponse(DysleksiTest):
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


class TestQuestionResponse(DysleksiTest):
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


class TestTestPart(DysleksiTest):
    def test_str(self):
        test_part = TestPart(name="Test")
        self.assertEqual(str(test_part), "Test")


class TestTestAssignment(DysleksiTest):
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


class TestTestResponse(DysleksiTest):

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
        klasse2 = self.create_class(2025, "B")
        student2 = self.create_student("TestStudent2", klasse=klasse2)

        with self.assertRaises(ValidationError) as cm:
            response = TestResponse(
                assignment=assignment,
                student=student2,
            )
            response.full_clean()
            print(response.assignment.klasse, response.student.klasse)
        exception: ValidationError = cm.exception

        self.assertEqual(
            dict(exception),
            {
                "student": [
                    f"Student class (pk={klasse2.pk}) must match "
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
        quest_str = f"{str(question.part)} / {str(question.part.test)} {question.pk}"
        self.assertEqual(quest_str, str(question))

    def test_create(self):
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        self.assertEqual(question.part, self.part)
        self.assertEqual(question.challenge, self.resource1)
        self.assertEqual(question.part.test.name, "Test1")
        answer1 = PossibleAnswer.objects.create(
            question=question, resource=self.resource2, is_correct=True
        )
        self.assertEqual(answer1.question, question)
        self.assertEqual(answer1.resource.name, "TestResource2")


class TestPossibleAnswer(DysleksiTest):
    def test_str(self):
        question = TestQuestion.objects.create(part=self.part, challenge=self.resource1)
        pa = PossibleAnswer.objects.create(
            question=question, resource=self.resource2, is_correct=True
        )
        self.assertTrue(str(pa) == f"{str(pa.question)} / {str(pa.is_correct)}")


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
        self.assertEqual(part_model.intro, part_json["intro"])

        # Test questions
        self.assertEqual(part_model.questions.count(), 1)
        self.assertEqual(len(part_json["questions"]), part_model.questions.count())

        question_model = part_model.questions.all().order_by("id")[0]
        question_json = part_json["questions"][0]

        self.assertEqual(question_model.challenge.name, question_json["challenge_name"])
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
            self.assertEqual(ans_model.is_correct, ans_json["is_correct"])
