# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from data_tools.utils import (
    create_fore_sound_test,
    create_letter_pronunciation_test,
    create_letter_shape_test,
    create_letter_sound_test,
    create_nonsense_word_pronunciation_test,
    create_nonwordspelling_test,
    create_sentence_reading_test,
    create_word_pronunciation_test,
    create_wordreading_1_test,
    create_wordspelling_test,
)
from django.test import TestCase

from dysleksi.models import Test, TestResource


class UtilTest(TestCase):
    def setUp(self):

        self.letter_pronunciation_data = [
            {
                "text": "s",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
            },
        ]
        self.word_pronunciation_data = [
            {
                "text": "iput",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
            },
        ]

        self.nonsense_word_pronunciation_data = [
            {
                "text": "foo",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
            },
        ]

        self.letter_pronunciation_practice_data = [
            {
                "text": "s",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]
        self.word_pronunciation_practice_data = [
            {
                "text": "iput",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]

        self.nonsense_word_pronunciation_practice_data = [
            {
                "text": "foo",
                "correct": None,
                "wrong": [],
                "question_type": "no_input_required",
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]

        self.wordspelling_data = [
            {
                "sound": "wordspelling_dummy/iki.mp3",
                "correct": "iki",
                "wrong": [],
            },
        ]

        self.nonwordspelling_data = [
            {
                "sound": "nonwordspelling_dummy/foo.mp3",
                "correct": "foo",
                "wrong": [],
            },
        ]
        self.nonwordspelling_practice_data = [
            {
                "sound": "nonwordspelling_dummy/bar.mp3",
                "correct": "bar",
                "wrong": [],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
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
        self.fore_sound_data = [
            {
                "sound": "resources/dummy/fore_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "resources/dummy/fore_sound/Opgave/abe.png",
                "wrong": [
                    "resources/dummy/fore_sound/Opgave/bjorn.png",
                    "resources/dummy/fore_sound/Opgave/fugl.png",
                    "resources/dummy/fore_sound/Opgave/kat.png",
                ],
            },
        ]

        self.fore_sound_practice_data = [
            {
                "sound": "resources/dummy/fore_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "resources/dummy/fore_sound/Opgave/abe.png",
                "wrong": [
                    "resources/dummy/fore_sound/Opgave/bjorn.png",
                    "resources/dummy/fore_sound/Opgave/fugl.png",
                    "resources/dummy/fore_sound/Opgave/kat.png",
                ],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]

        self.sentence_reading_data = [
            {
                "image": "resources/dummy/sentence_reading/Opgave/Blomst.jpg",
                "text": "Jeg vokser i naturen",
                "question_type": "multiple_choice",
                "correct": "true",
                "wrong": ["false"],
            },
        ]

        self.sentence_reading_practice_data = [
            {
                "image": "resources/dummy/sentence_reading/Opgave/Blomst.jpg",
                "text": "Jeg vokser i naturen",
                "question_type": "multiple_choice",
                "correct": "true",
                "wrong": ["false"],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]

        self.letter_shape_data = [
            {
                "question_type": "multiple_choice_match",
                "correct": "Ss",
                "set1": ["S", "B"],
                "set2": ["s", "a"],
            },
        ]

        self.letter_shape_practice_data = [
            {
                "question_type": "multiple_choice_match",
                "correct": "Ss",
                "set1": ["S", "B"],
                "set2": ["s", "a"],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
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

    def test_create_nonwordspelling_test(self):
        create_nonwordspelling_test(
            self.test, self.nonwordspelling_data, self.nonwordspelling_practice_data
        )
        self.assertTrue(
            TestResource.objects.filter(sound="nonwordspelling_dummy/foo.mp3").exists()
        )

    def test_create_nonwordspelling_test_without_practice_run(self):
        create_nonwordspelling_test(self.test, self.nonwordspelling_data)
        self.assertTrue(
            TestResource.objects.filter(sound="nonwordspelling_dummy/foo.mp3").exists()
        )

    def test_create_wordreading_1_test_with_practice_data(self):
        create_wordreading_1_test(
            self.test, self.wordreading_1_data, self.wordreading_1_pratice_data
        )
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

    def test_create_wordreading_1_test(self):
        create_wordreading_1_test(self.test, self.wordreading_1_data)
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

        # Validate that the resource only exists once. Also when we call the command
        # again
        create_wordreading_1_test(self.test, self.wordreading_1_data)
        self.assertEqual(TestResource.objects.filter(text="Cykel").count(), 1)

    def test_create_letter_sound_test(self):
        create_letter_sound_test(self.test, self.letter_sound_data)

        self.assertTrue(
            TestResource.objects.filter(
                sound="resources/dummy/letter_sound/Opgave/a.mp3"
            ).exists()
        )

    def test_create_fore_sound_test(self):
        create_fore_sound_test(self.test, self.fore_sound_data)

        self.assertTrue(
            TestResource.objects.filter(
                image="resources/dummy/fore_sound/Opgave/abe.png"
            ).exists()
        )

    def test_create_fore_sound_test_with_practice_run(self):
        create_fore_sound_test(
            self.test, self.fore_sound_data, self.fore_sound_practice_data
        )

        self.assertTrue(
            TestResource.objects.filter(
                image="resources/dummy/fore_sound/Opgave/abe.png"
            ).exists()
        )

    def test_create_sentence_reading_test(self):
        create_sentence_reading_test(self.test, self.sentence_reading_data)

        self.assertTrue(
            TestResource.objects.filter(
                image="resources/dummy/sentence_reading/Opgave/Blomst.jpg"
            ).exists()
        )

    def test_create_sentence_reading_test_with_practice_data(self):
        create_sentence_reading_test(
            self.test, self.sentence_reading_data, self.sentence_reading_practice_data
        )

        self.assertTrue(
            TestResource.objects.filter(
                image="resources/dummy/sentence_reading/Opgave/Blomst.jpg"
            ).exists()
        )

    def test_create_letter_shape_data_test(self):
        create_letter_shape_test(self.test, self.letter_shape_data)

        self.assertTrue(TestResource.objects.filter(text="Ss").exists())

    def test_create_letter_shape_data_test_with_practice_data(self):
        create_letter_shape_test(
            self.test, self.letter_shape_data, self.letter_shape_practice_data
        )

        self.assertTrue(TestResource.objects.filter(text="Ss").exists())

    def test_create_letter_pronunciation_test(self):

        create_letter_pronunciation_test(self.test, self.letter_pronunciation_data)
        self.assertTrue(TestResource.objects.filter(text="s").exists())

    def test_create_letter_pronunciation_test_with_practice_run(self):

        create_letter_pronunciation_test(
            self.test,
            self.letter_pronunciation_data,
            self.letter_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="s").exists())

    def test_create_word_pronunciation_test(self):

        create_word_pronunciation_test(self.test, self.word_pronunciation_data)
        self.assertTrue(TestResource.objects.filter(text="iput").exists())

    def test_create_word_pronunciation_test_with_practice_run(self):

        create_word_pronunciation_test(
            self.test,
            self.word_pronunciation_data,
            self.word_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="iput").exists())

    def test_create_nonsense_word_pronunciation_test(self):

        create_nonsense_word_pronunciation_test(
            self.test, self.nonsense_word_pronunciation_data
        )
        self.assertTrue(TestResource.objects.filter(text="foo").exists())

    def test_create_nonsense_word_pronunciation_test_with_practice_run(self):

        create_nonsense_word_pronunciation_test(
            self.test,
            self.nonsense_word_pronunciation_data,
            self.nonsense_word_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="foo").exists())
