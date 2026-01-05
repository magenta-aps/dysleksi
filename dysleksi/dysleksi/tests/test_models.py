# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from dysleksi.models import User, UserType
from dysleksi.tests.base import DysleksiTest


class TestUser(DysleksiTest):
    def test_str(self):
        cases: list[tuple[User, UserType]] = [
            (self.student, "student (STUDENT)"),
            (self.teacher, "teacher (TEACHER)"),
        ]
        for user, expected_str in cases:
            with self.subTest(user=user, expected_str=expected_str):
                self.assertEqual(str(user), expected_str)

    def test_user_type(self):
        cases: list[tuple[User, UserType]] = [
            (self.student, UserType.Student),
            (self.teacher, UserType.Teacher),
        ]
        for user, expected_user_type in cases:
            with self.subTest(user=user, expected_user_type=expected_user_type):
                self.assertIs(user.user_type, expected_user_type)
