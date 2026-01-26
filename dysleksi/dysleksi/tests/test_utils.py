# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from data_tools.utils import create_wordspelling_test
from django.test import TestCase

from dysleksi.models import Test, TestResource


class UtilTest(TestCase):
    def setUp(self):
        self.wordspelling_data = [
            {
                "sound": "wordspelling_dummy/iki.mp3",
                "correct": "iki",
                "wrong": [],
            },
        ]

        self.test = Test.objects.create(name="test test")

    def test_create_wordspelling_test(self):
        self.assertFalse(
            TestResource.objects.filter(sound="wordspelling_dummy/iki.mp3").exists()
        )
        create_wordspelling_test(self.test, self.wordspelling_data)
        self.assertTrue(
            TestResource.objects.filter(sound="wordspelling_dummy/iki.mp3").exists()
        )
