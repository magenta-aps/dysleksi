# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import os
import shutil
import tempfile
from datetime import timedelta

from data_tools.utils import (
    update_or_create_fore_sound_test,
    update_or_create_letter_pronunciation_test,
    update_or_create_letter_shape_test,
    update_or_create_letter_sound_test,
    update_or_create_nonsense_word_pronunciation_test,
    update_or_create_nonwordspelling_test,
    update_or_create_sentence_reading_test,
    update_or_create_word_pronunciation_test,
    update_or_create_wordreading_1_test,
    update_or_create_wordspelling_test,
)
from django.test import TestCase, override_settings

from dysleksi.models import Test, TestResource
from dysleksi.utils import format_time, scan_static_files


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
                "correct": "dummy-resources/wordreading_1/Opgave/bike.png",
                "wrong": [
                    "dummy-resources/wordreading_1/Opgave/house.png",
                    "dummy-resources/wordreading_1/Opgave/car.png",
                    "dummy-resources/wordreading_1/Opgave/cat.png",
                ],
            },
        ]

        self.wordreading_1_pratice_data = [
            {
                "text": "Cykel",
                "correct": "dummy-resources/wordreading_1/Opgave/bike.png",
                "wrong": [
                    "dummy-resources/wordreading_1/Opgave/house.png",
                    "dummy-resources/wordreading_1/Opgave/car.png",
                    "dummy-resources/wordreading_1/Opgave/cat.png",
                ],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            }
        ]

        self.letter_sound_data = [
            {
                "sound": "dummy-resources/letter_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "a",
                "wrong": ["b", "x", "d"],
            },
        ]
        self.fore_sound_data = [
            {
                "sound": "dummy-resources/fore_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "dummy-resources/fore_sound/Opgave/abe.png",
                "wrong": [
                    "dummy-resources/fore_sound/Opgave/bjorn.png",
                    "dummy-resources/fore_sound/Opgave/fugl.png",
                    "dummy-resources/fore_sound/Opgave/kat.png",
                ],
            },
        ]

        self.fore_sound_practice_data = [
            {
                "sound": "dummy-resources/fore_sound/Opgave/a.mp3",
                "question_type": "multiple_choice",
                "correct": "dummy-resources/fore_sound/Opgave/abe.png",
                "wrong": [
                    "dummy-resources/fore_sound/Opgave/bjorn.png",
                    "dummy-resources/fore_sound/Opgave/fugl.png",
                    "dummy-resources/fore_sound/Opgave/kat.png",
                ],
                "instruction_sequence": [
                    {"action": "show", "element": "challenge-text", "delayAfter": 0},
                ],
            },
        ]

        self.sentence_reading_data = [
            {
                "image": "dummy-resources/sentence_reading/Opgave/Blomst.jpg",
                "text": "Jeg vokser i naturen",
                "question_type": "multiple_choice",
                "correct": "true",
                "wrong": ["false"],
            },
        ]

        self.sentence_reading_practice_data = [
            {
                "image": "dummy-resources/sentence_reading/Opgave/Blomst.jpg",
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

    def test_update_or_create_wordspelling_test(self):
        self.assertFalse(
            TestResource.objects.filter(sound="wordspelling_dummy/iki.mp3").exists()
        )
        update_or_create_wordspelling_test(self.test, self.wordspelling_data)
        self.assertTrue(
            TestResource.objects.filter(sound="wordspelling_dummy/iki.mp3").exists()
        )

    def test_update_or_create_nonwordspelling_test(self):
        update_or_create_nonwordspelling_test(
            self.test, self.nonwordspelling_data, self.nonwordspelling_practice_data
        )
        self.assertTrue(
            TestResource.objects.filter(sound="nonwordspelling_dummy/foo.mp3").exists()
        )

    def test_update_or_create_nonwordspelling_test_without_practice_run(self):
        update_or_create_nonwordspelling_test(self.test, self.nonwordspelling_data)
        self.assertTrue(
            TestResource.objects.filter(sound="nonwordspelling_dummy/foo.mp3").exists()
        )

    def test_update_or_create_wordreading_1_test_with_practice_data(self):
        update_or_create_wordreading_1_test(
            self.test, self.wordreading_1_data, self.wordreading_1_pratice_data
        )
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

    def test_update_or_create_wordreading_1_test(self):
        update_or_create_wordreading_1_test(self.test, self.wordreading_1_data)
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

        # Validate that the resource only exists once. Also when we call the command
        # again
        update_or_create_wordreading_1_test(self.test, self.wordreading_1_data)
        self.assertEqual(TestResource.objects.filter(text="Cykel").count(), 1)

    def test_update_or_create_wordreading_1_test_without_updating_contents(self):
        update_or_create_wordreading_1_test(
            self.test, self.wordreading_1_data, update_contents=False
        )
        self.assertFalse(TestResource.objects.filter(text="Cykel").exists())

        update_or_create_wordreading_1_test(
            self.test, self.wordreading_1_data, update_contents=True
        )
        self.assertTrue(TestResource.objects.filter(text="Cykel").exists())

    def test_update_or_create_letter_sound_test(self):
        update_or_create_letter_sound_test(self.test, self.letter_sound_data)

        self.assertTrue(
            TestResource.objects.filter(
                sound="dummy-resources/letter_sound/Opgave/a.mp3"
            ).exists()
        )

    def test_update_or_create_fore_sound_test(self):
        update_or_create_fore_sound_test(self.test, self.fore_sound_data)

        self.assertTrue(
            TestResource.objects.filter(
                image="dummy-resources/fore_sound/Opgave/abe.png"
            ).exists()
        )

    def test_update_or_create_fore_sound_test_with_practice_run(self):
        update_or_create_fore_sound_test(
            self.test, self.fore_sound_data, self.fore_sound_practice_data
        )

        self.assertTrue(
            TestResource.objects.filter(
                image="dummy-resources/fore_sound/Opgave/abe.png"
            ).exists()
        )

    def test_update_or_create_sentence_reading_test(self):
        update_or_create_sentence_reading_test(self.test, self.sentence_reading_data)

        self.assertTrue(
            TestResource.objects.filter(
                image="dummy-resources/sentence_reading/Opgave/Blomst.jpg"
            ).exists()
        )

    def test_update_or_create_sentence_reading_test_with_practice_data(self):
        update_or_create_sentence_reading_test(
            self.test, self.sentence_reading_data, self.sentence_reading_practice_data
        )

        self.assertTrue(
            TestResource.objects.filter(
                image="dummy-resources/sentence_reading/Opgave/Blomst.jpg"
            ).exists()
        )

    def test_update_or_create_letter_shape_data_test(self):
        update_or_create_letter_shape_test(self.test, self.letter_shape_data)

        self.assertTrue(TestResource.objects.filter(text="Ss").exists())

    def test_update_or_create_letter_shape_data_test_with_practice_data(self):
        update_or_create_letter_shape_test(
            self.test, self.letter_shape_data, self.letter_shape_practice_data
        )

        self.assertTrue(TestResource.objects.filter(text="Ss").exists())

    def test_update_or_create_letter_pronunciation_test(self):

        update_or_create_letter_pronunciation_test(
            self.test, self.letter_pronunciation_data
        )
        self.assertTrue(TestResource.objects.filter(text="s").exists())

    def test_update_or_create_letter_pronunciation_test_with_practice_run(self):

        update_or_create_letter_pronunciation_test(
            self.test,
            self.letter_pronunciation_data,
            self.letter_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="s").exists())

    def test_update_or_create_word_pronunciation_test(self):

        update_or_create_word_pronunciation_test(
            self.test, self.word_pronunciation_data
        )
        self.assertTrue(TestResource.objects.filter(text="iput").exists())

    def test_update_or_create_word_pronunciation_test_with_practice_run(self):

        update_or_create_word_pronunciation_test(
            self.test,
            self.word_pronunciation_data,
            self.word_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="iput").exists())

    def test_update_or_create_nonsense_word_pronunciation_test(self):

        update_or_create_nonsense_word_pronunciation_test(
            self.test, self.nonsense_word_pronunciation_data
        )
        self.assertTrue(TestResource.objects.filter(text="foo").exists())

    def test_update_or_create_nonsense_word_pronunciation_test_with_practice_run(self):

        update_or_create_nonsense_word_pronunciation_test(
            self.test,
            self.nonsense_word_pronunciation_data,
            self.nonsense_word_pronunciation_practice_data,
        )
        self.assertTrue(TestResource.objects.filter(text="foo").exists())


class ScanStaticFilesTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tmp_static_root = tempfile.mkdtemp(prefix="static_test_")

        cls.files_to_create = {
            "images/logo.png": "keep",
            "images/logo.63d9e4226d41.png": "skip",
            "images/icon.svg": "keep",
            "images/icon.abc12345.svg.map": "skip",
            "images/photo.gz": "skip",
            "images/nested/deep.png": "keep",
            "images/nested/deep.aabbccddeeff.png": "skip",
            "audio/beep.mp3": "keep",
            "audio/beep.0123456789ab.mp3": "skip",
            "vendor/fonts/myfont.woff2": "keep",
            "vendor/fonts/myfont.fedcba987654.woff2": "skip",
            "other/ignored.png": "skip",  # outside scanned folders
        }

        for rel_path in cls.files_to_create:
            abs_path = os.path.join(cls.tmp_static_root, rel_path)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w") as f:
                f.write("x")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp_static_root, ignore_errors=True)
        super().tearDownClass()

    def _run(self):
        with override_settings(
            STATIC_ROOT=self.tmp_static_root,
            STATIC_URL="/static/",
            STATICFILES_STORAGE=(
                "django.contrib.staticfiles.storage.StaticFilesStorage"
            ),
        ):
            return scan_static_files()

    def test_keeps_unhashed_files(self):
        urls = self._run()
        self.assertIn("/static/images/logo.png", urls)
        self.assertIn("/static/images/icon.svg", urls)
        self.assertIn("/static/audio/beep.mp3", urls)
        self.assertIn("/static/vendor/fonts/myfont.woff2", urls)

    def test_skips_hashed_files(self):
        urls = self._run()
        self.assertNotIn("/static/images/logo.63d9e4226d41.png", urls)
        self.assertNotIn("/static/audio/beep.0123456789ab.mp3", urls)
        self.assertNotIn("/static/vendor/fonts/myfont.fedcba987654.woff2", urls)

    def test_skips_map_and_gz_files(self):
        urls = self._run()
        self.assertFalse(any(u.endswith(".map") for u in urls))
        self.assertFalse(any(u.endswith(".gz") for u in urls))

    def test_recurses_into_subdirectories(self):
        urls = self._run()
        self.assertIn("/static/images/nested/deep.png", urls)
        self.assertNotIn("/static/images/nested/deep.aabbccddeeff.png", urls)

    def test_ignores_unlisted_folders(self):
        urls = self._run()
        self.assertFalse(
            any("other/ignored.png" in u for u in urls),
            "Files outside scanned folders should not appear",
        )


class FormatTimeTest(TestCase):
    def test_format_time(self):
        self.assertEqual(format_time(42), "42 sek.")
        self.assertEqual(format_time(60), "1 min. 0 sek.")
        self.assertEqual(format_time(95), "1 min. 35 sek.")
        self.assertEqual(format_time(305), "5 min. 5 sek.")
        self.assertEqual(format_time(4000), "1 tim. 6 min. 40 sek.")
        self.assertEqual(format_time(timedelta(days=1)), "24 tim. 0 min. 0 sek.")
