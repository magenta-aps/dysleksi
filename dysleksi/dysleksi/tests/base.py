# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.test import TestCase
from django.test.client import RequestFactory

from dysleksi.models import User


class DysleksiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.student = cls.create_user("student", cvr=None)
        cls.teacher = cls.create_user("teacher", cvr=1234)

    @classmethod
    def create_user(cls, username: str, cvr: int | None = None) -> User:
        user, _ = User.objects.update_or_create(
            username=username,
            cpr="0101012222",
            cvr=cvr,
        )
        return user

    def setup_view(self, view_class, user: User):
        request_factory = RequestFactory()
        request = request_factory.get("")
        request.user = user
        view = view_class()
        view.setup(request)
        return view
