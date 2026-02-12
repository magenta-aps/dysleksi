# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.db.models import Case, Count, F, Value, When
from django.urls import reverse
from django.views.generic import CreateView, DetailView, TemplateView
from django_tables2 import SingleTableView
from login.view_mixins import GroupRequiredMixin, LoginRequiredMixin

from dysleksi.forms import StartClassRoomForm, StartIndividualRoomForm
from dysleksi.models import (
    TEACHERS,
    Class,
    Student,
    Test,
    TestAssignment,
    TestType,
    User,
)
from dysleksi.tables import ClassTable, StudentTable, TestAssignmentTable


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


class AssignmentView(UserTypeMixin, DetailView):

    model = TestAssignment

    def get_template_prefix(self) -> str:
        if self.user.is_teacher or self.user.is_student:
            return "dysleksi/screening"
        raise ValueError("User is neither teacher nor student")

    @property
    def room_name(self):
        if self.object.klasse is not None:
            return f"class_{self.object.klasse_id}"
        else:
            return f"student_{self.object.student_id}"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        test = Test.objects.get(pk=self.object.test_id)
        context["test_contents"] = test.to_json()
        context["room_name"] = self.room_name
        context["test_type"] = self.get_room_type()
        context["test_contents"]["summary"] = [
            testpart["name"] for testpart in context["test_contents"]["parts"]
        ]
        context["student"] = self.user
        context["room_type"] = self.get_room_type()
        return context

    def get_room_type(self) -> str:
        if self.object.klasse is not None:
            return "group"
        else:
            return "individual"


class ClassListView(GroupRequiredMixin, SingleTableView):
    model = Class
    table_class = ClassTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/class/list.html"

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show classes belonging to the teacher viewing the page
        qs = qs.filter(teachers=self.user)
        # Add annotations used by `ClassTable`
        qs = qs.annotate(
            number_of_students=Count("student__pk", distinct=True),
        )
        return qs


class StudentListView(GroupRequiredMixin, SingleTableView):
    model = Student
    table_class = StudentTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/student/list.html"

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show students belonging to the teacher viewing the page
        qs = qs.filter(klasse__teachers=self.user)
        return qs


class TestAssignmentListView(GroupRequiredMixin, SingleTableView):
    model = TestAssignment
    table_class = TestAssignmentTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/test_assignment/list.html"

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show test assignments belonging to the teacher viewing the page
        qs = qs.filter(teacher=self.user)
        # Add annotations used by `TestAssignmentTable`
        qs = qs.annotate(
            number_of_students=Case(
                When(
                    student__isnull=True,
                    then=Count("klasse__student__pk", distinct=True),
                ),
                When(
                    student__isnull=False,
                    then=Value(1),
                ),
            ),
            number_of_students_responded=Count("responses__student__pk", distinct=True),
        )
        qs = qs.annotate(
            status=Case(
                When(
                    number_of_students_responded=F("number_of_students"),
                    then=Value("Gennemført"),
                ),
                When(
                    number_of_students_responded__gt=0,
                    number_of_students_responded__lt=F("number_of_students"),
                    then=Value("I gang"),
                ),
                default=Value("Afventer"),
            )
        )
        return qs


class StartAssignmentView(CreateView):
    template_name = "dysleksi/lobby/start_room.html"
    model = TestAssignment

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["teacher"] = self.request.user.subclass_instance()
        return kwargs

    def get_success_url(self):
        return reverse(
            "dysleksi:room",
            kwargs={"pk": self.object.pk},
        )


class StartIndividualAssignmentView(StartAssignmentView):
    form_class = StartIndividualRoomForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["test_type"] = TestType.INDIVIDUAL

        return context


class StartGroupAssignmentView(StartAssignmentView):
    form_class = StartClassRoomForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["test_type"] = TestType.GROUP

        return context


class AdminRootView(GroupRequiredMixin, TemplateView):
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/base.html"
