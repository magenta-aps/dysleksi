# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import shutil
from pathlib import Path
from typing import Literal

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from dysleksi.models import Test, TestType


def copy_dummy_files():
    for item in Path(settings.DUMMY_DATA_DIR).iterdir():
        dest = Path(settings.RESOURCE_ROOT) / "dummy" / item.name
        shutil.copytree(item, dest, dirs_exist_ok=True)

    for item in Path(settings.REAL_DATA_DIR).iterdir():
        dest = Path(settings.RESOURCE_ROOT) / item.name
        shutil.copytree(item, dest, dirs_exist_ok=True)


def create_group_test(
    grade: Literal[1, 2, 3],
    period: Literal["midt", "slut"],
):

    name = f"{period} {grade}. klasse".capitalize()

    if grade >= 2:

        test, created = Test.objects.get_or_create(name=name, test_type=TestType.GROUP)

        # A wordreading 2 test with practice run

        if settings.LOAD_REAL_WORDREADING_DATA:  # type:ignore
            wordreading_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_2/wordreading_2.json",
            )
            wordreading_test_name = "Ordlæsning 2A"
        else:
            wordreading_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/wordreading_2/wordreading_2a.json",
            )
            wordreading_test_name = "Ordlæsning 2A (dummy)"

        if settings.LOAD_REAL_WORDSPELLING_DATA:  # type:ignore
            wordspelling_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordspelling/wordspelling.json",
            )
            wordspelling_test_name = "Ordstavning"
        else:
            wordspelling_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/wordspelling/wordspelling.json",
            )
            wordspelling_test_name = "Ordstavning (dummy)"

        call_command(
            "import_test",
            name,
            wordreading_test_name,
            wordreading_data_path,
            "wordreading_2",
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_2/wordreading_2a_practice.json"
            ),
        )

        # A wordspelling test with practice run
        call_command(
            "import_test",
            name,
            wordspelling_test_name,
            wordspelling_data_path,
            "wordspelling",
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordspelling/wordspelling_practice.json"
            ),
        )


def create_individual_test():

    test_name = "Bogstavbenævnelse (dummy)"
    test, created = Test.objects.get_or_create(
        name=test_name, test_type=TestType.INDIVIDUAL
    )

    call_command(
        "import_test",
        test_name,
        "Individuel deltest (dummy)",
        Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
        / "dummy/letter_pronunciation/letter_pronunciation.json",
        "letter_pronunciation",
        practice_json_path=(
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/letter_pronunciation/letter_pronunciation_practice.json"
        ),
    )


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def handle(self, *args, **options):
        copy_dummy_files()
        for grade in (1, 2, 3):
            for period in ("midt", "slut"):
                create_group_test(grade, period)

        create_individual_test()
