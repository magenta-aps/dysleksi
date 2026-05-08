# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import time
from binascii import unhexlify
from http import HTTPStatus
from unittest.mock import patch

from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY
from django.test import RequestFactory, TestCase
from django.test.utils import override_settings
from django.urls import reverse
from django_otp.oath import totp
from django_otp.util import random_hex
from login import views
from login.views import on_session_expired
from two_factor.utils import totp_digits

from dysleksi.models import User


def totp_str(key):
    return str(totp(key)).zfill(totp_digits())


class LoginTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.staff_user = User.objects.create(username="test", is_staff=True)
        cls.staff_user.set_password("test")
        cls.staff_user.save()


class LoginGeneralTest(LoginTest):
    def test_redirect_to_login(self):
        response = self.client.get(reverse("dysleksi:root"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login") + "?next=/",
        )

    def test_choose_login_provider(self):
        response = self.client.post(reverse("login:login"), {"provider": "mitid"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login_forward", kwargs={"provider": "mitid"}),
        )

        response = self.client.post(reverse("login:login"), {"provider": "unilogin"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login_forward", kwargs={"provider": "unilogin"}),
        )

        response = self.client.post(reverse("login:login"), {"provider": "django"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login_forward", kwargs={"provider": "django"}),
        )

    def test_choose_invalid_provider(self):
        response = self.client.post(reverse("login:login"), {"provider": "invalid"})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login"),
        )

    def test_logout_already_logged_out(self):
        response = self.client.get(reverse("login:logout"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], settings.LOGOUT_REDIRECT_URL)
        self.assertNotIn("_auth_user_id", dict(self.client.session).keys())

    def test_not_logged_in(self):
        response = self.client.get(reverse("login:login"))
        self.assertEqual(response.status_code, 200)

    def test_login_already_logged_in(self):
        self.client.force_login(self.staff_user)
        response = self.client.post(reverse("login:login"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    def test_login_forward_already_logged_in(self):
        self.client.force_login(self.staff_user)
        response = self.client.get(
            reverse("login:login_forward", kwargs={"provider": "django"})
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")


@override_settings(PUBLIC=True)
class SamlLoginTest(LoginTest):
    def test_invalid_saml_data(self):
        session = self.client.session
        session.update(
            {
                "saml": {
                    "this config": "is invalid",
                }
            }
        )
        session.save()
        response = self.client.get(reverse("login:login"))
        self.assertEqual(response.status_code, 200)

    def test_postlogin(self):
        session = self.client.session
        session.update(
            {
                "saml": {
                    "ava": {
                        "cpr": ["1234567890"],
                        "firstname": ["Test"],
                        "lastname": ["Testersen"],
                        "email": ["test@example.com"],
                    }
                }
            }
        )
        session.save()
        response = self.client.get(
            reverse("login:login_forward", kwargs={"provider": "mitid"})
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    def test_already_logged_in(self):
        url = reverse("dysleksi:root")
        session = self.client.session
        session.update(
            {
                "saml": {
                    "ava": {
                        "cpr": ["1234567890"],
                        "firstname": ["Test"],
                        "lastname": ["Testersen"],
                        "email": ["test@example.com"],
                    }
                }
            }
        )
        session.save()
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login") + "?next=/",
        )

    def test_login_back(self):
        session = self.client.session
        session.update(
            {
                "saml": {
                    "ava": {
                        "cpr": ["1234567890"],
                        "firstname": ["Test"],
                        "lastname": ["Testersen"],
                        "email": ["test@example.com"],
                    }
                },
            }
        )
        session.save()
        self.client.cookies["back"] = "/foobar"
        response = self.client.get(reverse("login:login"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobar")

    def test_login_forward_back(self):
        session = self.client.session
        session.update(
            {
                "saml": {
                    "ava": {
                        "cpr": ["1234567890"],
                        "firstname": ["Test"],
                        "lastname": ["Testersen"],
                        "email": ["test@example.com"],
                    }
                },
            }
        )
        session.save()
        self.client.cookies["back"] = "/foobar"
        response = self.client.get(
            reverse("login:login_forward", kwargs={"provider": "mitid"})
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobar")

    def test_redirect(self):
        session = self.client.session
        session["saml"] = {"cpr": "1234567890"}
        session.save()
        response = self.client.get(
            reverse("login:login_forward", kwargs={"provider": "mitid"})
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("login:mitid:login"))

    def test_logout_redirect(self):
        self.client.login(username="test", password="test")
        session = self.client.session
        session.update(
            {
                BACKEND_SESSION_KEY: "django_mitid_auth.saml.backend.Saml2Backend",
                "saml": {"cpr": "1234567890"},
            }
        )
        session.save()
        response = self.client.get(reverse("login:logout"))
        self.assertEqual(response.headers["Location"], reverse("login:mitid:logout"))


@override_settings(PUBLIC=True)
class OIDCLoginTest(LoginTest):
    def test_already_logged_in(self):
        url = reverse("dysleksi:root")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:login") + "?next=/",
        )

    def test_redirect(self):
        response = self.client.get(
            reverse("login:login_forward", kwargs={"provider": "unilogin"})
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse("login:unilogin:oidc_authentication_init"),
        )

    def test_logout_redirect(self):
        self.client.login(username="test", password="test")
        session = self.client.session
        session.update(
            {
                BACKEND_SESSION_KEY: (
                    "login.authentication_backend.DysleksiOIDCAuthenticationBackend"
                ),
            }
        )
        session.save()
        response = self.client.get(reverse("login:logout"))
        self.assertEqual(
            response.headers["Location"], reverse("login:unilogin:oidc_logout")
        )


@override_settings(
    BYPASS_2FA=False, REQUIRE_2FA=True, LANGUAGE_CODE="da-dk", PUBLIC=False
)
class Django2FaLoginTest(LoginTest):
    def test_redirect_to_login_needs_2fa(self):
        self.client.force_login(self.staff_user)
        response = self.client.get(reverse("dysleksi:root"))
        self.assertIn(
            "two_factor/core/otp_required.html", [t.name for t in response.templates]
        )

    @override_settings(REQUIRE_2FA=False)
    def test_context(self):
        self.client.force_login(self.staff_user)
        response = self.client.get(reverse("dysleksi:root"))
        context = response.context
        self.assertTrue("user_twofactor_enabled" in context)
        self.assertEqual(context["user_twofactor_enabled"], False)

    def test_django_login_form(self):
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}),
            {
                "auth-username": "test",
                "auth-password": "test",
                "login_forward_view-current_step": "auth",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")
        response = self.client.get(reverse("login:login") + "?back=/foobar")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobar")

    @override_settings(PUBLIC=True)
    def test_public_django_login_form(self):
        self.client.get(reverse("login:login_forward", kwargs={"provider": "django"}))
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}),
            {
                "auth-username": "test",
                "auth-password": "test",
                "login_forward_view-current_step": "auth",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")
        response = self.client.get(reverse("login:login") + "?back=/foobar")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobar")

    @override_settings()
    def test_django_login_form_incorrect(self):
        self.client.get(reverse("login:login_forward", kwargs={"provider": "django"}))
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}),
            {
                "auth-username": "test",
                "auth-password": "incorrect",
                "login_forward_view-current_step": "auth",
            },
        )
        self.assertEqual(response.status_code, 200)
        soup = BeautifulSoup(response.content, "html.parser")
        alert = soup.find(class_="errorlist")
        self.assertIsNotNone(alert)
        self.assertIn("Indtast venligst korrekt brugernavn og adgangskode", str(alert))

    def test_django_logout_redirect(self):
        self.client.login(username="test", password="test")
        response = self.client.get(reverse("login:logout"))
        self.assertEqual(response.headers["Location"], settings.LOGOUT_REDIRECT_URL)

    @override_settings(PUBLIC=True)
    def test_public_django_logout_redirect(self):
        self.client.login(username="test", password="test")
        response = self.client.get(reverse("login:logout"))
        self.assertEqual(response.headers["Location"], settings.LOGOUT_REDIRECT_URL)

    def test_django_login_back(self):
        self.client.cookies["back"] = "/foobar"
        self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}),
            {
                "auth-username": "test",
                "auth-password": "test",
                "login_forward_view-current_step": "auth",
            },
        )
        response = self.client.get(reverse("login:login"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobar")

        self.client.logout()

        self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"})
            + "?back=/foobaz",
            {
                "auth-username": "test",
                "auth-password": "test",
                "login_forward_view-current_step": "auth",
            },
        )
        response = self.client.get(reverse("login:login"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/foobaz")

    def test_token_step(self):
        device = self.staff_user.totpdevice_set.create(name="default", key=random_hex())
        data = {
            "auth-username": "test",
            "auth-password": "test",
            "login_forward_view-current_step": "auth",
        }
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}), data
        )
        self.assertContains(response, "Kode:")

        data = {
            "token-otp_token": "123456",
            "login_forward_view-current_step": "token",
        }
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}), data
        )
        self.assertEqual(
            response.context_data["wizard"]["form"].errors,
            {
                "__all__": [
                    "Invalid token. Please make sure you have entered it correctly."
                ]
            },
        )

        data = {
            "token-otp_token": totp_str(device.bin_key),
            "login_forward_view-current_step": "token",
        }
        device.throttle_reset()

        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}), data
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    @override_settings(BYPASS_2FA=True)
    def test_bypass_token_step(self):
        self.staff_user.totpdevice_set.create(name="default", key=random_hex())

        data = {
            "auth-username": "test",
            "auth-password": "test",
            "login_forward_view-current_step": "auth",
        }
        response = self.client.post(
            reverse("login:login_forward", kwargs={"provider": "django"}), data
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    def test_two_factor_setup(self):
        self.client.login(username="test", password="test")

        response = self.client.post(
            reverse("login:two_factor_setup"),
            data={"two_factor_setup-current_step": "generator"},
        )

        self.assertEqual(
            response.context_data["wizard"]["form"].errors,
            {"token": ["Dette felt er påkrævet."]},
        )

        response = self.client.post(
            reverse("login:two_factor_setup"),
            data={
                "two_factor_setup-current_step": "generator",
                "generator-token": "123456",
            },
        )
        self.assertEqual(
            response.context_data["wizard"]["form"].errors,
            {"token": ["Den indtastet kode er ikke gyldig."]},
        )

        key = response.context_data["keys"].get("generator")
        bin_key = unhexlify(key.encode())
        response = self.client.post(
            reverse("login:two_factor_setup"),
            data={
                "two_factor_setup-current_step": "generator",
                "generator-token": totp(bin_key),
            },
        )

        success_url = reverse("dysleksi:root") + "?two_factor_success=1"

        self.assertEqual(1, self.staff_user.totpdevice_set.count())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], success_url)

    def test_2fa_required(self):
        self.client.login(username="test", password="test")
        self.assertEqual(0, self.staff_user.totpdevice_set.count())

        response = self.client.get(reverse("dysleksi:root"))

        self.assertTemplateUsed(response, "two_factor/core/otp_required.html")
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)


class LoginTimeoutTest(LoginTest):
    def test_session_expired_call(self):
        self.client.login(username="test", password="test")
        session = self.client.session
        session["_session_init_timestamp_"] = time.time() - 10
        session.save()
        with self.settings(SESSION_EXPIRE_SECONDS=1):
            with patch.object(views, "on_session_expired") as mock_method:
                mock_method.return_value = None
                self.client.get("/")
                mock_method.assert_called()

    def test_on_session_expired(self):
        request_factory = RequestFactory()
        self.assertIsNone(
            on_session_expired(
                request_factory.get(reverse("login:mitid:logout-callback"))
            )
        )
        with self.settings(SESSION_TIMEOUT_REDIRECT=reverse("dysleksi:root")):
            response = on_session_expired(request_factory.get("/foobar"))
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.headers.get("location"), reverse("dysleksi:root"))
        with self.settings(SESSION_TIMEOUT_REDIRECT=None):
            response = on_session_expired(request_factory.get("/foobar"))
            self.assertEqual(response.status_code, 302)
            self.assertEqual(
                response.headers.get("location"),
                reverse("login:login") + "?next=" + "/foobar",
            )
