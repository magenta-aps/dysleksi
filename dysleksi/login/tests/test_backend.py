from django.test import TestCase
from login.authentication_backend import DysleksiOIDCAuthenticationBackend

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
