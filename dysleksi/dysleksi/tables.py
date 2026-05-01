from itertools import count
from typing import Callable, List

from django.db.models import QuerySet
from django.template import Context
from django.template.loader import get_template
from django.utils.translation import gettext_lazy as _
from django_tables2 import A, Column, Table, TemplateColumn, tables

from dysleksi.models import Class, ResultCategoryRange, Student, TestAssignment


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

    def __init__(self, *args, **kwargs):
        super().__init__(
            template_name="dysleksi/admin/test_assignment/result_group_table.html",
            *args,
            **kwargs,
        )

    student = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_response_student_name.html",
        verbose_name=_("Elev"),
        footer=_("Gennemsnit"),
    )

    def as_html(self, request):
        """
        Render the table to an HTML table, adding `request` to the context.
        """
        # reset counter for new rendering
        self._counter = count()
        template = get_template(self.template_name)

        context = {"table": self, "request": request}

        self.before_render(request)
        return template.render(context, request)


class TestResultColumn(TemplateColumn):

    def __init__(
        self,
        footer_template_name: str,
        average_value_modifier: Callable | None = None,
        subgroups=List[ResultCategoryRange],
        *args,
        **kwargs,
    ):
        super().__init__(args, **kwargs)
        self.footer_template_name = footer_template_name
        self.average_value_modifier = average_value_modifier
        self.subgroups = subgroups

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


class PartResultTable(Table):
    student = Column(
        # template_name="dysleksi/admin/table_columns/part_response_student_name.html",
        verbose_name=_("Elev"),
        accessor=A("testresponse__student"),
    )
    responses_count = Column(
        verbose_name=_("Forsøgte"),
        accessor=A("responses_count"),
    )
    correct_count = Column(
        verbose_name=_("Rigtige"),
        accessor=A("correct_count"),
    )
    correct_proportion = Column(
        verbose_name=_("Rigtighedsprocent"),
        accessor=A("correct_proportion"),
    )
    normscore = TemplateColumn(
        verbose_name=_("Normscore (0-100)"),
        template_name="dysleksi/admin/table_columns/part_response_normscore.html",
        accessor=A("correct_percentage"),
    )

    def render_student(self, value, record):
        return f"{record.rank}. {value.get_full_name()}"

    def render_correct_proportion(self, value):
        return f"{int(value * 100)}%"


class EmptyColumn(Column):

    def __init__(self, *args, **kwargs):
        super().__init__(orderable=False, *args, **kwargs)

    empty_values = ()

    def header(self):
        return ""

    def render(self, value):
        return ""
