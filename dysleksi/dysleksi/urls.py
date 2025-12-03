# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.urls import URLPattern, URLResolver, path

from dysleksi.views import RootView

app_name = "dysleksi"

urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootView.as_view(), name="root"),
]
