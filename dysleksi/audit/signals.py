# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
"""Records login attempts in the audit log.

The receivers listen to Django's authentication signals, so both
username/password logins and (successful) UniLogin/OIDC logins are recorded.
"""

from audit.models import LoginAttempt, LoginResult
from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver


def get_client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        # The client address is the first entry, the rest are proxies
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


@receiver(user_logged_in)
def on_user_logged_in(sender, request, user, **kwargs):
    LoginAttempt.objects.create(
        user=user,
        username=user.get_username(),
        result=LoginResult.SUCCESS,
        backend=getattr(user, "backend", "") or "",
        ip_address=get_client_ip(request),
    )


@receiver(user_login_failed)
def on_user_login_failed(sender, credentials, request=None, **kwargs):
    username = credentials.get("username") or ""
    # Look up the user, so a failed attempt on an existing account can be
    # found by user id and not just by the submitted username
    user = get_user_model().objects.filter(username=username).first()
    LoginAttempt.objects.create(
        user=user,
        username=username,
        result=LoginResult.FAILURE,
        ip_address=get_client_ip(request),
    )
