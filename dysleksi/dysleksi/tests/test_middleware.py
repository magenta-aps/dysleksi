# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from django.utils import translation
from django.utils.translation import get_language

from dysleksi.middleware import StudentLanguageMiddleware
from dysleksi.tests.base import DysleksiTest


class TestStudentLanguageMiddleware(DysleksiTest):
    def get_language_for(self, user) -> tuple[str, str]:
        request = RequestFactory().get("/")
        request.user = user
        middleware = StudentLanguageMiddleware(lambda request: get_language())
        with translation.override("da"):
            return middleware(request), getattr(request, "LANGUAGE_CODE", "da")

    def test_language(self):
        cases = [
            (self.student1, "kl"),
            (self.teacher, "da"),
            (AnonymousUser(), "da"),
        ]
        for user, expected_language in cases:
            with self.subTest(user=user):
                self.assertEqual(
                    self.get_language_for(user),
                    (expected_language, expected_language),
                )
