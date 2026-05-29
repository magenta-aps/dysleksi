# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models.functions import Now
from django.utils import timezone

from dysleksi.models import QuestionResponse
from dysleksi.utils import format_time


class Command(BaseCommand):
    help = "Removes test response audio that is older than configured time"

    def handle(self, *args, **options):
        retention_seconds = settings.RESPONSE_AUDIO_RETENTION_SECONDS

        qs = QuestionResponse.objects.filter(
            submitted_at__lt=Now() - timedelta(seconds=retention_seconds),
            answer_sound__isnull=False,
        ).exclude(answer_sound="")
        if options["verbosity"]:  # pragma: no cover
            self.stdout.write(f"There are {qs.count()} answers to clean")
        for response in qs:
            if options["verbosity"]:  # pragma: no cover
                self.stdout.write(
                    f"Removing answer file {response.answer_sound}. "
                    f"Age: {format_time(timezone.now() - response.submitted_at)}"
                )
            response.answer_sound.delete()
