# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import os
import tempfile
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.files.base import File
from django.core.management import call_command
from django.test import TestCase, override_settings

from dysleksi.models import (
    STUDENTS,
    TEACHERS,
    PartResponse,
    QuestionResponse,
    Student,
    Teacher,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResponse,
)


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
        word_reading_2_test = TestPart.objects.get(name="Ordlæsning 2", tests=self.test)

        # Assert we created all 5 questions
        self.assertEqual(word_reading_2_test.questions.count(), 5)

        # Clean up temporary file
        tmp_file_path.unlink()

    def test_import_letter_pronunciation_test_with_practice_data(self):
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
            name="Bogstavsbenævnelse", tests=self.test
        )

        # Assert we created all 4 questions
        self.assertEqual(word_reading_2_test.questions.count(), 4)

        # Clean up temporary file
        tmp_questions_data_path.unlink()
        tmp_practice_data_path.unlink()

    def test_import_letter_pronunciation_test_without_practice_data(self):
        questions_data = [
            {"text": "s", "correct": None, "wrong": []},
            {"text": "v", "correct": None, "wrong": []},
            {"text": "k", "correct": None, "wrong": []},
        ]

        # Write JSON data to a temporary file
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp_file:
            json.dump(questions_data, tmp_file, ensure_ascii=False)
            tmp_questions_data_path = Path(tmp_file.name)

        # Call the management command with name and JSON path
        call_command(
            "import_test",
            self.test_name,
            "Bogstavsbenævnelse",
            str(tmp_questions_data_path),
            "letter_pronunciation",
            practice_json_path=None,
        )

        # Fetch the created TestPart
        word_reading_2_test = TestPart.objects.get(
            name="Bogstavsbenævnelse", tests=self.test
        )

        # Assert we created all 3 questions
        self.assertEqual(word_reading_2_test.questions.count(), 3)

        # Clean up temporary file
        tmp_questions_data_path.unlink()

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


class CleanupRecordingsTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        Group.objects.create(name=TEACHERS)
        Group.objects.create(name=STUDENTS)
        teacher = Teacher.objects.create(username="Teacher")
        student = Student.objects.create(username="Student")
        test = Test.objects.create(name="Test")
        part = TestPart.objects.create(
            name="Part", timeout=10, partial_score_after=10, reminder=10
        )
        part.tests.add(test)
        question = TestQuestion.objects.create(part=part)
        assignment = TestAssignment.objects.create(
            test=test, teacher=teacher, student=student
        )
        testresponse = TestResponse.objects.create(
            assignment=assignment, student=student
        )
        partresponse = PartResponse.objects.create(
            testresponse=testresponse, testpart=part
        )
        with open("/app/dysleksi/tests/resources/test.mp3", "r") as file:
            file_obj = File(file, name="answer_123.mp3")
            cls.questionresponse = QuestionResponse.objects.create(
                question=question, partresponse=partresponse, answer_sound=file_obj
            )

    @override_settings(RESPONSE_AUDIO_RETENTION_SECONDS=0)
    def test_command(self):
        file_name = self.questionresponse.answer_sound.name
        self.assertNotEqual(file_name, "")
        self.assertTrue(os.path.exists(os.path.join(settings.MEDIA_ROOT, file_name)))
        call_command("cleanup_recordings", verbosity=0)
        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, file_name)))
        self.questionresponse.refresh_from_db()
        self.assertEqual(self.questionresponse.answer_sound.name, "")
