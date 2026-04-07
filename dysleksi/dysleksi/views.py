# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any

from django.db import transaction
from django.db.models import Case, Count, F, Value, When
from django.http import HttpResponseRedirect
from django.shortcuts import redirect
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
from dysleksi.utils import scan_static_files


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
    def get(self, request, *args, **kwargs):
        if not self.user.is_anonymous and self.user.is_teacher:
            return redirect("dysleksi:test_assignment_list")
        return super().get(request, *args, **kwargs)

    def get_template_prefix(self) -> str:
        return "dysleksi/lobby"

    def get_context_data(self, **kwargs) -> dict[str, Any]:
        context_data = super().get_context_data(**kwargs)
        if not self.user.is_anonymous and self.user.is_student:
            context_data["student"] = self.user
        return context_data


class AssignmentView(UserTypeMixin, DetailView):

    model = TestAssignment
    context_object_name = "test_assignment"

    def get_template_names(self) -> list[str]:
        if self.user.is_teacher:
            if self.object.test.test_type == TestType.INDIVIDUAL:
                return ["dysleksi/admin/test_assignment/detail_individual.html"]
            else:
                return ["dysleksi/admin/test_assignment/detail_group.html"]

        return super().get_template_names()

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
        assignment = self.object
        test = Test.objects.get(pk=assignment.test_id)
        context["test_contents"] = test.to_json()
        context["room_name"] = self.room_name
        context["test_type"] = self.get_room_type()
        context["student"] = self.user
        context["room_type"] = self.get_room_type()
        context["test_name"] = test.name
        context["class_name"] = assignment.klasse_name
        context["static_files"] = scan_static_files()

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
        qs = qs.filter(institution=self.user.institution, teachers=self.user)
        # Only classes in the current school year
        # qs = qs.current()
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
        qs = qs.filter(institution=self.user.institution, classes__teachers=self.user)
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

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["assign_group_form"] = StartClassRoomForm(teacher=self.user)
        context["assign_individual_form"] = StartIndividualRoomForm(teacher=self.user)
        return context


class StartAssignmentView(CreateView):
    template_name = "dysleksi/lobby/start_room.html"
    model = TestAssignment
    http_method_names = ["post"]
    test_type: TestType | None = None  # overridden in subclasses

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["teacher"] = self.request.user.subclass_instance()
        return kwargs

    def get_success_url(self):
        if self.object.planned_date_time is not None:
            return reverse("dysleksi:test_assignment_list")
        else:
            return reverse("dysleksi:room", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        if form.cleaned_data["test_parts"]:
            self.object = self.create_test_from_test_parts(form)
            return HttpResponseRedirect(self.get_success_url())
        else:
            return super().form_valid(form)

    @transaction.atomic
    def create_test_from_test_parts(self, form) -> TestAssignment:
        # Create test
        test = Test.objects.create(
            name=", ".join(
                str(test_part) for test_part in form.cleaned_data["test_parts"]
            ),
            test_type=self.test_type,  # type: ignore
            custom=True,
        )
        # Add the selected test parts
        for test_part in form.cleaned_data["test_parts"]:
            test.parts.add(test_part)
        # Create test assignment for this test/test parts
        test_assignment = form.save(commit=False)
        test_assignment.test = test
        test_assignment.save()
        return test_assignment


class StartIndividualAssignmentView(StartAssignmentView):
    form_class = StartIndividualRoomForm
    test_type = TestType.INDIVIDUAL


class StartGroupAssignmentView(StartAssignmentView):
    form_class = StartClassRoomForm
    test_type = TestType.GROUP


class AdminRootView(GroupRequiredMixin, TemplateView):
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/base.html"
