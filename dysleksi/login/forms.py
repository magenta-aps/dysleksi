# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from csp_helpers.mixins import CSPFormMixin
from django.contrib.auth.forms import AuthenticationForm as DjangoAuthenticationForm
from django.contrib.auth.forms import UsernameField
from django.forms import CharField, PasswordInput, TextInput
from django.utils.translation import gettext_lazy as _


class AuthenticationForm(CSPFormMixin, DjangoAuthenticationForm):
    username = UsernameField(
        label=_("Brugernavn"),
        widget=TextInput(
            attrs={
                "autofocus": True,
                "class": "form-control",
                "placeholder": _("Brugernavn"),
            }
        ),
    )
    password = CharField(
        label=_("Password"),
        strip=False,
        widget=PasswordInput(
            attrs={
                "autocomplete": "current-password",
                "class": "form-control",
                "placeholder": _("Kodeord"),
            }
        ),
    )
