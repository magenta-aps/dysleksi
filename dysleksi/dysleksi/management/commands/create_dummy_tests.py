# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from typing import Literal

from django.core.management.base import BaseCommand
from django.utils.translation import gettext_lazy as _

from dysleksi.models import PossibleAnswer, Test, TestPart, TestQuestion, TestResource


def create_wordreading_2_test(test):
    part, created = TestPart.objects.get_or_create(
        test=test,
        name="Wordreading 2",
        defaults={
            "timeout": 60,
            "partial_score_after": 30,
            "intro": _("Vælg det rigtige ord, der passer til billedet."),
        },
    )

    questions_data = [
        {
            "image": "wordreading_2/dog.png",
            "correct": _("hund"),
            "wrong": [_("kat"), _("ko"), _("hest")],
        },
        {
            "image": "wordreading_2/bike.jpeg",
            "correct": _("cykel"),
            "wrong": [_("bil"), _("bus"), _("tog")],
        },
        {
            "image": "wordreading_2/cat.jpg",
            "correct": _("kat"),
            "wrong": [_("hund"), _("mus"), _("fugl")],
        },
        {
            "image": "wordreading_2/house.jpg",
            "correct": _("hus"),
            "wrong": [_("bil"), _("træ"), _("vej")],
        },
        {
            "image": "wordreading_2/car.jpg",
            "correct": _("bil"),
            "wrong": [_("cykel"), _("tog"), _("bus")],
        },
    ]

    for data in questions_data:
        # Challenge resource (image)
        challenge_resource, created = TestResource.objects.get_or_create(
            name=data["correct"],
            image=data["image"],
        )

        # Get or create question for this part + challenge
        question, created = TestQuestion.objects.get_or_create(
            part=part,
            challenge=challenge_resource,
        )

        # Correct answer
        correct_resource, created = TestResource.objects.get_or_create(
            name=data["correct"],
            text=data["correct"],
        )

        PossibleAnswer.objects.get_or_create(
            question=question,
            resource=correct_resource,
            defaults={"is_correct": True},
        )

        # Wrong answers
        for wrong_text in data["wrong"]:
            wrong_resource, created = TestResource.objects.get_or_create(
                name=wrong_text,
                text=wrong_text,
            )

            PossibleAnswer.objects.get_or_create(
                question=question,
                resource=wrong_resource,
                defaults={"is_correct": False},
            )


def create_group_test(
    grade: Literal[1, 2, 3],
    period: Literal["middle", "end"],
):

    name = f"{period} {grade}. grade".capitalize()

    test, created = Test.objects.get_or_create(name=name)

    if grade in {2, 3}:
        create_wordreading_2_test(test)

    return test


class Command(BaseCommand):
    help = "Create group tests for grades 1–3 (middle and end)"

    def handle(self, *args, **options):
        for grade in (1, 2, 3):
            for period in ("middle", "end"):
                create_group_test(grade, period)
