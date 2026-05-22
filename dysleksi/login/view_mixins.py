# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import List

from django.conf import settings
from django.contrib.auth.mixins import LoginRequiredMixin as DjangoLoginRequiredMixin
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.db.models import Q
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
        if hasattr(request.user, "subclass_instance"):
            request.user = request.user.subclass_instance()
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


class GroupRequiredMixin(LoginRequiredMixin):

    groups_required: List[str] = []

    def get_group_filter(self) -> Q:
        q = Q()
        for group in self.groups_required:
            q &= Q(name=group)
        return q

    def get(self, request, *args, **kwargs):
        if (
            request.user.is_superuser
            or request.user.groups.filter(self.get_group_filter()).exists()
        ):
            return super().get(request, *args, **kwargs)
        else:
            raise PermissionDenied
