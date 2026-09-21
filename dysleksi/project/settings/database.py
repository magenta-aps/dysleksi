# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

import os

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": os.environ["POSTGRES_HOST"],
        "TIME_ZONE": os.environ["TZ"],
        "OPTIONS": {
            "pool": {
                "min_size": int(os.environ.get("DB_POOL_MIN_SIZE", 2)),
                "max_size": int(os.environ.get("DB_POOL_MAX_SIZE", 10)),
                "timeout": int(os.environ.get("DB_POOL_TIMEOUT", 10)),
            },
        },
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
