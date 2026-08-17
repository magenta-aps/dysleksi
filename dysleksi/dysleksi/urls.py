# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.http import HttpResponse
from django.urls import URLPattern, URLResolver, path

from dysleksi.views import (
    AssignmentPartResultsView,
    AssignmentResultListView,
    AssignmentResultsFlagView,
    AssignmentResultsView,
    AssignmentView,
    ClassDetailView,
    ClassListView,
    ClientErrorLogView,
    PartResponseView,
    RootView,
    StartGroupAssignmentView,
    StartIndividualAssignmentView,
    StudentDetailView,
    StudentListView,
    TestAssignmentListView,
    TestResponseView,
)

app_name = "dysleksi"

urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootView.as_view(), name="root"),
    path("ping", lambda r: HttpResponse(status=204), name="ping"),
    path("client-error/", ClientErrorLogView.as_view(), name="client_error_log"),
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
    path("admin/classes/<int:pk>/", ClassDetailView.as_view(), name="class_detail"),
    path("admin/students/", StudentListView.as_view(), name="student_list"),
    path(
        "admin/students/<int:pk>/", StudentDetailView.as_view(), name="student_detail"
    ),
    path(
        "admin/classes/<int:class_pk>/test-assignments/",
        TestAssignmentListView.as_view(),
        name="class_assignment_list",
    ),
    path(
        "assignment/results/",
        AssignmentResultListView.as_view(),
        name="test_assignment_result_list",
    ),
    path(
        "assignment/<int:pk>/result/",
        AssignmentResultsView.as_view(),
        name="test_assignment_results",
    ),
    path(
        "testresponse/<int:pk>/flag/",
        AssignmentResultsFlagView.as_view(),
        name="test_response_flag",
    ),
    path(
        "assignment/<int:assignment_pk>/<int:testpart_pk>/result/",
        AssignmentPartResultsView.as_view(),
        name="test_assignment_part_results",
    ),
    path(
        "assignment/<int:assignment_pk>/result/<int:response_pk>/",
        TestResponseView.as_view(),
        name="test_assignment_student_results",
    ),
    path(
        "assignment/<int:assignment_pk>/<int:testpart_pk>/<int:testresponse_pk>/",
        PartResponseView.as_view(),
        name="test_assignment_part_result",
    ),
]
