# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.core.management import call_command
from django.test import TestCase

from dysleksi.models import Student, TestPart


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
