from django.test import TestCase

from dysleksi.templatetags.get import get


class TestTagGet(TestCase):

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
