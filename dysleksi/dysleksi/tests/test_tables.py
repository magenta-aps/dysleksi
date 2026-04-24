from html import escape
from unittest.mock import patch

from django.template import engines
from django.test import TestCase
from django_tables2 import Table

import dysleksi
from dysleksi.tables import TestResultColumn


class TestTestResultColumn(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.template_engine = engines["django"]

    def test_render_footer(self):
        column = TestResultColumn(
            template_name="test.html",
            footer_template_name="test.html",
            verbose_name="TestColumn",
            accessor="abc",
        )
        table = Table(data=[{"abc": 10}, {"abc": 20}], extra_columns=[("test", column)])

        with patch.object(dysleksi.tables, "get_template") as mock_get_template:
            mock_get_template.return_value = self.template_engine.from_string(
                "{{value}}"
            )
            footer = table.columns["test"].footer
            self.assertEqual(footer, "15,0")

    def test_render_footer_with_modifier(self):
        column = TestResultColumn(
            template_name="test.html",
            footer_template_name="test.html",
            verbose_name="TestColumn",
            accessor="abc",
            average_value_modifier=lambda v: {"value": v, "foo": "bar"},
        )
        table = Table(data=[{"abc": 10}, {"abc": 20}], extra_columns=[("test", column)])

        with patch.object(dysleksi.tables, "get_template") as mock_get_template:
            mock_get_template.return_value = self.template_engine.from_string(
                "{{value}}"
            )
            footer = table.columns["test"].footer
            self.assertEqual(footer, escape(str({"value": 15.0, "foo": "bar"})))

    def test_render_footer_with_no_rows(self):
        column = TestResultColumn(
            template_name="test.html",
            footer_template_name="test.html",
            verbose_name="TestColumn",
            accessor="abc",
        )
        table = Table(data=[], extra_columns=[("test", column)])

        with patch.object(dysleksi.tables, "get_template") as mock_get_template:
            mock_get_template.return_value = self.template_engine.from_string(
                "{{value}}"
            )
            footer = table.columns["test"].footer
            self.assertEqual(footer, "None")
