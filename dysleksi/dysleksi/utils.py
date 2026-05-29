# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import os
import re
from datetime import timedelta
from typing import List

from django.conf import settings
from django.templatetags.static import static
from django.utils.translation import gettext_lazy as _

HASHED_FILE_RE = re.compile(r"\.[a-f0-9]{8,}(\.[^./]+)$", re.IGNORECASE)


def scan_static_files(folders_to_scan=["images", "audio", "vendor/fonts"]):
    static_files = []

    for folder in folders_to_scan:
        folder_path = os.path.join(settings.STATIC_ROOT, folder)

        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.endswith(".map") or file.endswith(".gz"):
                    continue
                if HASHED_FILE_RE.search(file):
                    continue

                rel_path = os.path.relpath(
                    os.path.join(root, file), settings.STATIC_ROOT
                )

                url = static(rel_path)
                static_files.append(url)
    return static_files


def reverse_ordering(ordering: List[str]) -> List[str]:
    return [o[1:] if o[0] == "-" else ("-" + o) for o in ordering]


def format_time(seconds: int | timedelta) -> str:

    if isinstance(seconds, timedelta):
        seconds = int(seconds.total_seconds())

    if seconds < 60:
        return _("%(sek)s sek.") % {"sek": seconds}

    elif seconds < 3600:
        minutes = seconds // 60
        seconds -= 60 * minutes
        return _("%(min)s min. %(sek)s sek.") % {"min": minutes, "sek": seconds}

    else:
        hours = seconds // 3600
        seconds -= 3600 * hours
        minutes = seconds // 60
        seconds -= 60 * minutes
        return _("%(tim)s tim. %(min)s min. %(sek)s sek.") % {
            "tim": hours,
            "min": minutes,
            "sek": seconds,
        }
