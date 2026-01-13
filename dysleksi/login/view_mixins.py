# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.conf import settings
from django.contrib.auth.mixins import LoginRequiredMixin as DjangoLoginRequiredMixin
from django.contrib.auth.models import AnonymousUser
from django.template.response import TemplateResponse
from django_otp.plugins.otp_totp.models import TOTPDevice


class LoginRequiredMixin(DjangoLoginRequiredMixin):

    @property
    def two_factor_setup_required(self):
        return TemplateResponse(
            request=self.request,
            status=403,
            template="two_factor/core/otp_required.html",
        )

    def get_context_data(self, **kwargs):
        return super().get_context_data(
            **{
                **kwargs,
                "user_twofactor_enabled": self.user.is_authenticated
                and TOTPDevice.objects.filter(user=self.user).exists(),
            }
        )

    def setup(self, request, *args, **kwargs):
        super().setup(request, *args, **kwargs)
        self.user = request.user

    def dispatch(self, request, *args, **kwargs):
        if not settings.PUBLIC:
            if (
                not isinstance(self.user, AnonymousUser)
                and not settings.BYPASS_2FA
                and settings.REQUIRE_2FA
                and not self.user.is_verified()
            ):
                return self.two_factor_setup_required
        return super().dispatch(request, *args, **kwargs)
