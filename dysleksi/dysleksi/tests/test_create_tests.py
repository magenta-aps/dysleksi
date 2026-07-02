# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
import random
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.core.management import call_command
from django.test.utils import override_settings

from dysleksi.management.commands.import_test import remove_json_comments
from dysleksi.management.commands.update_or_create_tests import answer_test
from dysleksi.models import Class, QuestionResponse, Student, Test, TestPart, TestType
from dysleksi.tests.base import DysleksiTest


class CreateTests(DysleksiTest):

    @classmethod
    def setUpTestData(cls):
        """Runs once for the entire class."""
        super().setUpTestData()
        random.seed(42)

        # copy JSON files to temporary directory
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls.instruction_path = Path(cls._tmpdir.name) / "instructions"
        shutil.copytree(settings.INSTRUCTIONS_ROOT, cls.instruction_path)
        cls.addClassCleanup(cls._tmpdir.cleanup)

        cls._override = override_settings(INSTRUCTIONS_ROOT=str(cls.instruction_path))
        cls._override.enable()
        cls.addClassCleanup(cls._override.disable)

        call_command("create_groups")
        call_command("create_dummy_classes_and_users")
        call_command("update_or_create_tests")
        call_command("update_or_create_tests", dummy=True, answer=True)

        base_json_path = cls.instruction_path / "real"

        cls.test_name_dict = {
            "nonsense_word_pronunciation": "Højtlæsning af nonsensord",
            "word_pronunciation": "Højtlæsning af ord",
            "letter_pronunciation": "Bogstavbenævnelse",
            "sentence_reading": "Sætningslæsning",
            "wordreading_2": "Ordlæsning 2",
            "wordspelling": "Ordstavning",
            "wordreading_1": "Ordlæsning 1",
            "nonwordspelling": "Nonordstavning",
            "letter_shape": "Bogstavers form",
            "fore_sound": "Forlyd",
            "letter_sound": "Bogstavlyde",
        }

        cls.json_data = {}
        cls.json_paths = {}

        for test in cls.test_name_dict.keys():
            cls.json_paths[f"{test}"] = base_json_path / test / f"{test}.json"
            cls.json_paths[f"{test}_practice"] = (
                base_json_path / test / f"{test}_practice.json"
            )

        for json_filename, json_path in cls.json_paths.items():
            cls.json_data[json_filename] = cls.load_json_file(cls, json_path)

    def load_json_file(self, json_path):
        return json.loads(remove_json_comments(json_path.read_text(encoding="utf-8")))

    def save_json_file(self, json_path, data):
        json_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def save_json_files(self):
        for key, path in self.json_paths.items():
            self.save_json_file(path, self.json_data[key])

    def get_json_part(self, key):
        test_name = self.test_name_dict[key]
        return TestPart.objects.get(name=test_name).to_json(
            self.test_assignment_student
        )

    def snapshot(self):
        # Serialize every row of every model, ordered by pk so the comparison
        # is stable. Captures field values too, not just row counts.
        models = list(apps.get_app_config("dysleksi").get_models())
        return {
            model._meta.label: serializers.serialize(
                "json", model.objects.all().order_by("pk")
            )
            for model in models
        }

    def test_dummy_data_creation(self):
        # We expect exactly one "word reading 2" test part, which is reused/referenced
        # across the four available group tests ("Midt 2. klasse", "Slut 2. klasse",
        # "Midt 3. klasse", "Slut 3. klasse".) In actual test data, we would expect the
        # different tests to have different test parts.
        word_reading_2_test_parts = TestPart.objects.filter(name="Ordlæsning 2 (dummy)")
        self.assertEqual(word_reading_2_test_parts.count(), 1)

    def test_real_dummy_data_creation(self):
        word_reading_2_test = TestPart.objects.filter(name="Ordlæsning 2").first()
        wordspelling_test = TestPart.objects.filter(name="Ordstavning").first()

        self.assertEqual(word_reading_2_test.questions.count(), 105)
        self.assertEqual(wordspelling_test.questions.count(), 25)

    def test_dummy_user_creation(self):
        self.assertTrue(
            Student.objects.filter(first_name="Elev", last_name="Elevsen").exists()
        )

        amount_of_students = Student.objects.all().count()

        # Validate that running dummy user creation twice does not crash the code
        call_command("create_dummy_classes_and_users")
        self.assertEqual(amount_of_students, Student.objects.all().count())

    def test_dummy_test_answers_creation(self):
        word_reading_2_test: TestPart = TestPart.objects.filter(
            name="Ordlæsning 2"
        ).first()

        students_participating: int = sum(
            [
                assignment.klasse.students.count()
                for test in word_reading_2_test.tests.all()
                for assignment in test.testassignment_set.all()
            ]
        )
        question_count: int = word_reading_2_test.questions.count()
        self.assertEqual(
            word_reading_2_test.partresponses.count(), students_participating
        )
        self.assertEqual(
            QuestionResponse.objects.filter(
                partresponse__testpart_id=word_reading_2_test.pk
            ).count(),
            students_participating * question_count,
        )

    def test_dummy_test_answers_creation_no_classes_or_students(self):
        word_reading_2_test: TestPart = TestPart.objects.filter(
            name="Ordlæsning 2"
        ).first()

        self.assertEqual(word_reading_2_test.partresponses.count(), 0)
        self.assertEqual(
            QuestionResponse.objects.filter(
                partresponse__testpart_id=word_reading_2_test.pk
            ).count(),
            0,
        )

    def test_idempotency(self):
        """
        Notes
        -------
        Idempotent means an operation produces the same result whether you apply it
        once or many times. Running it repeatedly doesn't change anything beyond
        the first successful application.
        """
        # Take a database snapshot
        before = self.snapshot()

        # Run the create_tests management command again
        call_command("update_or_create_tests")

        # Validate that NOTHING has changed
        after = self.snapshot()

        for label in before:
            self.assertEqual(
                before[label],
                after[label],
                msg=(
                    "update_or_create_tests is not idempotent: "
                    f"{label} changed on re-run"
                ),
            )

    def test_update_test(self):

        # 1. Change the timing on an instruction
        self.json_data["nonsense_word_pronunciation_practice"][0][
            "instruction_sequence"
        ][0]["delayAfter"] = 9999

        # 2. Exchange a question challenge picture
        self.json_data["wordreading_2"][0]["image"] = "exchanged_challenge_image.jpg"

        # 3. Exchange a question answer picture
        self.json_data["wordreading_1"][0]["wrong"][0] = "exchanged_question_image.jpg"

        # 4. Exchange a question challenge sound file
        self.json_data["wordspelling"][1]["sound"] = "exchanged_challenge_sound.mp3"

        # 5. Add an instruction in between two existing instructions
        self.json_data["letter_sound_practice"][0]["instruction_sequence"].insert(
            3, {"action": "fadeIn", "delayAfter": 1337, "element": "challenge-image"}
        )

        # 6. Remove a bunch of questions from a test
        self.json_data["sentence_reading"] = self.json_data["sentence_reading"][:10]

        # 7. Change the order of multiple-choice answers
        self.assertEqual(self.json_data["wordreading_2"][1]["wrong"][0], "ukaleq")
        self.assertEqual(self.json_data["wordreading_2"][1]["wrong"][1], "umiaq")
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][1]["possible_answers"][0][
                "resource_text"
            ],
            "ukaleq",
        )
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][1]["possible_answers"][1][
                "resource_text"
            ],
            "umiaq",
        )
        self.json_data["wordreading_2"][1]["wrong"][0] = "umiaq"
        self.json_data["wordreading_2"][1]["wrong"][1] = "ukaleq"

        # 8. Change the index of the correct answer
        self.assertEqual(self.json_data["wordreading_2"][2]["correct_index"], 2)
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][2]["possible_answers"][0][
                "correctness"
            ],
            "wrong",
        )
        self.json_data["wordreading_2"][2]["correct_index"] = 0

        # 9. Correct a typo
        self.assertEqual(self.json_data["wordreading_2"][3]["wrong"][0], "appa")
        self.json_data["wordreading_2"][3]["wrong"][0] = "apa"

        self.save_json_files()

        # Create tests again
        call_command("update_or_create_tests")

        # 1. Assert that the timing changed
        self.assertEqual(
            self.get_json_part("nonsense_word_pronunciation")["practice"][0][
                "instruction_sequence"
            ]["instructions"][0]["delayAfter"],
            9999,
        )

        # 2. Assert that the image was replaced
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][0]["challenge_image_url"],
            "/media/exchanged_challenge_image.jpg",
        )

        # 3. Assert that the image was replaced
        self.assertIn(
            "/media/exchanged_question_image.jpg",
            [
                p["resource_image_url"]
                for p in self.get_json_part("wordreading_1")["questions"][0][
                    "possible_answers"
                ]
            ],
        )
        self.assertEqual(
            len(
                self.get_json_part("wordreading_1")["questions"][0]["possible_answers"]
            ),
            4,
        )

        # 4. Assert that the sound file was replaced
        self.assertEqual(
            self.get_json_part("wordspelling")["questions"][1]["challenge_sound_url"],
            "/media/exchanged_challenge_sound.mp3",
        )

        # 5. Assert that the instruction is inserted in the correct place
        self.assertEqual(
            self.get_json_part("letter_sound")["practice"][0]["instruction_sequence"][
                "instructions"
            ][3]["delayAfter"],
            1337,
        )

        # 6. Validate that the questions were removed
        self.assertEqual(len(self.get_json_part("sentence_reading")["questions"]), 10)

        # 7. Validate that the multiple-choice answer order was updated
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][1]["possible_answers"][0][
                "resource_text"
            ],
            "umiaq",
        )
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][1]["possible_answers"][1][
                "resource_text"
            ],
            "ukaleq",
        )

        # 8. Validate that the correct answer is the first answer now
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][2]["possible_answers"][0][
                "correctness"
            ],
            "correct",
        )

        # 9. Validate that the typo was corrected
        self.assertEqual(
            self.get_json_part("wordreading_2")["questions"][3]["possible_answers"][0][
                "resource_text"
            ],
            "apa",
        )
        self.assertEqual(
            len(
                self.get_json_part("wordreading_2")["questions"][3]["possible_answers"]
            ),
            4,
        )

    def test_answer_test(self):

        pk = Test.objects.filter(test_type=TestType.GROUP).first().pk
        with patch("builtins.print") as mock_print:
            call_command("answer_test", pk)
            mock_print.assert_called_with("Must specify --class for a group test")

        pk = Test.objects.filter(test_type=TestType.INDIVIDUAL).first().pk
        with patch("builtins.print") as mock_print:
            call_command("answer_test", pk)
            mock_print.assert_called_with(
                "Must specify --student for an individual test"
            )

    @patch("dysleksi.management.commands.update_or_create_tests.call_command")
    def test_answer_test_if_no_student(self, mock_call_command):
        Student.objects.all().delete()
        test = Test.objects.filter(test_type=TestType.INDIVIDUAL).first()

        answer_test(test)
        mock_call_command.assert_not_called()

    @patch("dysleksi.management.commands.update_or_create_tests.call_command")
    def test_answer_test_if_no_class(self, mock_call_command):
        Class.objects.all().delete()
        test = Test.objects.filter(test_type=TestType.GROUP).first()

        answer_test(test)
        mock_call_command.assert_not_called()
