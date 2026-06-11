# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators
import os
from pathlib import Path

from django.urls import reverse_lazy
from project.settings.base import DEBUG
from project.util import strtobool

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation."
        "UserAttributeSimilarityValidator",
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
AUTHENTICATION_BACKENDS = [
    # Will log in django users
    "django.contrib.auth.backends.ModelBackend",
    # Will log in to unilogin
    "login.authentication_backend.DysleksiOIDCAuthenticationBackend",
]

SESSION_COOKIE_SECURE = not DEBUG
if not DEBUG:
    SESSION_COOKIE_SAMESITE = "None"
SESSION_EXPIRE_AFTER_LAST_ACTIVITY = True

TWO_FACTOR_LOGIN_TIMEOUT = 0  # Never timeout
TWO_FACTOR_REMEMBER_COOKIE_AGE = 30 * 24 * 60 * 60  # Re-authenticate once per month
BYPASS_2FA = bool(strtobool(os.environ.get("BYPASS_2FA", "False")))
REQUIRE_2FA = bool(strtobool(os.environ.get("REQUIRE_2FA", "True")))

BASE_DIR = Path(__file__).resolve().parent.parent
LOGIN_REDIRECT_URL = reverse_lazy("dysleksi:root")
LOGIN_URL = reverse_lazy("login:login")
LOGOUT_URL = reverse_lazy("login:logout")
LOGOUT_REDIRECT_URL = reverse_lazy("login:logged_out")
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# OIDC settings
OIDC_CREATE_USER = os.environ.get("OIDC_CREATE_USER", False)
OIDC_RP_CLIENT_ID = os.environ["OIDC_RP_CLIENT_ID"]
OIDC_RP_CLIENT_SECRET = os.environ["OIDC_RP_CLIENT_SECRET"]
OIDC_RP_SIGN_ALGO = "RS256"
OIDC_RP_IDP_SIGN_KEY = os.environ.get("OIDC_RP_IDP_SIGN_KEY", None)
OIDC_RP_SCOPES = os.environ.get("OIDC_RP_SCOPES", "openid")
OIDC_OP_JWKS_ENDPOINT = os.environ.get("OIDC_OP_JWKS_ENDPOINT", None)
OIDC_OP_AUTHORIZATION_ENDPOINT = os.environ["OIDC_OP_AUTHORIZATION_ENDPOINT"]
OIDC_OP_TOKEN_ENDPOINT = os.environ["OIDC_OP_TOKEN_ENDPOINT"]
OIDC_OP_USER_ENDPOINT = os.environ["OIDC_OP_USER_ENDPOINT"]
OIDC_OP_LOGOUT_URL_METHOD = os.environ.get(
    "OIDC_OP_LOGOUT_URL_METHOD",
    "login.authentication_backend.unilogin_logout",
)
OIDC_OP_LOGOUT_URL = os.environ.get("OIDC_OP_LOGOUT_URL", "")
OIDC_AUTHENTICATION_CALLBACK_URL = "login:unilogin:oidc_authentication_callback"
OIDC_VERIFY_SSL = not DEBUG
OIDC_TOKEN_USE_BASIC_AUTH = DEBUG
OIDC_STORE_ID_TOKEN = os.environ.get("OIDC_STORE_ID_TOKEN", True)
OIDC_USE_PKCE = not DEBUG
OIDC_PKCE_CODE_VERIFIER_SIZE = 128
ALLOW_LOGOUT_GET_METHOD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
