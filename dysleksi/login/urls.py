# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.urls import URLPattern, URLResolver, include, path
from django.views.generic import TemplateView
from login.views import LoginForwardView, LoginView, LogoutView, TwoFactorSetup

app_name = "login"


urlpatterns: list[URLResolver | URLPattern] = [
    path(
        "oidc/",
        include(
            ("mozilla_django_oidc.urls", "unilogin"),
            namespace="unilogin",
        ),
    ),
    path(
        "login/forward/<str:provider>",
        LoginForwardView.as_view(),
        name="login_forward",
    ),
    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),
    path(
        "logout",
        LogoutView.as_view(),
        name="logout",
    ),
    path(
        "logged_out",
        TemplateView.as_view(template_name="login/logged_out.html"),
        name="logged_out",
    ),
    path("two_factor/setup", TwoFactorSetup.as_view(), name="two_factor_setup"),
]
