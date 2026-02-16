# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from dysleksi.models import Test, TestPart


class ImportTestTest(TestCase):
    def setUp(self):
        # Create a Test object for the test
        self.test_name = "Test1"
        self.test = Test.objects.create(name=self.test_name)

    def test_import_wordreading_2_test(self):
        questions_data = [
            {
                "image": "wordreading_2_dummy/dog.png",
                "correct": "hund",
                "wrong": ["kat", "ko", "hest"],
            },
            {
                "image": "wordreading_2_dummy/bike.png",
                "correct": "cykel",
                "wrong": ["bil", "bus", "tog"],
            },
            {
                "image": "wordreading_2_dummy/cat.png",
                "correct": "kat",
                "wrong": ["hund", "mus", "fugl"],
            },
            {
                "image": "wordreading_2_dummy/house.png",
                "correct": "hus",
                "wrong": ["bil", "træ", "vej"],
            },
            {
                "image": "wordreading_2_dummy/car.png",
                "correct": "bil",
                "wrong": ["cykel", "tog", "bus"],
            },
        ]

        # Write JSON data to a temporary file
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(questions_data, tmp_file, ensure_ascii=False)
            tmp_file_path = Path(tmp_file.name)

        # Call the management command with name and JSON path
        call_command(
            "import_test",
            self.test_name,
            "Ordlæsning 2",
            str(tmp_file_path),
            "wordreading_2",
        )

        # Fetch the created TestPart
        word_reading_2_test = TestPart.objects.get(name="Ordlæsning 2", test=self.test)

        # Assert we created all 5 questions
        self.assertEqual(word_reading_2_test.questions.count(), 5)

        # Clean up temporary file
        tmp_file_path.unlink()

    def test_import_letter_pronunciation_test(self):
        questions_data = [
            {"text": "s", "correct": None, "wrong": []},
            {"text": "v", "correct": None, "wrong": []},
            {"text": "k", "correct": None, "wrong": []},
        ]
        practice_data = [
            {"text": "q", "correct": None, "wrong": []},
        ]

        # Write JSON data to a temporary file
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(questions_data, tmp_file, ensure_ascii=False)
            tmp_questions_data_path = Path(tmp_file.name)

        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(practice_data, tmp_file, ensure_ascii=False)
            tmp_practice_data_path = Path(tmp_file.name)

        # Call the management command with name and JSON path
        call_command(
            "import_test",
            self.test_name,
            "Bogstavsbenævnelse",
            str(tmp_questions_data_path),
            "letter_pronunciation",
            practice_json_path=str(tmp_practice_data_path),
        )

        # Fetch the created TestPart
        word_reading_2_test = TestPart.objects.get(
            name="Bogstavsbenævnelse", test=self.test
        )

        # Assert we created all 4 questions
        self.assertEqual(word_reading_2_test.questions.count(), 4)

        # Clean up temporary file
        tmp_questions_data_path.unlink()
        tmp_practice_data_path.unlink()

    def test_invalid_test_type(self):
        questions_data = [
            {"text": "s", "correct": None, "wrong": []},
            {"text": "v", "correct": None, "wrong": []},
            {"text": "k", "correct": None, "wrong": []},
        ]

        # Write JSON data to a temporary file
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(questions_data, tmp_file, ensure_ascii=False)
            tmp_questions_data_path = Path(tmp_file.name)

        with self.assertRaises(ValueError):

            call_command(
                "import_test",
                self.test_name,
                "Bogstavsbenævnelse",
                str(tmp_questions_data_path),
                "invalid_test_type",
            )
