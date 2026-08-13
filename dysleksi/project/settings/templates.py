# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import os

from project.settings.base import BASE_DIR, DEBUG

default_loaders = [
    "django.template.loaders.filesystem.Loader",
    "django.template.loaders.app_directories.Loader",
]

cached_loaders = [("django.template.loaders.cached.Loader", default_loaders)]


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(BASE_DIR, "templates")],
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "dysleksi.context_processors.nav_context",
                "dysleksi.context_processors.debug_context",
                "dysleksi.context_processors.version_context",
                "dysleksi.context_processors.webrtc_settings",
                "dysleksi.context_processors.client_error_log_context",
            ],
            "loaders": default_loaders if DEBUG else cached_loaders,
            "libraries": {
                "csp": "csp.templatetags.csp",
            },
        },
    },
]
