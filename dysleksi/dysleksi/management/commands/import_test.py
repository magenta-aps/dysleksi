# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import json
from pathlib import Path

from data_tools.utils import create_wordreading_2_test
from django.core.management.base import BaseCommand

from dysleksi.models import Test


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
            "json_path",
            type=Path,
            help="Path to the JSON file with questions",
        )

    def handle(self, *args, **options):
        name: str = options["name"]
        json_path: Path = options["json_path"]

        # Load JSON data
        with json_path.open("r", encoding="utf-8") as f:
            questions_data = json.load(f)

        test = Test.objects.get(name=name)
        create_wordreading_2_test(test, questions_data, questions_data[0:1])

        self.stdout.write(self.style.SUCCESS(f"Created test '{name}' from {json_path}"))
