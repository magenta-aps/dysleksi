# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest
from django.test import SimpleTestCase
from django.urls import ResolverMatch, reverse

from dysleksi.context_processors import (
    auto_logout_context,
    client_error_log_context,
    nav_context,
)
from dysleksi.models import User


class TestNavContext(SimpleTestCase):
    def test_returns_view_name(self):
        # Arrange: provide `request` object with valid `.resolver_match` attribute
        request = HttpRequest()
        request.resolver_match = ResolverMatch(
            None,  # type: ignore
            None,  # type: ignore
            None,  # type: ignore
            url_name="root",
            namespaces=["dysleksi"],
        )
        # Act
        context = nav_context(request)
        # Assert
        self.assertEqual(context["current_view"], "dysleksi:root")

    def test_returns_none(self):
        # Arrange: provide `request` object where `.resolver_match` is None
        request = HttpRequest()
        # Act
        context = nav_context(request)
        # Assert
        self.assertIsNone(context["current_view"])


class TestAutoLogoutContext(SimpleTestCase):
    def request(self, user, url_name: str) -> HttpRequest:
        request = HttpRequest()
        request.user = user  # type: ignore
        request.resolver_match = ResolverMatch(
            None,  # type: ignore
            None,  # type: ignore
            None,  # type: ignore
            url_name=url_name,
            namespaces=["dysleksi"],
        )
        return request

    def test_logs_out_an_inactive_user(self):
        # Act
        config = auto_logout_context(self.request(User(), "class_list"))[
            "AUTO_LOGOUT_CONFIG"
        ]
        # Assert
        self.assertTrue(config["enabled"])
        self.assertTrue(config["logout_on_idle"])
        self.assertEqual(config["timeout"], settings.SESSION_IDLE_TIMEOUT)
        self.assertEqual(config["ping_url"], reverse("dysleksi:ping"))
        self.assertEqual(config["logout_url"], reverse("login:logout"))

    def test_does_not_log_out_during_a_test(self):
        # Act: the page of a test, seen by teachers as well as students
        config = auto_logout_context(self.request(User(), "room"))["AUTO_LOGOUT_CONFIG"]
        # Assert
        self.assertTrue(config["enabled"])
        self.assertFalse(config["logout_on_idle"])

    def test_disabled_for_anonymous_users(self):
        # Act
        config = auto_logout_context(self.request(AnonymousUser(), "root"))[
            "AUTO_LOGOUT_CONFIG"
        ]
        # Assert
        self.assertFalse(config["enabled"])


class TestClientErrorLogContext(SimpleTestCase):
    def test_returns_url_and_csrf_token(self):
        # Arrange
        request = HttpRequest()
        # Act
        config = client_error_log_context(request)["CLIENT_ERROR_LOG_CONFIG"]
        # Assert
        self.assertEqual(config["url"], reverse("dysleksi:client_error_log"))
        self.assertTrue(config["csrf_token"])
        # A token was made available for the response cookie as well
        self.assertIn("CSRF_COOKIE", request.META)
