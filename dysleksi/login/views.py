# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME, logout
from django.contrib.auth.views import redirect_to_login
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.generic import RedirectView
from login.forms import AuthenticationForm, AuthenticationTokenForm
from project.util import add_parameters_to_url
from two_factor.views import LoginView as TwoFactorLoginView
from two_factor.views import SetupView


class LoginView(TwoFactorLoginView):
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


class LoginForwardView(TwoFactorLoginView):
    AUTH_STEP = TwoFactorLoginView.AUTH_STEP
    TOKEN_STEP = TwoFactorLoginView.TOKEN_STEP
    template_name = "login/login_django.html"

    form_list = (
        (AUTH_STEP, AuthenticationForm),
        (TOKEN_STEP, AuthenticationTokenForm),
    )

    def get_form_list(self):
        form_list = super().get_form_list()
        # In case we wish to bypass 2FA we should never go to the token step.
        if settings.BYPASS_2FA and self.TOKEN_STEP in form_list:
            del form_list[self.TOKEN_STEP]
        return form_list

    def get_form(self, step=None, data=None, files=None):
        """
        Returns the form for the step. Overwritten because the default method hard-codes
        the form for the token-step as AuthenticationTokenForm instead of
        BeskAuthenticationTokenForm
        """
        if step is None:
            step = self.steps.current

        form_class = self.get_form_list()[step]
        kwargs = self.get_form_kwargs(step)
        kwargs.update(
            {
                "data": data,
                "files": files,
                "prefix": self.get_form_prefix(step, form_class),
                "initial": self.get_form_initial(step),
            }
        )
        return form_class(**kwargs)

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


class TwoFactorSetup(SetupView):
    form_list = [("method", AuthenticationTokenForm)]

    def get_success_url(self):
        return add_parameters_to_url(
            reverse("dysleksi:root"),
            {"two_factor_success": 1},
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


def on_session_expired(request: HttpRequest) -> HttpResponse | None:
    if request.path == reverse("login:mitid:logout-callback"):
        return None  # Do not redirect to login
    redirect_url = getattr(settings, "SESSION_TIMEOUT_REDIRECT", None)
    if redirect_url:
        return redirect(redirect_url)
    else:
        return redirect_to_login(next=request.path)
