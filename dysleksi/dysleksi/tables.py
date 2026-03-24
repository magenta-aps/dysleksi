from typing import List

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
        verbose_name=_("Klassetrin"),
    )

    school_year = tables.Column(
        verbose_name=_("Skoleår"),
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
