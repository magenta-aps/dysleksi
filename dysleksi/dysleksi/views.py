# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.utils.functional import cached_property
from django.views.generic import TemplateView
from login.view_mixins import LoginRequiredMixin
from dysleksi.models import User, UserType


class UserTypeMixin:
    @cached_property
    def user_type(self) -> UserType:
        user = User.objects.get(pk=self.request.user.pk)
        return user.user_type


class RootView(LoginRequiredMixin, UserTypeMixin, TemplateView):
    def get_template_names(self) -> list[str]:
        return [f"dysleksi/lobby/{self.user_type.lower()}.html"]

    def get_context_data(self, **kwargs) -> dict[str, Any]:
        context_data = super().get_context_data(**kwargs)
        # Mock student data
        mock_student = {"id": "1234", "name": "Elev Elevsen"}
        if self.user_type is UserType.Teacher:
            context_data["students"] = [mock_student]
        elif self.user_type is UserType.Student:
            context_data["student"] = mock_student
        return context_data


class RoomView(LoginRequiredMixin, UserTypeMixin, TemplateView):
    def get_template_names(self) -> list[str]:
        return [f"dysleksi/test/{self.user_type.lower()}.html"]
