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

    def test_import(self):
        questions_data = [
            {
                "image": "wordreading_2_dummy/dog.png",
                "correct": "hund",
                "wrong": ["kat", "ko", "hest"],
            },
            {
                "image": "wordreading_2_dummy/bike.jpeg",
                "correct": "cykel",
                "wrong": ["bil", "bus", "tog"],
            },
            {
                "image": "wordreading_2_dummy/cat.jpg",
                "correct": "kat",
                "wrong": ["hund", "mus", "fugl"],
            },
            {
                "image": "wordreading_2_dummy/house.jpg",
                "correct": "hus",
                "wrong": ["bil", "træ", "vej"],
            },
            {
                "image": "wordreading_2_dummy/car.jpg",
                "correct": "bil",
                "wrong": ["cykel", "tog", "bus"],
            },
        ]

        # Write JSON data to a temporary file
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(questions_data, tmp_file, ensure_ascii=False)
            tmp_file_path = Path(tmp_file.name)

        # Call the management command with name and JSON path
        call_command("import_test", self.test_name, str(tmp_file_path))

        # Fetch the created TestPart
        word_reading_2_test = TestPart.objects.get(name="Ordlæsning 2", test=self.test)

        # Assert we created all 5 questions
        self.assertEqual(word_reading_2_test.questions.count(), 6)

        # Clean up temporary file
        tmp_file_path.unlink()
