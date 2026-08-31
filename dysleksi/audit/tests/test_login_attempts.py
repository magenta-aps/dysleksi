# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from audit.models import LoginAttempt, LoginResult
from django.contrib.auth import authenticate
from django.test import RequestFactory, TestCase

from dysleksi.models import User


class LoginAttemptTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user = User.objects.create(username="testuser")
        cls.user.set_password("hemmeligt-kodeord")
        cls.user.save()

    def authenticate(self, username: str, password: str):
        request = RequestFactory().post("/login/", REMOTE_ADDR="10.0.0.5")
        return authenticate(request, username=username, password=password)

    def test_successful_login_is_logged(self):
        self.client.force_login(self.user)

        attempt = LoginAttempt.objects.get()
        self.assertEqual(attempt.user, self.user)
        self.assertEqual(attempt.username, "testuser")
        self.assertEqual(attempt.result, LoginResult.SUCCESS)
        self.assertIsNotNone(attempt.timestamp)

    def test_wrong_password_is_logged_with_user(self):
        self.assertIsNone(self.authenticate("testuser", "forkert"))

        attempt = LoginAttempt.objects.get()
        # The username exists, so the failed attempt can be traced to the user
        self.assertEqual(attempt.user, self.user)
        self.assertEqual(attempt.username, "testuser")
        self.assertEqual(attempt.result, LoginResult.FAILURE)
        self.assertEqual(attempt.ip_address, "10.0.0.5")

    def test_unknown_username_is_logged_without_user(self):
        self.assertIsNone(self.authenticate("findes-ikke", "hemmeligt-kodeord"))

        attempt = LoginAttempt.objects.get()
        self.assertIsNone(attempt.user)
        self.assertEqual(attempt.username, "findes-ikke")
        self.assertEqual(attempt.result, LoginResult.FAILURE)

    def test_login_records_backend(self):
        user = authenticate(
            RequestFactory().post("/login/"),
            username="testuser",
            password="hemmeligt-kodeord",
        )
        self.client.force_login(user, backend=user.backend)

        attempt = LoginAttempt.objects.get(result=LoginResult.SUCCESS)
        self.assertEqual(attempt.backend, "django.contrib.auth.backends.ModelBackend")

    def test_ip_from_forwarded_for_header(self):
        request = RequestFactory().post(
            "/login/",
            REMOTE_ADDR="172.17.0.1",
            HTTP_X_FORWARDED_FOR="192.0.2.10, 172.17.0.1",
        )
        authenticate(request, username="testuser", password="forkert")

        attempt = LoginAttempt.objects.get()
        self.assertEqual(attempt.ip_address, "192.0.2.10")

    def test_login_attempt_str(self):
        self.client.force_login(self.user)
        attempt = LoginAttempt.objects.get()
        self.assertIn("testuser", str(attempt))
        self.assertIn(LoginResult.SUCCESS, str(attempt))
