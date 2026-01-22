# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.utils.translation import gettext_lazy as _

from dysleksi.models import PossibleAnswer, TestPart, TestQuestion, TestResource


def create_test_resources(questions_data, part, is_practice=False):
    for data in questions_data:
        # Challenge resource (image)

        test_resource_kwargs = {"name": "challenge"}
        if "image" in data:
            test_resource_kwargs["image"] = data["image"]
        if "text" in data:
            test_resource_kwargs["text"] = data["text"]

        challenge_resource, created = TestResource.objects.get_or_create(
            **test_resource_kwargs
        )

        # Get or create question for this part + challenge
        question, created = TestQuestion.objects.get_or_create(
            part=part, challenge=challenge_resource, is_practice=is_practice
        )

        # Correct answer
        if data["correct"]:
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


def create_wordreading_2_test(
    test, questions_data, practice_questions_data=None, name="Wordreading 2"
):
    part, created = TestPart.objects.get_or_create(
        test=test,
        name=name,
        defaults={
            "timeout": 60,
            "partial_score_after": 30,
            "intro": _("Vælg det rigtige ord, der passer til billedet."),
        },
    )
    create_test_resources(questions_data, part, False)
    if practice_questions_data:
        create_test_resources(practice_questions_data, part, True)
