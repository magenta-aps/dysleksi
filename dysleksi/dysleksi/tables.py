from copy import copy
from datetime import timedelta
from itertools import count
from math import ceil
from typing import Callable, Collection, List, Tuple

from django.db.models import QuerySet
from django.template import Context
from django.template.loader import get_template
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django_tables2 import A, Column, Table, TemplateColumn, tables

from dysleksi.models import (
    CategoryRange,
    Class,
    Student,
    TestAssignment,
    TestAssignmentStatus,
    TestPart,
)
from dysleksi.utils import format_time


class NonOrderableTableMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(orderable=False, *args, **kwargs)


class HeaderlessTableMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(show_header=False, *args, **kwargs)


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

    # status = tables.Column(
    #     accessor=A("status"),
    #     orderable=False,
    #     verbose_name=_("Status"),
    # )
    #
    # actions = TemplateColumn(
    #     template_name="dysleksi/admin/table_columns/class_actions.html",
    #     orderable=False,
    #     verbose_name=_("Handlinger"),
    # )


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

    # status = tables.Column(
    #     accessor=A("status"),
    #     orderable=False,
    #     verbose_name=_("Status"),
    # )
    #
    # actions = TemplateColumn(
    #     template_name="dysleksi/admin/table_columns/student_actions.html",
    #     orderable=False,
    #     verbose_name=_("Handlinger"),
    # )


def _test_assignment_title(record):
    subject = record.student.get_full_name() if record.student else record.klasse.name
    return f"{subject} - {record.test}"


class TestAssignmentTable(Table):
    class Meta:
        model = TestAssignment
        fields: List[str] = []

    name = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_assignment_name.html",
        orderable=False,
        verbose_name=_("Navn"),
        attrs={
            "td": {
                "class": "truncate-cell",
                "title": _test_assignment_title,
            }
        },
    )

    type = tables.Column(
        accessor=A("test__test_type"),
        verbose_name=_("Type"),
    )

    test = tables.Column(
        accessor=A("test__name"),
        verbose_name=_("Test"),
        attrs={
            "td": {
                "class": "truncate-cell",
                "title": lambda record: str(record.test),
            }
        },
    )

    number_of_students = tables.Column(
        accessor=A("number_of_students"),
        orderable=False,
        verbose_name=_("Antal elever"),
    )

    status = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_assignment_status.html",
        orderable=False,
        verbose_name=_("Status"),
        extra_context={"TestAssignmentStatus": TestAssignmentStatus},
    )

    actions = TemplateColumn(
        template_name="dysleksi/admin/table_columns/test_assignment_actions.html",
        orderable=False,
        verbose_name=_("Handlinger"),
        extra_context={"TestAssignmentStatus": TestAssignmentStatus},
    )


class TestResultTable(Table):

    class Meta:
        attrs = {"class": "table table-first-col-bordered"}

    def __init__(self, *args, **kwargs):
        super().__init__(
            template_name="dysleksi/admin/test_responses/group/table.html",
            *args,
            **kwargs,
        )

    student = TemplateColumn(
        template_name="dysleksi/admin/test_responses/group/student_name.html",
        verbose_name=_("Elev"),
        footer=_("Gennemsnit"),
        order_by=["student__first_name", "student__last_name"],
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


class FooterColumnMixin(Column):
    def __init__(
        self,
        footer_template_name: str,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.footer_template_name = footer_template_name

    def get_footer_value(self, bound_column, table):
        # Override in subclasses
        return None  # pragma: no cover

    def get_footer_additional_context(self, bound_column, table):
        # Render footer
        additional_context = {
            "default": bound_column.default,
            "column": bound_column,
            "value": self.get_footer_value(bound_column, table),
        }
        if hasattr(self, "extra_context"):
            additional_context.update(self.extra_context)
        return additional_context

    def render_footer(self, bound_column, table):
        context = getattr(table, "context", Context())
        additional_context = self.get_footer_additional_context(bound_column, table)
        with context.update(additional_context):
            return get_template(self.footer_template_name).render(context.flatten())


class TestResultColumn(FooterColumnMixin, TemplateColumn):

    def __init__(
        self,
        average_value_modifier: Callable | None = None,
        subgroups: List[CategoryRange] | None = None,
        assignment: TestAssignment | None = None,
        part: TestPart | None = None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.average_value_modifier = average_value_modifier
        self.subgroups = subgroups
        self.assignment = assignment
        self.part = part

    def get_footer_value(self, bound_column, table):
        count = len(table.data)
        if count > 0:
            total = sum(bound_column.accessor.resolve(row) for row in table.data)
            value = total / count
        else:
            value = None

        if self.average_value_modifier:
            value = self.average_value_modifier(value)
        return value


class PartResultTable(Table):
    student = Column(
        verbose_name=_("Elev"),
        accessor=A("testresponse__student"),
        linkify=lambda record: reverse(
            "dysleksi:test_assignment_part_result",
            kwargs={
                "assignment_pk": record.testresponse.assignment_id,
                "testpart_pk": record.testpart_id,
                "testresponse_pk": record.testresponse_id,
            },
        ),
        order_by=[
            "testresponse__student__first_name",
            "testresponse__student__last_name",
        ],
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
        template_name="dysleksi/admin/part_responses/group/normscore_bar.html",
        accessor=A("correct_percentage"),
    )

    def render_student(self, value, record):
        return value.get_full_name()

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


class StudentTestResponseTable(NonOrderableTableMixin, Table):

    data_category = Column(verbose_name="", footer=_("Bedømmelse"))

    def __init__(self, *args, **kwargs):
        super().__init__(
            *args,
            template_name="dysleksi/admin/test_response/table.html",
            **kwargs,
        )


def column_group(
    group_label: str, *columns: Tuple[str, Column]
) -> Collection[Tuple[str, Column]]:
    group_dict = {"label": group_label, "count": len(columns), "first": False}
    for key, column in columns:
        column.group = copy(group_dict)
    first_column = columns[0][1]
    first_column.group["first"] = True
    return columns


class StudentTestResultsColumn(FooterColumnMixin, Column):

    def __init__(self, footer_value: Callable, *args, **kwargs):
        self.footer_value = footer_value
        super().__init__(*args, **kwargs)

    def get_footer_value(self, bound_column, table):
        data = [bound_column.accessor.resolve(row) for row in table.data]
        return self.footer_value(data)


class AnswerByTimeResultsTable(NonOrderableTableMixin, HeaderlessTableMixin, Table):
    time_slot = Column()
    correct_count = Column(verbose_name=_("Rigtige"))

    def render_time_slot(self, value):
        lower, upper = value
        if lower is None and upper is None:
            return _("Alle")
        if lower is None:
            return _("Første {x} minutter").format(x=upper)
        if upper is None:
            return _("Sidste {x} minutter").format(x=lower)
        return _("{x} minutter til {y} minutter").format(x=lower, y=upper)


class ReadingWordLengthResultsTable(NonOrderableTableMixin, Table):
    word_length = Column(verbose_name=_("Ordlængde (ant. bogstaver)"))
    questions_count = Column(verbose_name=_("Opgaver"))
    correct_count = Column(verbose_name=_("Rigtige"))


class ReadingWordCountResultsTable(NonOrderableTableMixin, Table):
    word_count = Column(verbose_name=_("Sætningslængde (ant. ord)"))
    questions_count = Column(verbose_name=_("Opgaver"))
    correct_count = Column(verbose_name=_("Rigtige"))


class QuestionResponsesTable(NonOrderableTableMixin, Table):
    class Meta:
        attrs = {"class": "table testresponse-table"}

    counter = Column(
        verbose_name=_("Opg."),
        accessor="row_number",
        attrs={
            "th": {"class": "column-counter"},
            "td": {"class": "column-counter"},
        },
    )
    challenge_image = TemplateColumn(
        verbose_name=_("Billede"),
        template_name="dysleksi/admin/part_response/group/column_challenge.html",
        extra_context={"only_type": "image"},
        attrs={
            "th": {"class": "column-challenge-image"},
            "td": {"class": "column-challenge-image"},
        },
    )
    challenge_text = TemplateColumn(
        verbose_name=_("Ord"),
        template_name="dysleksi/admin/part_response/group/column_challenge.html",
        extra_context={"only_type": "text"},
        attrs={
            "th": {"class": "column-challenge-text"},
            "td": {"class": "column-challenge-text"},
        },
    )
    challenge_sound = TemplateColumn(
        verbose_name=_("Lyd"),
        template_name="dysleksi/admin/part_response/group/column_challenge.html",
        extra_context={"only_type": "sound"},
        attrs={
            "th": {"class": "column-challenge-sound"},
            "td": {"class": "column-challenge-sound"},
        },
    )
    challenge_sentence = Column(
        verbose_name=_("Sætning"),
        accessor="question__challenge__text",
        attrs={
            "th": {"class": "column-challenge-sentence"},
            "td": {"class": "column-challenge-sentence"},
        },
    )
    correct_answer = TemplateColumn(
        verbose_name=_("Rigtigt svar"),
        template_name="dysleksi/admin/part_response/group/column_correct.html",
        attrs={
            "th": {"class": "column-correct-answer"},
            "td": {"class": "column-correct-answer"},
        },
    )
    student_answer = TemplateColumn(
        verbose_name=_("Elevens svar"),
        template_name="dysleksi/admin/part_response/group/column_answer.html",
        attrs={
            "th": {"class": "column-student-answer"},
            "td": {"class": "column-student-answer"},
        },
    )
    student_answer_time = Column(
        verbose_name=_("Tid"),
        accessor="finished_after",
        footer=lambda column, bound_column, table: table.render_student_answer_time(
            sum(bound_column.accessor.resolve(row) or 0 for row in table.data)
        ),
        attrs={
            "th": {"class": "column-student-answer-time"},
            "td": {"class": "column-student-answer-time"},
        },
    )

    def render_student_answer_time(self, value):
        # Convert ms to s
        return format_time(ceil(0.001 * value))


class AnswerTimeTable(NonOrderableTableMixin, HeaderlessTableMixin, Table):
    metric = Column()
    answer_time = Column()

    def render_answer_time(self, value: timedelta):
        return format_time(value.seconds)
