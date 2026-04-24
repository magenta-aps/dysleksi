# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.http import HttpResponse
from django.urls import URLPattern, URLResolver, path

from dysleksi.views import (
    AssignmentResultsView,
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
    path("ping", lambda r: HttpResponse(status=204), name="ping"),
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
    path("admin/classes/", ClassListView.as_view(), name="class_list"),
    path("admin/students/", StudentListView.as_view(), name="student_list"),
    path(
        "admin/test-assignments/",
        TestAssignmentListView.as_view(),
        name="test_assignment_list",
    ),
    path(
        "assignment/<int:pk>/result/",
        AssignmentResultsView.as_view(),
        name="test_assignment_results",
    ),
]
