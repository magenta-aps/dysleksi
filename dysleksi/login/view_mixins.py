# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import List

from django.contrib.auth.mixins import LoginRequiredMixin as DjangoLoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.db.models import Q


class LoginRequiredMixin(DjangoLoginRequiredMixin):

    def setup(self, request, *args, **kwargs):
        super().setup(request, *args, **kwargs)
        if hasattr(request.user, "subclass_instance"):
            request.user = request.user.subclass_instance()
        self.user = request.user


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
