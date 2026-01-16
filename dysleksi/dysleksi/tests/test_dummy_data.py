# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.core.management import call_command
from django.test import TestCase

from dysleksi.models import Test, TestPart


class DummyDataTest(TestCase):
    def test_dummy_data_creation(self):
        call_command("create_dummy_tests")

        word_reading_2_tests = TestPart.objects.filter(name="Wordreading 2 (dummy)")
        tests = Test.objects.all()

        # We expect 6 tests; each grade needs to do a test twice a year
        self.assertEqual(tests.count(), 6)

        # We expect 4 wordreading 2 tests; 1. grade does not need to do this test
        self.assertEqual(word_reading_2_tests.count(), 4)
