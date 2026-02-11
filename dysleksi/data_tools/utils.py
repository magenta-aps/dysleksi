# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.utils.translation import gettext_lazy as _

from dysleksi.models import TestPart


def create_wordreading_2_test(
    test, questions_data, practice_questions_data=None, name="Ordlæsning 2"
):
    part, created = TestPart.objects.get_or_create(
        test=test,
        name=name,
        defaults={
            "timeout": 60000,  # 60 seconds
            "partial_score_after": 30000,  # 30 seconds
            "intro": _("Vælg det rigtige ord, der passer til billedet."),
            "reminder": 20000,  # 20 seconds
        },
    )
    part.create_test_resources(questions_data, False)
    if practice_questions_data:
        part.create_test_resources(practice_questions_data, True)


def create_wordspelling_test(
    test, questions_data, practice_questions_data=None, name="Ordstavning"
):
    part, created = TestPart.objects.get_or_create(
        test=test,
        name=name,
        defaults={
            "timeout": 60000,
            "partial_score_after": 30000,
            "intro": _("Stav ordet som du hører."),
        },
    )
    part.create_test_resources(questions_data, False)
    if practice_questions_data:
        part.create_test_resources(practice_questions_data, True)


def create_letter_pronunciation_test(
    test, questions_data, practice_questions_data=None, name="Ordbenævnelse"
):
    part, created = TestPart.objects.get_or_create(
        test=test,
        name=name,
        defaults={
            "timeout": 60000,
            "partial_score_after": 30000,
            "intro": _("Sig bogstavet på skærmen højt"),
        },
    )
    part.create_test_resources(questions_data, False)
    if practice_questions_data:
        part.create_test_resources(practice_questions_data, True)
