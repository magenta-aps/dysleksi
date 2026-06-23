# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import datetime

from django.test import SimpleTestCase
from django.utils import timezone
from psycopg.types.range import Range

from dysleksi.templatetags.get import get, range_attr


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
