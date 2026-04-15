# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
import re
from pathlib import Path

from data_tools.utils import (
    create_fore_sound_test,
    create_letter_sound_test,
    create_nonwordspelling_test,
    create_pronunciation_test,
    create_wordreading_1_test,
    create_wordreading_2_test,
    create_wordspelling_test,
)
from django.core.management.base import BaseCommand

from dysleksi.models import Test


def remove_json_comments(text):
    text = re.sub(r"//.*", "", text)  # remove single-line comments
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)  # remove block comments
    return text


class Command(BaseCommand):
    """
    Creates a Word Reading 2 test from a JSON definition

    Parameters
    -----------------
    name : str
        Name of the test to add a wordreading 2 subtest to
    json_path : str
        Path to json file which contains the test definition

    Notes
    -----------
    The json-file has the following structure:

    >>> [
    >>>     {
    >>>         "image": "wordreading_2/image4_row_1_icon.png",
    >>>         "wrong": [
    >>>             "isi",
    >>>             "illu",
    >>>             "igalaaq"
    >>>         ],
    >>>         "correct": "iga"
    >>>     },
    >>>     (...)
    >>> ]

    A json file based on real data as well as images are attached to
    https://redmine.magenta.dk/documents/382
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
            "practice_json_path",
            type=Path,
            nargs="?",
            default=None,
            help="Path to the JSON file with practice questions",
        )
        parser.add_argument(
            "test_type",
            type=str,
            help="Type of the test to create",
        )

    def handle(self, *args, **options):
        name: str = options["name"]
        testpart_name: str = options["testpart_name"]
        json_path: Path = options["json_path"]
        practice_json_path: Path | None = options["practice_json_path"]
        test_type: str = options["test_type"]

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

        test = Test.objects.get(name=name)
        if test_type == "wordreading_2":
            create_wordreading_2_test(
                test, questions_data, practice_data, name=testpart_name
            )
        elif test_type == "wordreading_1":
            create_wordreading_1_test(
                test, questions_data, practice_data, name=testpart_name
            )
        elif test_type == "wordspelling":
            create_wordspelling_test(
                test, questions_data, practice_data, name=testpart_name
            )
        elif test_type == "nonwordspelling":
            create_nonwordspelling_test(
                test, questions_data, practice_data, name=testpart_name
            )
        elif test_type == "pronunciation":
            create_pronunciation_test(
                test, questions_data, testpart_name, practice_data
            )
        elif test_type == "letter_sound":
            create_letter_sound_test(
                test, questions_data, practice_data, name=testpart_name
            )
        elif test_type == "fore_sound":
            create_fore_sound_test(
                test, questions_data, practice_data, name=testpart_name
            )
        else:
            raise ValueError("Test type is not valid")

        self.stdout.write(self.style.SUCCESS(f"Created test '{name}' from {json_path}"))
