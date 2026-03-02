# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.utils.translation import gettext_lazy as _

from dysleksi.models import TestPart


def create_wordreading_2_test(
    test, questions_data, practice_questions_data=None, name="Ordlæsning 2"
):
    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 600000,  # 600 seconds / 10 minutes
            "partial_score_after": 300000,  # 300 seconds / 5 minutes
            "intro": _("Vælg det rigtige ord, der passer til billedet."),
            "reminder": 20000,  # 20 seconds
            "image_url": "/static/images/wordreading.png",
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_wordspelling_test(
    test, questions_data, practice_questions_data=None, name="Ordstavning"
):
    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,  # no timeout
            "partial_score_after": 0,  # no partial score (?)
            "intro": _("Stav ordet som du hører."),
            "image_url": "/static/images/wordspelling.png",
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_letter_pronunciation_test(
    test, questions_data, practice_questions_data=None, name="Bogstavbenævnelse"
):
    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 30000,
            "intro": _("Sig bogstavet på skærmen højt"),
            "image_url": "/static/images/letter_pronunciation.png",
        },
    )
    if created:  # pragma: no branch
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)
