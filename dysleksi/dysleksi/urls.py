# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.urls import URLPattern, URLResolver, path
from django.views.generic import TemplateView

from dysleksi.views import (
    AssignmentView,
    ClassListView,
    RootView,
    StartGroupAssignmentView,
    StartIndividualAssignmentView,
    StudentListView,
    TestAssignmentListView,
)

app_name = "dysleksi"

urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootView.as_view(), name="root"),
    path(
        "assignment/individual/setup/",
        StartIndividualAssignmentView.as_view(),
        name="start_individual_room",
    ),
    path(
        "assignment/group/setup/",
        StartGroupAssignmentView.as_view(),
        name="start_group_room",
    ),
    path("assignment/<int:pk>/", AssignmentView.as_view(), name="room"),
    path("class/", ClassListView.as_view(), name="class_list"),
    path(
        "exit/", TemplateView.as_view(template_name="dysleksi/exit.html"), name="exit"
    ),
    path("admin/classes/", ClassListView.as_view(), name="class_list"),
    path("admin/students/", StudentListView.as_view(), name="student_list"),
    path(
        "admin/test-assignments/",
        TestAssignmentListView.as_view(),
        name="test_assignment_list",
    ),
]
