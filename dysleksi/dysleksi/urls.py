# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.urls import URLPattern, URLResolver, path
from django.views.generic import TemplateView

from dysleksi.views import (
    ClassListView,
    RoomView,
    RootView,
    StartGroupRoomView,
    StartIndividualRoomView,
)

app_name = "dysleksi"

urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootView.as_view(), name="root"),
    path(
        "room/individual/setup/",
        StartIndividualRoomView.as_view(),
        name="start_individual_room",
    ),
    path("room/group/setup/", StartGroupRoomView.as_view(), name="start_group_room"),
    path("room/<str:room_name>/<int:test_id>/", RoomView.as_view(), name="room"),
    path("class/", ClassListView.as_view(), name="class_list"),
    path(
        "exit/", TemplateView.as_view(template_name="dysleksi/exit.html"), name="exit"
    ),
]
