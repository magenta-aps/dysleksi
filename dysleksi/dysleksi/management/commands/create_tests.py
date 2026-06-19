# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from pathlib import Path
from typing import Literal

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db.models import Count

from dysleksi.models import Class, Student, Test, TestType


def get_or_create_test(
    grade: Literal[1, 2, 3],
    period: Literal["midt", "slut"],
    test_type: TestType,
    dummy=False,
):
    name = f"{period} {grade}. klasse".capitalize()
    if dummy:
        name += " (dummy)"
    test, _ = Test.objects.get_or_create(name=name, test_type=test_type)
    return test


def make_import_test():
    """
    Returns an "import_test" method which keeps track of whether a tests contents
    were already updated while running this management command.

    This way we don't update a testparts contents multiple times in case it is featured
    in multiple tests
    """
    seen: set[str] = set()

    def import_test(test_name, sub_test_name, data_path, key, test_type, **kwargs):
        update_contents = key not in seen
        seen.add(key)
        call_command(
            "import_test",
            test_name,
            sub_test_name,
            data_path,
            key,
            test_type,
            update_contents=update_contents,
            **kwargs,
        )

    return import_test


def create_group_test(
    grade: Literal[1, 2, 3],
    period: Literal["midt", "slut"],
    import_test,
    dummy=False,
):
    test = get_or_create_test(grade, period, TestType.GROUP, dummy=dummy)

    if dummy:
        wordreading_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/wordreading_2/wordreading_2.json",
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
        fore_sound_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/fore_sound/fore_sound.json",
        )
        sentence_reading_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/sentence_reading/sentence_reading.json",
        )
        letter_shape_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/letter_shape/letter_shape.json",
        )

        wordreading_test_name = "Ordlæsning 2 (dummy)"
        wordreading_1_test_name = "Ordlæsning 1 (dummy)"
        wordspelling_test_name = "Ordstavning (dummy)"
        nonwordspelling_test_name = "Nonordstavning (dummy)"
        letter_sound_test_name = "Bogstavlyde (dummy)"
        fore_sound_test_name = "Forlyd (dummy)"
        sentence_reading_test_name = "Sætningslæsning (dummy)"
        letter_shape_test_name = "Bogstavers form (dummy)"
    else:
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
        nonwordspelling_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/nonwordspelling/nonwordspelling.json",
        )
        letter_sound_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/letter_sound/letter_sound.json",
        )
        fore_sound_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/fore_sound/fore_sound.json",
        )
        sentence_reading_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/sentence_reading/sentence_reading.json",
        )
        letter_shape_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/letter_shape/letter_shape.json",
        )

        wordreading_test_name = "Ordlæsning 2"
        wordreading_1_test_name = "Ordlæsning 1"
        wordspelling_test_name = "Ordstavning"
        nonwordspelling_test_name = "Nonordstavning"
        letter_sound_test_name = "Bogstavlyde"
        fore_sound_test_name = "Forlyd"
        sentence_reading_test_name = "Sætningslæsning"
        letter_shape_test_name = "Bogstavers form"

    if grade == 1:
        import_test(
            test.name,
            letter_sound_test_name,
            letter_sound_data_path,
            "letter_sound",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/letter_sound/letter_sound_practice.json"
            ),
        )

        import_test(
            test.name,
            fore_sound_test_name,
            fore_sound_data_path,
            "fore_sound",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/fore_sound/fore_sound_practice.json"
            ),
        )

        import_test(
            test.name,
            letter_shape_test_name,
            letter_shape_data_path,
            "letter_shape",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/letter_shape/letter_shape_practice.json"
            ),
        )

    if (grade == 1 and period == "slut") or (grade == 2 and period == "midt"):
        import_test(
            test.name,
            nonwordspelling_test_name,
            nonwordspelling_data_path,
            "nonwordspelling",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/nonwordspelling/nonwordspelling_practice.json"
            ),
        )

    if grade == 1 and period == "slut":
        import_test(
            test.name,
            wordreading_1_test_name,
            wordreading_1_data_path,
            "wordreading_1",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_1/wordreading_1_practice.json"
            ),
        )

    if grade >= 2:
        import_test(
            test.name,
            wordspelling_test_name,
            wordspelling_data_path,
            "wordspelling",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordspelling/wordspelling_practice.json"
            ),
        )

        import_test(
            test.name,
            wordreading_test_name,
            wordreading_data_path,
            "wordreading_2",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/wordreading_2/wordreading_2_practice.json"
            ),
        )

    if (grade == 2 and period == "slut") or grade == 3:
        import_test(
            test.name,
            sentence_reading_test_name,
            sentence_reading_data_path,
            "sentence_reading",
            TestType.GROUP,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/sentence_reading/sentence_reading_practice.json"
            ),
        )

    return test


def create_individual_test(
    grade: Literal[1, 2, 3],
    period: Literal["midt", "slut"],
    import_test,
    dummy=False,
):
    test = get_or_create_test(grade, period, TestType.INDIVIDUAL, dummy=dummy)

    if dummy:
        letter_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/letter_pronunciation/letter_pronunciation.json"
        )
        word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/word_pronunciation/word_pronunciation.json",
        )
        nonsense_word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "dummy/nonsense_word_pronunciation/nonsense_word_pronunciation.json"
        )
        letter_pronunciation_test_name = "Bogstavbenævnelse (dummy)"
        word_pronunciation_test_name = "Højtlæsning af ord (dummy)"
        nonsense_word_pronunciation_test_name = "Højtlæsning af nonsensord (dummy)"
    else:
        letter_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/letter_pronunciation/letter_pronunciation.json"
        )
        word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/word_pronunciation/word_pronunciation.json"
        )
        nonsense_word_pronunciation_data_path = (
            Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
            / "real/nonsense_word_pronunciation/nonsense_word_pronunciation.json"
        )
        letter_pronunciation_test_name = "Bogstavbenævnelse"
        word_pronunciation_test_name = "Højtlæsning af ord"
        nonsense_word_pronunciation_test_name = "Højtlæsning af nonsensord"

    # Test packages:
    # Midt 1. klasse: Bogstavbenævnelse
    # Slut 1. klasse: Bogstavbenævnelse + Højtlæsning af ord + Højtlæsning af nonsensord
    # Midt 2. klasse: Højtlæsning af ord + Højtlæsning af nonsensord
    # Slut 2. klasse: Højtlæsning af ord + Højtlæsning af nonsensord
    # Midt 3. klasse: Højtlæsning af ord + Højtlæsning af nonsensord
    # Slut 3. klasse: Højtlæsning af ord + Højtlæsning af nonsensord

    if grade == 1:
        # Bogstavbenævnelse
        import_test(
            test.name,
            letter_pronunciation_test_name,
            letter_pronunciation_data_path,
            "letter_pronunciation",
            TestType.INDIVIDUAL,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/letter_pronunciation/letter_pronunciation_practice.json"
            ),
        )

    if (grade == 1 and period == "slut") or grade >= 2:
        # Højtlæsning af ord
        import_test(
            test.name,
            word_pronunciation_test_name,
            word_pronunciation_data_path,
            "word_pronunciation",
            TestType.INDIVIDUAL,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / "real/word_pronunciation/word_pronunciation_practice.json"
            ),
        )

        # Højtlæsning af nonsensord
        import_test(
            test.name,
            nonsense_word_pronunciation_test_name,
            nonsense_word_pronunciation_data_path,
            "nonsense_word_pronunciation",
            TestType.INDIVIDUAL,
            practice_json_path=(
                Path(settings.INSTRUCTIONS_ROOT)  # type:ignore
                / (
                    "real/nonsense_word_pronunciation/"
                    "nonsense_word_pronunciation_practice.json"
                )
            ),
        )

    return test


def answer_test(test):
    if test.test_type == TestType.GROUP:
        klasse = (
            Class.objects.annotate(students_count=Count("students"))
            .filter(students_count__gt=0)
            .order_by("?")
            .first()
        )
        if klasse is not None:
            call_command("answer_test", test.pk, **{"class": klasse.pk})
    else:
        student = Student.objects.all().order_by("?").first()
        if student is not None:
            call_command("answer_test", test.pk, student=student.pk)


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--answer",
            action="store_true",
            help="also create dummy test answers",
        )
        parser.add_argument(
            "--dummy",
            action="store_true",
            help="Creates tests with dummy data",
        )

    def handle(self, *args, **options):
        dummy = options["dummy"]
        create_answers = options["answer"]
        import_test = make_import_test()
        for grade in (1, 2, 3):
            for period in ("midt", "slut"):
                test = create_group_test(grade, period, import_test, dummy=dummy)
                if create_answers and test is not None:
                    answer_test(test)

                test = create_individual_test(grade, period, import_test, dummy=dummy)
                if create_answers and test is not None:
                    answer_test(test)
