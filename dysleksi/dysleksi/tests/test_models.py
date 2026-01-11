# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from freezegun import freeze_time

from dysleksi.models import STUDENTS, TEACHERS, User
from dysleksi.tests.base import DysleksiTest


class TestUser(DysleksiTest):
    def test_str(self):
        unknown_user = User(
            username="UnknownUser", first_name="Unknown", last_name="User"
        )
        cases: list[tuple[User, str]] = [
            (self.admin, "Test Admin (Administrator)"),
            (self.student, "Test Elev (Elev)"),
            (self.teacher, "Test Lærer (Lærer)"),
            (unknown_user, "Unknown User (Ukendt brugertype)"),
        ]
        for user, expected_str in cases:
            with self.subTest(user=user, expected_str=expected_str):
                self.assertEqual(str(user), expected_str)

    def test_group(self):
        cases: list[tuple[User, str]] = [
            (self.student, STUDENTS),
            (self.teacher, TEACHERS),
        ]
        for user, expected_groupname in cases:
            with self.subTest(user=user, expected_str=expected_groupname):
                self.assertTrue(user.has_group(expected_groupname))


class TestClass(DysleksiTest):
    def test_str(self):
        self.assertEqual(self.klasse.start_year, 2025)
        with freeze_time("2025-08-01"):
            self.assertEqual(str(self.klasse), "1.A")
        with freeze_time("2026-01-01"):
            self.assertEqual(str(self.klasse), "1.A")
        with freeze_time("2026-06-30"):
            self.assertEqual(str(self.klasse), "1.A")

        with freeze_time("2026-07-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2026-08-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2027-01-01"):
            self.assertEqual(str(self.klasse), "2.A")
        with freeze_time("2027-06-30"):
            self.assertEqual(str(self.klasse), "2.A")

        with freeze_time("2027-07-01"):
            self.assertEqual(str(self.klasse), "3.A")
