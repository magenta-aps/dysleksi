# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
#
from django.core.management.base import BaseCommand

from dysleksi.clients.tabulex import DysleksiTabulexClient


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            "--method",
            type=str,
            help="method to call",
        )

    def handle(self, *args, **options):
        c = DysleksiTabulexClient.from_settings()
        method = options.get("method")
        if method == "update_model":
            c.update_model("R00213")
        elif method == "update_model_remote":
            c.update_model("R00213", True)
        else:
            c.test_connection()
