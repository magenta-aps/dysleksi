# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.views.generic import TemplateView
from django_tables2 import SingleTableView
from login.view_mixins import GroupRequiredMixin, LoginRequiredMixin

from dysleksi.models import TEACHERS, Class, User
from dysleksi.tables import ClassTable


class UserTypeMixin(LoginRequiredMixin):

    def get_template_prefix(self) -> str:
        # Override this in subclass
        return "dysleksi"  # pragma: no cover

    def get_template_names(self) -> list[str]:
        # Find template name matching prefix and user type
        prefix = self.get_template_prefix()
        if isinstance(self.user, User):
            if self.user.is_teacher:
                return [f"{prefix}/teacher.html"]
            if self.user.is_student:
                return [f"{prefix}/student.html"]
            if self.user.is_staff or self.user.is_superuser:
                return [f"{prefix}/staff.html"]
        return [f"{prefix}/other.html"]


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


class ClassListView(GroupRequiredMixin, SingleTableView):
    model = Class
    table_class = ClassTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/class/list.html"

    def get_queryset(self):
        return Class.objects.filter(teachers=self.user)
