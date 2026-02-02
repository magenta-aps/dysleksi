# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.http import HttpRequest
from django.test import SimpleTestCase
from django.urls import ResolverMatch

from dysleksi.context_processors import nav_context


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
