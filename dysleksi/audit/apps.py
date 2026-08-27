# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.apps import AppConfig


class AuditConfig(AppConfig):
    name = "audit"
    verbose_name = "Logning"

    def ready(self):
        # Connect the login/logout signal receivers
        from audit import signals  # noqa: F401
