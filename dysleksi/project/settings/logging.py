# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import logging
import os
import sys

from project.settings.base import ENVIRONMENT


def skip_client_errors(record):
    if record.status_code in (403, 404):
        return False
    return True


LOGGING: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
        "suppress_xml": {
            "()": "project.settings.base.XMLFilter",
        },
        "skip_client_errors": {
            "()": "django.utils.log.CallbackFilter",
            "callback": skip_client_errors,
        },
    },
    "formatters": {
        "simple": {
            "format": "[{asctime}] [{levelname}] {name}: {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S %z",
        },
    },
    "handlers": {
        "gunicorn": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "filters": ["suppress_xml"],
        },
    },
    "root": {
        "handlers": ["gunicorn"],
        "formatter": "simple",
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["gunicorn"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["gunicorn"],
            "level": "INFO",
            "filters": ["skip_client_errors"],
            "propagate": False,
        },
        "weasyprint": {
            "handlers": ["gunicorn"],
            "level": "ERROR",
            "propagate": False,
        },
        "fontTools": {
            "handlers": ["gunicorn"],
            "level": "ERROR",
            "propagate": False,
        },
        "paramiko": {
            "handlers": ["gunicorn"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

log_filename = "/dysleksi.log"
if os.path.isfile(log_filename) and ENVIRONMENT != "development":
    LOGGING["handlers"]["file"] = {
        "class": "logging.FileHandler",  # eller WatchedFileHandler
        "filename": log_filename,
        "formatter": "simple",
    }
    LOGGING["root"] = {
        "handlers": ["gunicorn", "file"],
        "level": "INFO",
    }
    LOGGING["loggers"]["django"]["handlers"].append("file")


# Make logging shut up during testing
if len(sys.argv) > 1 and sys.argv[1] == "test":
    logging.disable(logging.CRITICAL)
