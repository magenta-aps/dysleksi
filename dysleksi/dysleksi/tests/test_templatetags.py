# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import datetime
from unittest.mock import MagicMock

from django.template import Context, Template
from django.test import SimpleTestCase
from django.utils import timezone
from psycopg.types.range import Range

from dysleksi.templatetags.get import get, range_attr
from dysleksi.templatetags.permissions import has_permission
from dysleksi.tests.base import DysleksiTest


class TestTagGet(SimpleTestCase):

    def test_none(self):
        self.assertIsNone(get(None, "a"))

    def test_dict(self):
        self.assertEqual(get({"a": 2}, "a"), 2)
        self.assertEqual(get({"2": 4}, "2"), 4)
        self.assertEqual(get({"2": 4}, 2), 4)
        self.assertIsNone(get({"2", 4}, "d"))

    def test_list(self):
        self.assertEqual(get([1, 2, 3], 1), 2)
        self.assertEqual(get([1, 2, 3], "2"), 3)
        self.assertIsNone(get([1, 2, 3], 4))

    def test_tuple(self):
        self.assertEqual(get((1, 2, 3), 1), 2)
        self.assertEqual(get((1, 2, 3), "2"), 3)
        self.assertIsNone(get((1, 2, 3), 4))

    def test_object(self):
        class TestObject:
            def __init__(self, x):
                self.x = x

        self.assertEqual(get(TestObject(3), "x"), 3)
        self.assertIsNone(get(TestObject(3), "y"))

    def test_string(self):
        self.assertIsNone(get("abc", "a"))


class TestTagRangeAttr(SimpleTestCase):
    def test_range_attr_valid_input(self):
        start, end = timezone.now(), timezone.now() + datetime.timedelta(hours=1)
        datetime_range = Range(start, end)
        self.assertEqual(range_attr(datetime_range, "lower"), start)
        self.assertEqual(range_attr(datetime_range, "upper"), end)

    def test_range_attr_invalid_input(self):
        self.assertEqual(range_attr(None, "lower"), "-")
        self.assertEqual(range_attr(None, "invalid"), "-")


class TestCancelTestModals(SimpleTestCase):

    common_selectors = (
        'id="cancel-test"',
        'class="uncompleted-students d-none"',
        "confirm-btn",
    )

    def test_group_test_modal(self):
        # The group test modal lists the students who have not completed it
        self.assert_renders(
            "cancel_group_test_modal", 'class="student-list"', "Følgende elever"
        )

    def test_individual_test_modal(self):
        # The individual test modal is about a single student, so it has no list
        self.assert_renders("cancel_individual_test_modal", "Eleven har ikke")
        self.assertNotIn("student-list", self.render("cancel_individual_test_modal"))

    def assert_renders(self, tag, *selectors):
        rendered = self.render(tag)
        for selector in self.common_selectors + selectors:
            with self.subTest(tag=tag, selector=selector):
                self.assertIn(selector, rendered)

    def render(self, tag) -> str:
        return Template("{%% load modals %%}{%% %s %%}" % tag).render(Context())


class TestHasPermission(DysleksiTest):
    def test_handles_user_with_permission(self):
        self.assertTrue(self._has_permission(self.klasse, self.teacher, "view"))

    def test_handles_user_without_permission(self):
        self.assertFalse(self._has_permission(self.klasse, self.other_teacher, "view"))

    def test_handles_object_without_permissions_mixin(self):
        self.assertTrue(self._has_permission(self.school, self.teacher, "view"))

    def _has_permission(self, obj, user, action):
        mock_request = MagicMock()
        mock_request.user = user
        mock_context = {"request": mock_request}
        return has_permission(mock_context, obj, action)
