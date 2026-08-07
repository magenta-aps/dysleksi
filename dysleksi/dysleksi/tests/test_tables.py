from html import escape
from unittest.mock import patch

from django.db.models import F
from django.db.models.functions import Lower, Upper
from django.template import engines
from django.test import TestCase
from django_tables2 import Table

import dysleksi
from dysleksi.models import TestAssignment
from dysleksi.tables import TestAssignmentTable, TestResultColumn
from dysleksi.tests.base import DysleksiTest


class TestTestAssignmentTable(DysleksiTest):
    def setUp(self):
        super().setUp()
        self.queryset = (
            TestAssignment.objects.annotate_school_year()
            .annotate_class_name()
            .annotate_status()
        )
        self.table = TestAssignmentTable(data=self.queryset)

    def test_order_type(self):
        queryset, _ = self.table.order_type(self.queryset, is_descending=False)
        self._assert_order_by_expression_is(queryset, F("test__test_type"))

    def test_order_status(self):
        queryset, _ = self.table.order_status(self.queryset, is_descending=False)
        self._assert_order_by_expression_is(queryset, F("status"))

    def test_order_start_date(self):
        queryset, _ = self.table.order_start_date(self.queryset, is_descending=False)
        self._assert_order_by_expression_is(
            queryset, Lower("planned_date_time__period")
        )

    def test_order_end_date(self):
        queryset, _ = self.table.order_end_date(self.queryset, is_descending=False)
        self._assert_order_by_expression_is(
            queryset, Upper("planned_date_time__period")
        )

    def _assert_order_by_expression_is(self, queryset, expected_expression):
        order_by = queryset.query.order_by[0]
        self.assertEqual(order_by.expression, expected_expression)
        self.assertFalse(order_by.descending)


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
