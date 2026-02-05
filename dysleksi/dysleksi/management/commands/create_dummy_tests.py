# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from typing import Literal

from django.core.management import call_command
from django.core.management.base import BaseCommand

from dysleksi.models import Test, TestType


def create_group_test(
    grade: Literal[1, 2, 3],
    period: Literal["midt", "slut"],
):

    name = f"{period} {grade}. klasse".capitalize()

    if grade >= 2:

        test, created = Test.objects.get_or_create(name=name, test_type=TestType.GROUP)

        # A wordreading 2 test with practice run
        call_command(
            "import_test",
            name,
            "Ordlæsning 2A (dummy)",
            "/upload/wordreading_2_dummy/wordreading_2a.json",
            "wordreading_2",
            practice_json_path=(
                "/upload/wordreading_2_dummy/wordreading_2a_practice.json"
            ),
        )

        # A wordreading 2 test without practice run
        call_command(
            "import_test",
            name,
            "Ordlæsning 2B (dummy)",
            "/upload/wordreading_2_dummy/wordreading_2b.json",
            "wordreading_2",
        )

        # A wordspelling test with practice run
        call_command(
            "import_test",
            name,
            "Ordstavning (dummy)",
            "/upload/wordspelling_dummy/wordspelling.json",
            "wordspelling",
            practice_json_path="/upload/wordspelling_dummy/wordspelling_practice.json",
        )


def create_individual_test():

    test_name = "Individuel test (dummy)"
    test, created = Test.objects.get_or_create(
        name=test_name, test_type=TestType.INDIVIDUAL
    )

    call_command(
        "import_test",
        test_name,
        "Individuel deltest (dummy)",
        "/upload/letter_pronunciation_dummy/letter_pronunciation.json",
        "letter_pronunciation",
    )


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def handle(self, *args, **options):
        for grade in (1, 2, 3):
            for period in ("midt", "slut"):
                create_group_test(grade, period)

        create_individual_test()
