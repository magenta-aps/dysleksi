# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from typing import Literal

from django.core.management.base import BaseCommand
from django.utils.translation import gettext_lazy as _

from dysleksi.models import Test
from dysleksi.utils import create_wordreading_2_test


def create_group_test(
    grade: Literal[1, 2, 3],
    period: Literal["middle", "end"],
):

    name = f"{period} {grade}. grade".capitalize()

    test, created = Test.objects.get_or_create(name=name)

    questions_data = [
        {
            "image": "wordreading_2_dummy/dog.png",
            "correct": _("hund"),
            "wrong": [_("kat"), _("ko"), _("hest")],
        },
        {
            "image": "wordreading_2_dummy/bike.jpeg",
            "correct": _("cykel"),
            "wrong": [_("bil"), _("bus"), _("tog")],
        },
        {
            "image": "wordreading_2_dummy/cat.jpg",
            "correct": _("kat"),
            "wrong": [_("hund"), _("mus"), _("fugl")],
        },
        {
            "image": "wordreading_2_dummy/house.jpg",
            "correct": _("hus"),
            "wrong": [_("bil"), _("træ"), _("vej")],
        },
        {
            "image": "wordreading_2_dummy/car.jpg",
            "correct": _("bil"),
            "wrong": [_("cykel"), _("tog"), _("bus")],
        },
    ]

    if grade in {2, 3}:
        create_wordreading_2_test(test, questions_data, name="Wordreading 2 (dummy)")

    return test


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def handle(self, *args, **options):
        for grade in (1, 2, 3):
            for period in ("middle", "end"):
                create_group_test(grade, period)
