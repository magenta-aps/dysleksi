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
    real=False,
):

    name = f"{period} {grade}. klasse".capitalize()

    if not real:
        name += " (dummy)"

    if grade >= 2:

        test, created = Test.objects.get_or_create(name=name, test_type=TestType.GROUP)

        if real:
            wordreading_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_2/wordreading_2.json",
            )
            wordreading_1_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_1/wordreading_1.json",
            )
            wordspelling_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordspelling/wordspelling.json",
            )
            nonwordspelling_data_path = None
            letter_sound_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/letter_sound/letter_sound.json",
            )
            letter_name_data_path = None
            fore_sound_data_path = None
            sentence_reading_data_path = None

            wordreading_test_name = "Ordlæsning 2A"
            wordreading_1_test_name = "Ordlæsning 1"
            wordspelling_test_name = "Ordstavning"
            nonwordspelling_test_name = "Nonordstavning"
            letter_sound_test_name = "Bogstavlyde"
            letter_name_test_name = "Bogstavnavne"
            fore_sound_test_name = "Forlyd"
            sentence_reading_test_name = "Sætningslæsning"

        else:
            wordreading_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/wordreading_2/wordreading_2a.json",
            )
            wordreading_1_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/wordreading_1/wordreading_1.json",
            )
            wordspelling_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/wordspelling/wordspelling.json",
            )
            nonwordspelling_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/nonwordspelling/nonwordspelling.json",
            )
            letter_sound_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/letter_sound/letter_sound.json",
            )
            letter_name_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/letter_name/letter_name.json",
            )
            fore_sound_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/fore_sound/fore_sound.json",
            )
            sentence_reading_data_path = (
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "dummy/sentence_reading/sentence_reading.json",
            )

            wordreading_test_name = "Ordlæsning 2A (dummy)"
            wordreading_1_test_name = "Ordlæsning 1 (dummy)"
            wordspelling_test_name = "Ordstavning (dummy)"
            nonwordspelling_test_name = "Nonordstavning (dummy)"
            letter_sound_test_name = "Bogstavlyde (dummy)"
            letter_name_test_name = "Bogstavnavne (dummy)"
            fore_sound_test_name = "Forlyd (dummy)"
            sentence_reading_test_name = "Sætningslæsning (dummy)"

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

        call_command(
            "import_test",
            name,
            wordreading_1_test_name,
            wordreading_1_data_path,
            "wordreading_1",
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_1/wordreading_1_practice.json"
            ),
        )

        call_command(
            "import_test",
            name,
            letter_sound_test_name,
            letter_sound_data_path,
            "letter_sound",
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/letter_sound/letter_sound_practice.json"
            ),
        )

        if letter_name_data_path:
            call_command(
                "import_test",
                name,
                letter_name_test_name,
                letter_name_data_path,
                "letter_name",
            )

        if fore_sound_data_path:
            call_command(
                "import_test",
                name,
                fore_sound_test_name,
                fore_sound_data_path,
                "fore_sound",
            )
        if nonwordspelling_data_path:
            call_command(
                "import_test",
                name,
                nonwordspelling_test_name,
                nonwordspelling_data_path,
                "nonwordspelling",
            )

        if sentence_reading_data_path:
            call_command(
                "import_test",
                name,
                sentence_reading_test_name,
                sentence_reading_data_path,
                "sentence_reading",
            )


def create_individual_test(real=False):

    test_name = "Individuel test"
    if not real:
        test_name += " (dummy)"
    test, created = Test.objects.get_or_create(
        name=test_name, test_type=TestType.INDIVIDUAL
    )

    if real:
        letter_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)
            / "real/letter_pronunciation/letter_pronunciation.json"
        )
        word_pronunciation_data_path = None
        nonsense_word_pronunciation_data_path = None
        letter_pronunciation_test_name = "Bogstavbenævnelse"
    else:
        letter_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)
            / "dummy/letter_pronunciation/letter_pronunciation.json"
        )
        word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)
            / "dummy/word_pronunciation/word_pronunciation.json",
        )
        nonsense_word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)
            / "dummy/nonsense_word_pronunciation/nonsense_word_pronunciation.json"
        )
        letter_pronunciation_test_name = "Bogstavbenævnelse (dummy)"
        word_pronunciation_test_name = "Højtlæsning af ord (dummy)"
        nonsense_word_pronunciation_test_name = "Højtlæsning af nonsensord (dummy)"

    call_command(
        "import_test",
        test_name,
        letter_pronunciation_test_name,
        letter_pronunciation_data_path,
        "pronunciation",
        practice_json_path=(
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/letter_pronunciation/letter_pronunciation_practice.json"
        ),
    )

    if word_pronunciation_data_path:
        call_command(
            "import_test",
            test_name,
            word_pronunciation_test_name,
            word_pronunciation_data_path,
            "pronunciation",
        )

    if nonsense_word_pronunciation_data_path:
        call_command(
            "import_test",
            test_name,
            nonsense_word_pronunciation_test_name,
            nonsense_word_pronunciation_data_path,
            "pronunciation",
        )


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def handle(self, *args, **options):
        copy_dummy_files()
        for grade in (1, 2, 3):
            for period in ("midt", "slut"):
                create_group_test(grade, period, real=False)
                create_group_test(grade, period, real=True)

        create_individual_test(real=False)
        create_individual_test(real=True)
