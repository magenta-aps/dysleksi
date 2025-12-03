# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import django.conf.locale

LANGUAGE_CODE = "da"
LANGUAGES = [
    ("kl", "Kalaallisut"),
    ("da", "Dansk"),
]
EXTRA_LANG_INFO = {
    "kl": {
        "code": "kl",
        "name": "Kalaallisut",
        "name_local": "Kalaallisut",
        "bidi": False,
    },
}
LANG_INFO = dict(django.conf.locale.LANG_INFO, **EXTRA_LANG_INFO)
django.conf.locale.LANG_INFO = LANG_INFO

TIME_ZONE = "America/Nuuk"

USE_I18N = True
USE_L10N = True
USE_TZ = True
THOUSAND_SEPARATOR = "."
DECIMAL_SEPARATOR = ","
