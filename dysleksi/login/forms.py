# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from csp_helpers.mixins import CSPFormMixin
from django import forms
from django.conf import settings
from django.contrib.auth.forms import AuthenticationForm as DjangoAuthenticationForm
from django.contrib.auth.forms import UsernameField
from django.forms import CharField, PasswordInput, TextInput
from django.utils.translation import gettext_lazy as _
from two_factor.forms import AuthenticationTokenForm as DjangoAuthenticationTokenForm


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


class AuthenticationTokenForm(DjangoAuthenticationTokenForm):
    def __init__(self, user, initial_device, **kwargs):
        """
        Overwritten to set a Danish label on the `remember` field.
        """
        super().__init__(user, initial_device, **kwargs)
        self.fields["remember"] = forms.BooleanField(
            required=False,
            initial=True,
            label=_("Husk mig på denne maskine i {days} dage").format(
                days=int(settings.TWO_FACTOR_REMEMBER_COOKIE_AGE / 3600 / 24)
            ),
        )
