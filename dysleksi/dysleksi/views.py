# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.views.generic import TemplateView
from login.view_mixins import LoginRequiredMixin


class UserTypeMixin(LoginRequiredMixin):

    def get_template_prefix(self) -> str:
        # Override this in subclass
        return "dysleksi"  # pragma: no cover

    def get_template_names(self) -> list[str]:
        # Find template name matching prefix and user type
        if self.user.is_teacher:
            return [f"{self.get_template_prefix()}/teacher.html"]
        if self.user.is_student:
            return [f"{self.get_template_prefix()}/student.html"]
        if self.user.is_staff or self.user.is_superuser:
            return [f"{self.get_template_prefix()}/staff.html"]
        else:
            raise ValueError(f"Unknown type for user: {self.user}")  # pragma: no cover


class RootView(UserTypeMixin, TemplateView):
    def get_template_prefix(self) -> str:
        return "dysleksi/lobby"

    def get_context_data(self, **kwargs) -> dict[str, Any]:
        context_data = super().get_context_data(**kwargs)
        if not self.user.is_anonymous:
            # Mock student data
            mock_student = {"id": "1234", "name": "Elev Elevsen"}
            if self.user.is_teacher:
                context_data["students"] = [mock_student]
            elif self.user.is_student:
                context_data["student"] = mock_student
        return context_data


class RoomView(UserTypeMixin, TemplateView):
    def get_template_prefix(self) -> str:
        return "dysleksi/test"
