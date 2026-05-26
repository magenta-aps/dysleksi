# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
import logging
import os
import sys
from pathlib import Path

from project.util import strtobool

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
VERSION = os.environ["COMMIT_TAG"]


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
DEBUG = strtobool(os.environ.get("DJANGO_DEBUG", "False"))
DUMMY_DATA_DIR = os.environ.get("DUMMY_DATA_DIR", "/")
REAL_DATA_DIR = os.environ.get("REAL_DATA_DIR", "/")

SHOW_DEBUG_CONSOLE = strtobool(os.environ.get("SHOW_DEBUG_CONSOLE", "False"))
TESTING = len(sys.argv) > 1 and sys.argv[1] == "test"
PUBLIC = strtobool(os.environ.get("PUBLIC", "True"))
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "")

HOST_DOMAIN = os.environ.get("HOST_DOMAIN", "https://dysleksi.gl")
ALLOWED_HOSTS: list[str] = json.loads(os.environ.get("ALLOWED_HOSTS", "[]"))
CSRF_TRUSTED_ORIGINS = json.loads(os.environ.get("CSRF_TRUSTED_ORIGINS", "[]")) or [
    HOST_DOMAIN
]

AUTH_USER_MODEL = "dysleksi.User"

MEDIA_ROOT = os.environ.get("MEDIA_ROOT", "/upload")
RESOURCE_ROOT = MEDIA_ROOT + "/resources"
DUMMY_RESOURCE_ROOT = MEDIA_ROOT + "/dummy-resources"
INSTRUCTIONS_ROOT = MEDIA_ROOT + "/instructions"
MEDIA_URL = "/media/"

ROOT_URLCONF = "project.urls"

WSGI_APPLICATION = "dysleksi.wsgi.application"
ASGI_APPLICATION = "dysleksi.asgi.application"

CRISPY_TEMPLATE_PACK = "uni_form"

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


class XMLFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        if "Resource 'XMLSchema.xsd' is already loaded" in message:
            return False
        return True


WEBRTC_KEY = os.environ.get("WEBRTC_KEY")

RESULT_TABLE_SIZE = int(os.environ.get("RESULT_TABLE_SIZE", 3))
QUESTIONRESPONSES_TABLE_SIZE = int(os.environ.get("QUESTIONRESPONSES_TABLE_SIZE", 20))
