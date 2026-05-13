from urllib.parse import urlencode

from django.conf import settings
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import TestCase
from django.test.client import RequestFactory
from login.authentication_backend import (
    DysleksiOIDCAuthenticationBackend,
    unilogin_logout,
)

from dysleksi.models import User


class DysleksiOIDCABTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create(
            username="test",
            uniid="1234",
        )
        cls.backend = DysleksiOIDCAuthenticationBackend()

    def test_filter_no_uniid(self):
        result = self.backend.filter_users_by_claims({"not_uniid": "too bad"})
        self.assertQuerySetEqual([], result)

    def test_filter_user_does_not_exist(self):
        result = self.backend.filter_users_by_claims({"uniid": "87658765"})
        self.assertQuerySetEqual([], result)

    def test_filter_get_user(self):
        result = self.backend.filter_users_by_claims({"uniid": "1234"})
        self.assertEqual(result, [self.user])

    def test_unilogin_logout_url(self):
        request = RequestFactory().get("/")

        middleware = SessionMiddleware(lambda req: None)
        middleware.process_request(request)
        request.session["oidc_id_token"] = "TOKEN"
        request.session.save()

        logout_url = unilogin_logout(request)
        self.assertIn("TOKEN", logout_url)
        path = urlencode(
            {
                "post_logout_redirect_uri": settings.HOST_DOMAIN
                + settings.LOGOUT_REDIRECT_URL
            }
        )
        self.assertIn(path, logout_url)
