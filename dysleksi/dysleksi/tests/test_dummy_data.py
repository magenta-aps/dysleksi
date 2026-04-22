# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from dysleksi.models import (
    PartResponse,
    QuestionResponse,
    Student,
    Test,
    TestPart,
    TestType,
)


class DummyDataTest(TestCase):
    def test_dummy_data_creation(self):
        call_command("create_dummy_tests")

        # We expect exactly one "word reading 2" test part, which is reused/referenced
        # across the four available group tests ("Midt 2. klasse", "Slut 2. klasse",
        # "Midt 3. klasse", "Slut 3. klasse".) In actual test data, we would expect the
        # different tests to have different test parts.
        word_reading_2_test_parts = TestPart.objects.filter(
            name="Ordlæsning 2A (dummy)"
        )
        self.assertEqual(word_reading_2_test_parts.count(), 1)

    def test_real_dummy_data_creation(self):
        call_command("create_dummy_tests")

        word_reading_2_test = TestPart.objects.filter(name="Ordlæsning 2A").first()
        wordspelling_test = TestPart.objects.filter(name="Ordstavning").first()

        self.assertEqual(word_reading_2_test.questions.count(), 105)
        self.assertEqual(wordspelling_test.questions.count(), 25)

    def test_dummy_user_creation(self):
        call_command("create_groups")
        call_command("create_dummy_classes_and_users")

        self.assertTrue(
            Student.objects.filter(first_name="Elev", last_name="Elevsen").exists()
        )

        amount_of_students = Student.objects.all().count()

        # Validate that running dummy user creation twice does not crash the code
        call_command("create_dummy_classes_and_users")
        self.assertEqual(amount_of_students, Student.objects.all().count())

    def test_dummy_test_answers_creation(self):
        call_command("create_groups")
        call_command("create_dummy_classes_and_users")
        call_command("create_dummy_tests", "--answer")
        word_reading_2_test: TestPart = TestPart.objects.filter(
            name="Ordlæsning 2A"
        ).first()

        students_participating: int = sum(
            [
                assignment.klasse.students.count()
                for test in word_reading_2_test.tests.all()
                for assignment in test.testassignment_set.all()
            ]
        )
        question_count: int = word_reading_2_test.questions.count()
        self.assertEqual(
            word_reading_2_test.partresponses.count(), students_participating
        )
        self.assertEqual(
            QuestionResponse.objects.filter(
                partresponse__testpart_id=word_reading_2_test.pk
            ).count(),
            students_participating * question_count,
        )

    def test_dummy_test_answers_creation_no_classes_or_students(self):
        call_command("create_groups")
        call_command("create_dummy_tests", "--answer")
        word_reading_2_test: TestPart = TestPart.objects.filter(
            name="Ordlæsning 2A"
        ).first()

        self.assertEqual(word_reading_2_test.partresponses.count(), 0)
        self.assertEqual(
            QuestionResponse.objects.filter(
                partresponse__testpart_id=word_reading_2_test.pk
            ).count(),
            0,
        )

    def test_answer_test(self):
        call_command("create_groups")
        call_command("create_dummy_classes_and_users")
        call_command("create_dummy_tests")

        pk = Test.objects.filter(test_type=TestType.GROUP).first().pk
        with patch("builtins.print") as mock_print:
            call_command("answer_test", pk)
            mock_print.assert_called_with("Must specify --class for a group test")
            self.assertFalse(PartResponse.objects.exists())

        pk = Test.objects.filter(test_type=TestType.INDIVIDUAL).first().pk
        with patch("builtins.print") as mock_print:
            call_command("answer_test", pk)
            mock_print.assert_called_with(
                "Must specify --student for an individual test"
            )
            self.assertFalse(PartResponse.objects.exists())
