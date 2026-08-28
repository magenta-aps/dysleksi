# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
#
import json

from django.conf import settings
from django.core.management.base import BaseCommand

from dysleksi.clients.tabulex import DysleksiTabulexClient


class Command(BaseCommand):

    def handle(self, *args, **options):
        client = DysleksiTabulexClient.from_settings()
        with open(settings.TABULEX["institution_list"], "r") as fp:
            institution_ids = json.load(fp)
        for id in institution_ids:
            try:
                client.update_model(
                    str(id), load_remote=False if settings.DEBUG else True
                )
            except Exception as e:
                self.stderr.write(str(e))
