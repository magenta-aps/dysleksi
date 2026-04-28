# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from dysleksi.models import TestPart, TestResource


def create_wordreading_2_test(
    test, questions_data, practice_questions_data=None, name="Ordlæsning 2"
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordreading_2/Deltests/7e.2.wav",
        sound="resources/wordreading_2/Deltests/7e.2.wav",
    )
    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 600000,  # 600 seconds / 10 minutes
            "partial_score_after": 300000,  # 300 seconds / 5 minutes
            "reminder": 20000,  # 20 seconds
            "image_url": "/static/images/wordreading.png",
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_wordreading_1_test(
    test, questions_data, practice_questions_data=None, name="Ordlæsning 1"
):

    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordreading_1/Deltest/5e.2.wav",
        sound="resources/wordreading_1/Deltest/5e.2.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 360000,  # 360 seconds / 6 minutes
            "partial_score_after": 120000,  # 120 seconds / 2 minutes
            "image_url": "/static/images/wordreading_1.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_fore_sound_test(
    test, questions_data, practice_questions_data=None, name="Forlyd"
):

    # TODO: Add this sound to dysleksi-binaries when we receive it
    reminder, created = TestResource.objects.get_or_create(
        name="resources/fore_sound/Deltests/xxx.wav",
        sound="resources/fore_sound/Deltests/xxx.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 360000,  # 360 seconds / 6 minutes
            "partial_score_after": 120000,  # 120 seconds / 2 minutes
            "image_url": "/static/images/fore_sound.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_letter_sound_test(
    test, questions_data, practice_questions_data=None, name="Bogstavlyde"
):

    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_sound/Deltest/1e.2.wav",
        sound="resources/letter_sound/Deltest/1e.2.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 0,
            "image_url": "/static/images/letter_sound.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_letter_name_test(
    test, questions_data, practice_questions_data=None, name="Bogstavnavne"
):

    # TODO: Replace with actual reminder sound when we get it
    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_name/Deltest/xx.x.wav",
        sound="resources/letter_name/Deltest/xx.x.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 0,
            "image_url": "/static/images/letter_name.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_letter_shape_test(
    test, questions_data, practice_questions_data=None, name="Bogstavers form"
):

    # TODO: Replace with actual reminder sound when we get it
    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_shape/Deltest/xx.x.wav",
        sound="resources/letter_shape/Deltest/xx.x.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 0,
            "image_url": "/static/images/letter_shape.png",
            "reminder": 10000,  # 15 seconds
            "reminder_source": reminder,
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
    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordspelling/Øveopgave/6e.1.wav",
        sound="resources/wordspelling/Øveopgave/6e.1.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,  # no timeout
            "partial_score_after": 0,  # no partial score (?)
            "image_url": "/static/images/wordspelling.png",
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_nonwordspelling_test(
    test, questions_data, practice_questions_data=None, name="Nonordstavning"
):
    # TODO: Add this sound to dysleksi-binaries when we receive it
    reminder, created = TestResource.objects.get_or_create(
        name="resources/nonwordspelling/Øveopgave/xx.x.wav",
        sound="resources/nonwordspelling/Øveopgave/xx.x.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,  # no timeout
            "partial_score_after": 0,  # no partial score (?)
            "image_url": "/static/images/nonwordspelling.png",
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_pronunciation_test(test, questions_data, name, practice_questions_data=None):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_pronunciation/Deltests/9e.1.wav",
        sound="resources/letter_pronunciation/Deltests/9e.1.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 30000,
            "image_url": "/static/images/letter_pronunciation.png",
            "reminder_source": reminder,
        },
    )
    if created:  # pragma: no branch
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)


def create_sentence_reading_test(
    test, questions_data, practice_questions_data=None, name="Sætningslæsning"
):
    # TODO: Add this sound to dysleksi-binaries when we receive it
    reminder, created = TestResource.objects.get_or_create(
        name="resources/sentence_reading/Øveopgave/xx.x.wav",
        sound="resources/sentence_reading/Øveopgave/xx.x.wav",
    )

    part, created = TestPart.objects.get_or_create(
        name=name,
        defaults={
            "timeout": 8 * 60 * 1000,  # 8 minutes
            "partial_score_after": 4 * 60 * 1000,  # 4 minutes
            "image_url": "/static/images/sentence_reading.png",
            "reminder_source": reminder,
        },
    )
    if created:
        part.create_test_resources(questions_data, False)
        if practice_questions_data:
            part.create_test_resources(practice_questions_data, True)
    test.parts.add(part)
