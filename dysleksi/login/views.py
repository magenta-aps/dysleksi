# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME, logout
from django.contrib.auth.views import LoginView as DjangoLoginView
from django.http import HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.csrf import csrf_failure as django_csrf_failure
from django.views.generic import RedirectView
from login.forms import AuthenticationForm


class LoginView(DjangoLoginView):
    template_name = "login/login.html"

    def get_success_url(self):
        return self.back or super().get_success_url()

    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            if settings.PUBLIC:
                return redirect(
                    reverse(
                        "login:login_forward",
                        kwargs={"provider": "unilogin"},
                    )
                )
            else:
                return super().get(request, *args, **kwargs)
        else:
            # User already authenticated. Go to success URL
            return redirect(self.get_success_url())

    def post(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            provider = request.POST.get("provider")
            if provider in ["unilogin", "django"]:
                return redirect(
                    reverse(
                        "login:login_forward",
                        kwargs={"provider": provider},
                    )
                )
            else:
                return redirect(reverse("login:login"))
        else:
            return redirect(self.get_success_url())

    def get_context_data(self, **context):
        return super().get_context_data(
            **{
                **context,
                "back": self.back,
            }
        )

    @property
    def back(self):
        return (
            self.request.GET.get("back")
            or self.request.GET.get(REDIRECT_FIELD_NAME)
            or self.request.COOKIES.get("back")
        )


class LoginForwardView(DjangoLoginView):
    template_name = "login/login_django.html"
    authentication_form = AuthenticationForm

    def get_success_url(self):
        return self.back or super().get_success_url()

    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            if kwargs["provider"] == "unilogin":
                # UniLogin
                return self.login_unilogin(request, *args, **kwargs)
            else:
                # Django Login as fallback. Other urls blocked by settings/login
                return self.login_django(request, *args, **kwargs)
        else:
            return redirect(self.get_success_url())

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if self.back:
            response.set_cookie(
                "back",
                self.back,
                secure=True,
                httponly=True,
                samesite="None",
            )
        return response

    def login_unilogin(self, request, *args, **kwargs) -> HttpResponse:
        return redirect(reverse("login:unilogin:oidc_authentication_init"))

    def login_django(self, request, *args, **kwargs) -> HttpResponse:
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **context):
        return super().get_context_data(
            **{
                **context,
                "back": self.back,
            }
        )

    @property
    def back(self):
        return (
            self.request.GET.get("back")
            or self.request.GET.get(REDIRECT_FIELD_NAME)
            or self.request.COOKIES.get("back")
        )


class LogoutView(RedirectView):
    def get_redirect_url(self, *args, **kwargs):
        if self.request.user.is_authenticated:
            if settings.PUBLIC:
                if (
                    self.request.session.get("_auth_user_backend")
                    == "login.authentication_backend.DysleksiOIDCAuthenticationBackend"
                ):
                    return reverse("login:unilogin:oidc_logout")
                else:
                    logout(self.request)
            else:
                logout(self.request)
        return settings.LOGOUT_REDIRECT_URL


def csrf_failure(request, reason=""):
    # Repeated login submits fail because logging in rotates the CSRF token
    if request.user.is_authenticated and request.resolver_match.namespace == "login":
        return redirect(request.get_full_path())
    return django_csrf_failure(request, reason)
