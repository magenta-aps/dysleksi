# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.shortcuts import redirect
from django.views.generic import FormView, TemplateView
from django_tables2 import SingleTableView
from login.view_mixins import GroupRequiredMixin, LoginRequiredMixin

from dysleksi.forms import StartClassRoomForm, StartIndividualRoomForm
from dysleksi.models import TEACHERS, Class, Test, TestType, User
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
        if not self.user.is_anonymous and self.user.is_student:
            context_data["student"] = self.user
        return context_data


class RoomView(UserTypeMixin, TemplateView):
    def get_template_prefix(self) -> str:
        return f"dysleksi/screening/{self.get_room_type()}"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        test = Test.objects.get(pk=self.kwargs["test_id"])
        context["test_contents"] = test.to_json()
        return context

    def get_room_type(self) -> str:
        room_name = self.kwargs["room_name"]
        if room_name.startswith("student"):
            return "individual"
        else:
            return "group"


class ClassListView(GroupRequiredMixin, SingleTableView):
    model = Class
    table_class = ClassTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/class/list.html"

    def get_queryset(self):
        return Class.objects.filter(teachers=self.user)


class StartRoomView(FormView):
    template_name = "dysleksi/lobby/start_room.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["teacher"] = self.request.user.subclass_instance()
        return kwargs

    def form_valid(self, form):
        test = form.cleaned_data["test"]
        return redirect(
            "dysleksi:room",
            room_name=form.get_room_name(),
            test_id=test.pk,
        )


class StartIndividualRoomView(StartRoomView):
    form_class = StartIndividualRoomForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["test_type"] = TestType.INDIVIDUAL

        return context


class StartGroupRoomView(StartRoomView):
    form_class = StartClassRoomForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["test_type"] = TestType.GROUP

        return context
