# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import os
from typing import List

from django.conf import settings
from django.templatetags.static import static


def scan_static_files(folders_to_scan=["images", "audio", "vendor/fonts"]):
    static_files = []

    for folder in folders_to_scan:
        folder_path = os.path.join(settings.STATIC_ROOT, folder)

        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.endswith(".map") or file.count(".") > 1 or file.endswith(".gz"):
                    continue

                rel_path = os.path.relpath(
                    os.path.join(root, file), settings.STATIC_ROOT
                )

                url = static(rel_path)
                static_files.append(url)
    return static_files


def reverse_ordering(ordering: List[str]) -> List[str]:
    return [o[1:] if o[0] == "-" else ("-" + o) for o in ordering]
