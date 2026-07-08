# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from dysleksi.models import TestPart, TestResource


def update_or_create_wordreading_2_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Ordlæsning 2",
    update_contents=True,
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordreading_2/Enhanced/Deltest/7e.2.mp3",
        sound="resources/wordreading_2/Enhanced/Deltest/7e.2.mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/wordreading_2/Enhanced/Deltest/7e.3.mp3",
        sound="resources/wordreading_2/Enhanced/Deltest/7e.3.mp3",
    )
    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 600000,  # 600 seconds / 10 minutes
            "partial_score_after": 300000,  # 300 seconds / 5 minutes
            "reminder": 15000,  # 15 seconds
            "image_url": "/media/resources/wordreading_2/wordreading_2.png",
            "reminder_source": reminder,
            "completion_source": completion,
            "show_normscore_speed_plot": True,
        },
    )

    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)
        part.set_data_breakdown_ranges(
            "answer_time_data_breakdown", [(None, 5), (5, None)]
        )
        part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(3, 4), (5, 6), (7, 8), (9, 11), (12, 15)]
        )
    if created:
        test.parts.add(part)


def update_or_create_wordreading_1_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Ordlæsning 1",
    update_contents=True,
):

    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordreading_1/Enhanced/Deltest/5e.5 (Ny).mp3",
        sound="resources/wordreading_1/Enhanced/Deltest/5e.5 (Ny).mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/wordreading_1/Enhanced/Deltest/5e.3.mp3",
        sound="resources/wordreading_1/Enhanced/Deltest/5e.3.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 360000,  # 360 seconds / 6 minutes
            "partial_score_after": 120000,  # 120 seconds / 2 minutes
            "image_url": "/media/resources/wordreading_1/wordreading_1.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
            "completion_source": completion,
            "show_normscore_speed_plot": True,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

        part.set_data_breakdown_ranges(
            "answer_time_data_breakdown", [(None, 5), (5, None)]
        )
        part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(3, 4), (5, 6), (7, 8), (9, 11), (12, 15)]
        )
    if created:
        test.parts.add(part)


def update_or_create_fore_sound_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Forlyd",
    update_contents=True,
):

    reminder, created = TestResource.objects.get_or_create(
        name="resources/fore_sound/Enhanced/Øveopgave 1 og 2/2e.2.mp3",
        sound="resources/fore_sound/Enhanced/Øveopgave 1 og 2/2e.2.mp3",
    )

    completion, created = TestResource.objects.get_or_create(
        name="resources/fore_sound/Enhanced/Deltests/2e.3.mp3",
        sound="resources/fore_sound/Enhanced/Deltests/2e.3.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 360000,  # 360 seconds / 6 minutes
            "partial_score_after": 120000,  # 120 seconds / 2 minutes
            "image_url": "/media/resources/fore_sound/fore_sound.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
            "completion_source": completion,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)
    if created:
        test.parts.add(part)


def update_or_create_letter_sound_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Bogstavlyde",
    update_contents=True,
):

    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_sound/Enhanced/Deltests/1e.2 (ny).mp3",
        sound="resources/letter_sound/Enhanced/Deltests/1e.2 (ny).mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/letter_sound/Enhanced/Deltests/1e.3.mp3",
        sound="resources/letter_sound/Enhanced/Deltests/1e.3.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 0,
            "image_url": "/media/resources/letter_sound/letter_sound.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
            "completion_source": completion,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)
    if created:
        test.parts.add(part)


def update_or_create_letter_shape_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Bogstavers form",
    update_contents=True,
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/letter_shape/Enhanced/Deltests/3e.2.mp3",
        sound="resources/letter_shape/Enhanced/Deltests/3e.2.mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/letter_shape/Enhanced/Deltests/3e.3.mp3",
        sound="resources/letter_shape/Enhanced/Deltests/3e.3.mp3",
    )
    practice_correct_feedback, created = TestResource.objects.get_or_create(
        name="resources/letter_shape/Enhanced/Øveopgave 1 og 2/3c.6.mp3",
        sound="resources/letter_shape/Enhanced/Øveopgave 1 og 2/3c.6.mp3",
    )
    practice_wrong_feedback, created = TestResource.objects.get_or_create(
        name="resources/letter_shape/Enhanced/Øveopgave 1 og 2/3c.4.mp3",
        sound="resources/letter_shape/Enhanced/Øveopgave 1 og 2/3c.4.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 0,
            "image_url": "/media/resources/letter_shape/letter_shape.png",
            "reminder": 15000,  # 15 seconds
            "reminder_source": reminder,
            "completion_source": completion,
            "practice_correct_feedback_source": practice_correct_feedback,
            "practice_wrong_feedback_source": practice_wrong_feedback,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

    if created:
        test.parts.add(part)


def update_or_create_wordspelling_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Ordstavning",
    update_contents=True,
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/wordspelling/Enhanced/Deltest/6e.2.mp3",
        sound="resources/wordspelling/Enhanced/Deltest/6e.2.mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/wordspelling/Enhanced/Deltest/6e.3.mp3",
        sound="resources/wordspelling/Enhanced/Deltest/6e.3.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,  # no timeout
            "partial_score_after": 0,  # no partial score (?)
            "image_url": "/media/resources/wordspelling/wordspelling.png",
            "reminder_source": reminder,
            "reminder": 15000,  # 15 seconds
            "completion_source": completion,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

    if created:
        test.parts.add(part)


def update_or_create_nonwordspelling_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Nonordstavning",
    update_contents=True,
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/nonwordspelling/Enhanced/Deltests/4e.4.mp3",
        sound="resources/nonwordspelling/Enhanced/Deltests/4e.4.mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/nonwordspelling/Enhanced/Deltests/4e.5.mp3",
        sound="resources/nonwordspelling/Enhanced/Deltests/4e.5.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,  # no timeout
            "partial_score_after": 0,  # no partial score (?)
            "image_url": "/media/resources/nonwordspelling/nonwordspelling.png",
            "reminder_source": reminder,
            "reminder": 15000,  # 15 seconds
            "completion_source": completion,
        },
    )

    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)
    if created:
        test.parts.add(part)


def update_or_create_letter_pronunciation_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Bogstavbenævnelse",
    update_contents=True,
):
    completion, created = TestResource.objects.get_or_create(
        name="resources/letter_pronunciation/Enhanced/9c.2.mp3",
        sound="resources/letter_pronunciation/Enhanced/9c.2.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 30000,
            "image_url": (
                "/media/resources/letter_pronunciation/letter_pronunciation.png"
            ),
            "completion_source": completion,
            "show_answer_time_statistics": True,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

    if created:
        test.parts.add(part)


def update_or_create_word_pronunciation_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Højtlæsning af ord",
    update_contents=True,
):
    completion, created = TestResource.objects.get_or_create(
        name="resources/word_pronunciation/Enhanced/Deltests/10c.2.mp3",
        sound="resources/word_pronunciation/Enhanced/Deltests/10c.2.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 30000,
            "image_url": "/media/resources/word_pronunciation/word_pronunciation.png",
            "reminder_source": None,
            "completion_source": completion,
            "show_answer_time_statistics": True,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)
    if created:
        test.parts.add(part)


def update_or_create_nonsense_word_pronunciation_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Højtlæsning af nonord",
    update_contents=True,
):
    completion, created = TestResource.objects.get_or_create(
        name="resources/nonsense_word_pronunciation/Enhanced/Deltests/11c.2.mp3",
        sound="resources/nonsense_word_pronunciation/Enhanced/Deltests/11c.2.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 0,
            "partial_score_after": 30000,
            "image_url": (
                "/media/resources/nonsense_word_pronunciation/"
                "nonsense_word_pronunciation.png"
            ),
            "reminder_source": None,
            "completion_source": completion,
            "show_answer_time_statistics": True,
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

    if created:
        test.parts.add(part)


def update_or_create_sentence_reading_test(
    test,
    questions_data,
    practice_questions_data=None,
    name="Sætningslæsning",
    update_contents=True,
):
    reminder, created = TestResource.objects.get_or_create(
        name="resources/sentence_reading/Enhanced/Deltests/8e.5.mp3",
        sound="resources/sentence_reading/Enhanced/Deltests/8e.5.mp3",
    )
    completion, created = TestResource.objects.get_or_create(
        name="resources/sentence_reading/Enhanced/Deltests/8e.6.mp3",
        sound="resources/sentence_reading/Enhanced/Deltests/8e.6.mp3",
    )

    part, created = TestPart.objects.update_or_create(
        name=name,
        defaults={
            "timeout": 8 * 60 * 1000,  # 8 minutes
            "partial_score_after": 4 * 60 * 1000,  # 4 minutes
            "image_url": "/media/resources/sentence_reading/sentence_reading.png",
            "reminder_source": reminder,
            "completion_source": completion,
            "reminder": 15000,  # 15 seconds
        },
    )
    if update_contents:
        part.update_or_create_test_resources(questions_data, False)
        if practice_questions_data:
            part.update_or_create_test_resources(practice_questions_data, True)

        part.set_data_breakdown_ranges(
            "answer_time_data_breakdown", [(None, 4), (4, None)]
        )
        part.set_data_breakdown_ranges("wordcount_data_breakdown", [(1, 2), (3, 4)])

    if created:
        test.parts.add(part)
