# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.core.management import call_command
from django.test import TestCase
from django.test.utils import override_settings

from dysleksi.models import Student, TestPart


class DummyDataTest(TestCase):
    def test_dummy_data_creation(self):
        call_command("create_dummy_tests")

        word_reading_2_tests = TestPart.objects.filter(name="Ordlæsning 2A (dummy)")

        # We expect 4 wordreading 2 tests; 1. grade does not need to do this test
        # Matches the for loops in the management command (2 grades, 2 periods)
        self.assertEqual(word_reading_2_tests.count(), 2 * 2)

    @override_settings(LOAD_REAL_WORDREADING_DATA=True)
    @override_settings(LOAD_REAL_WORDSPELLING_DATA=True)
    def test_real_dummy_data_creation(self):
        call_command("create_dummy_tests")

        word_reading_2_test = TestPart.objects.filter(name="Ordlæsning 2A").first()
        wordspelling_test = TestPart.objects.filter(name="Ordstavning").first()

        self.assertEqual(word_reading_2_test.questions.count(), 104)
        self.assertEqual(wordspelling_test.questions.count(), 25)

    def test_dummy_user_creation(self):
        call_command("create_groups")
        call_command("create_dummy_classes_and_users")

        self.assertTrue(
            Student.objects.filter(first_name="Elev", last_name="Elevsen").exists()
        )
