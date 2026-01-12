# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from freezegun import freeze_time

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    PossibleAnswer,
    Test,
    TestAssignment,
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
            (self.admin, "Test Admin (Administrator)"),
            (self.student, "Test Elev (Elev)"),
            (self.teacher, "Test Lærer (Lærer)"),
            (unknown_user, "Unknown User (Ukendt brugertype)"),
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


class TestTestAssignment(DysleksiTest):
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
            dict(exception), {"student": ["Student class must match assignment class."]}
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
