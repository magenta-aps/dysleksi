# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.core.management import BaseCommand

from dysleksi.models import EboksMessage


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        EboksMessage.update_final_statuses()
