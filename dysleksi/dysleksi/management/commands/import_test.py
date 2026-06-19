# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import re
from pathlib import Path

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
    update_or_create_wordreading_2_test,
    update_or_create_wordspelling_test,
)
from django.core.management.base import BaseCommand

from dysleksi.models import Test


def remove_json_comments(text):
    text = re.sub(r"//.*", "", text)  # remove single-line comments
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)  # remove block comments
    return text


class Command(BaseCommand):
    """
    Creates or updates a test from a JSON definition
    """

    def add_arguments(self, parser):
        parser.add_argument(
            "name",
            type=str,
            help="Name of the test to create",
        )
        parser.add_argument(
            "testpart_name",
            type=str,
            help="Name of the test part to create",
        )
        parser.add_argument(
            "json_path",
            type=Path,
            help="Path to the JSON file with questions",
        )
        parser.add_argument(
            "test_code_name",
            type=str,
            help="Codename of the test to create (e.g. 'wordreading_2')",
        )
        parser.add_argument(
            "test_type",
            type=str,
            help="Type of the test to create (e.g. 'group')",
        )
        parser.add_argument(
            "practice_json_path",
            type=Path,
            nargs="?",
            default=None,
            help="Path to the JSON file with practice questions",
        )
        parser.add_argument(
            "update_contents",
            type=bool,
            nargs="?",
            default=True,
            help="Whether to update test-contents",
        )

    def handle(self, *args, **options):
        name: str = options["name"]
        testpart_name: str = options["testpart_name"]
        json_path: Path = options["json_path"]
        test_code_name: str = options["test_code_name"]
        test_type: str = options["test_type"]
        practice_json_path: Path | None = options["practice_json_path"]
        update_contents: bool = options["update_contents"]

        # Load JSON data
        with json_path.open("r", encoding="utf-8") as f:
            content = f.read()
            content = remove_json_comments(content)
            questions_data = json.loads(content)

        practice_data = None
        if practice_json_path is not None:
            with Path(practice_json_path).open("r", encoding="utf-8") as f:
                content = f.read()
                content = remove_json_comments(content)
                practice_data = json.loads(content)

        test = Test.objects.get(name=name, test_type=test_type)

        if test_code_name == "wordreading_2":
            update_or_create_wordreading_2_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "wordreading_1":
            update_or_create_wordreading_1_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "wordspelling":
            update_or_create_wordspelling_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "nonwordspelling":
            update_or_create_nonwordspelling_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "letter_pronunciation":
            update_or_create_letter_pronunciation_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "word_pronunciation":
            update_or_create_word_pronunciation_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "nonsense_word_pronunciation":
            update_or_create_nonsense_word_pronunciation_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "letter_sound":
            update_or_create_letter_sound_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "fore_sound":
            update_or_create_fore_sound_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "sentence_reading":
            update_or_create_sentence_reading_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )
        elif test_code_name == "letter_shape":
            update_or_create_letter_shape_test(
                test,
                questions_data,
                practice_data,
                name=testpart_name,
                update_contents=update_contents,
            )

        else:
            raise ValueError("Test type is not valid")

        self.stdout.write(self.style.SUCCESS(f"Created test '{name}' from {json_path}"))
