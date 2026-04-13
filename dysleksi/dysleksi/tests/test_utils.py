# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from data_tools.utils import (
    create_letter_sound_test,
    create_wordreading_1_test,
    create_wordspelling_test,
)
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

        self.wordreading_1_data = [
            {
                "text": "Cykel",
                "correct": "resources/dummy/wordreading_1/Opgave/bike.png",
                "wrong": [
                    "resources/dummy/wordreading_1/Opgave/house.png",
                    "resources/dummy/wordreading_1/Opgave/car.png",
                    "resources/dummy/wordreading_1/Opgave/cat.png",
                ],
            },
        ]

        self.wordreading_1_pratice_data = [
            {
                "text": "Cykel",
                "correct": "resources/dummy/wordreading_1/Opgave/bike.png",
                "wrong": [
                    "resources/dummy/wordreading_1/Opgave/house.png",
                    "resources/dummy/wordreading_1/Opgave/car.png",
                    "resources/dummy/wordreading_1/Opgave/cat.png",
                ],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            }
        ]

        self.letter_sound_data = [
            {
                "sound": "resources/dummy/letter_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "a",
                "wrong": ["b", "x", "d"],
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

    def test_create_wordreading_1_test(self):
        create_wordreading_1_test(
            self.test, self.wordreading_1_data, self.wordreading_1_pratice_data
        )
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

    def test_create_letter_sound_test(self):
        create_letter_sound_test(self.test, self.letter_sound_data)

        self.assertTrue(
            TestResource.objects.filter(
                sound="resources/dummy/letter_sound/Opgave/a.mp3"
            ).exists()
        )
