from typing import Callable, List

from django.db.models import QuerySet
from django.template import Context
from django.template.loader import get_template
from django.utils.translation import gettext_lazy as _
from django_tables2 import A, Table, TemplateColumn, tables

from dysleksi.models import Class, Student, TestAssignment


class ClassTable(Table):
    class Meta:
        model = Class
        fields: List[str] = []

    klasse = tables.Column(
        linkify=False,
        accessor="name",
        orderable=False,
        verbose_name=_("Klasse"),
    )

    school_year = tables.Column(
        verbose_name=_("Skoleår"),
    )

    def order_school_year(self, queryset: QuerySet[Class, Class], is_descending: bool):
        return (
            queryset.order_by(("-" if is_descending else "") + "school_year_start"),
            True,
        )

    number_of_students = tables.Column(
        accessor=A("students__count"),
        orderable=False,
        verbose_name=_("Antal elever"),
    )

    status = tables.Column(
        accessor=A("status"),
        orderable=False,
        verbose_name=_("Status"),
    )

    actions = TemplateColumn(
        template_name="dysleksi/admin/table_columns/class_actions.html",
        orderable=False,
        verbose_name=_("Handlinger"),
    )


class StudentTable(Table):
    class Meta:
        model = Student
        fields: List[str] = []

    name = TemplateColumn(
        template_name="dysleksi/admin/table_columns/student_name.html",
        orderable=False,
        verbose_name=_("Navn"),
    )

    klasse = tables.Column(
        linkify=False,
        accessor=A("klasse__name"),
        orderable=False,
        verbose_name=_("Klassetrin"),
    )

    status = tables.Column(
        accessor=A("status"),
        orderable=False,
        verbose_name=_("Status"),
    )

    actions = TemplateColumn(
        template_name="dysleksi/admin/table_columns/student_actions.html",
        orderable=False,
        verbose_name=_("Handlinger"),
    )


class TestAssignmentTable(Table):
    class Meta:
        model = TestAssignment
        fields: List[str] = []

    name = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_assignment_name.html",
        orderable=False,
        verbose_name=_("Navn"),
    )

    type = tables.Column(
        accessor=A("test__test_type"),
        verbose_name=_("Type"),
    )

    test = tables.Column(
        accessor=A("test__name"),
        verbose_name=_("Test"),
    )

    number_of_students = tables.Column(
        accessor=A("number_of_students"),
        orderable=False,
        verbose_name=_("Antal elever"),
    )

    status = tables.Column(
        accessor=A("status"),
        orderable=False,
        verbose_name=_("Status"),
    )

    actions = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_assignment_actions.html",
        orderable=False,
        verbose_name=_("Handlinger"),
    )


class TestResultTable(Table):

    class Meta:
        attrs = {"class": "table table-first-col-bordered"}

    student = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_response_student_name.html",
        verbose_name=_("Elev"),
        footer=_("Gennemsnit"),
    )


class TestResultColumn(TemplateColumn):

    def __init__(
        self,
        footer_template_name: str,
        average_value_modifier: Callable | None = None,
        *args,
        **kwargs
    ):
        super().__init__(args, **kwargs)
        self.footer_template_name = footer_template_name
        self.average_value_modifier = average_value_modifier

    def render_footer(self, bound_column, table):
        # Get average
        count = len(table.data)
        if count > 0:
            total = sum(bound_column.accessor.resolve(row) for row in table.data)
            value = total / count
        else:
            value = None

        if self.average_value_modifier:
            value = self.average_value_modifier(value)

        # Render footer
        context = getattr(table, "context", Context())
        additional_context = {
            "default": bound_column.default,
            "column": bound_column,
            "value": value,
        }
        additional_context.update(self.extra_context)
        with context.update(additional_context):
            return get_template(self.footer_template_name).render(context.flatten())
