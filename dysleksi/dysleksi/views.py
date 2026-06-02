# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from datetime import timedelta
from functools import cached_property, partial
from math import ceil
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.db import transaction
from django.db.models import (
    Aggregate,
    Case,
    CharField,
    Count,
    DurationField,
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    QuerySet,
    Value,
    When,
)
from django.db.models.expressions import BaseExpression, OuterRef, Subquery, Window
from django.db.models.functions import Coalesce, Length, Replace, RowNumber
from django.http import HttpResponseRedirect
from django.http.response import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView, DetailView, ListView, TemplateView
from django.views.generic.edit import UpdateView
from django_tables2 import SingleTableView
from login.view_mixins import GroupRequiredMixin, LoginRequiredMixin

from dysleksi.forms import StartClassRoomForm, StartIndividualRoomForm
from dysleksi.models import (
    TEACHERS,
    Class,
    Correctness,
    CorrectnessCategory,
    PartResponse,
    PartResponseQuerySet,
)
from dysleksi.models import PermissionsMixin as ModelPermissionsMixin
from dysleksi.models import (
    PossibleAnswer,
    QuestionResponse,
    QuestionType,
    ReadingSpeedCategory,
    Student,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResponse,
    TestResponseQuerySet,
    TestType,
    User,
)
from dysleksi.tables import (
    AnswerByTimeResultsTable,
    ClassTable,
    EmptyColumn,
    PartResultTable,
    QuestionResponsesTable,
    ReadingWordCountResultsTable,
    ReadingWordLengthResultsTable,
    StudentTable,
    StudentTestResponseTable,
    StudentTestResultsColumn,
    TestAssignmentTable,
    TestResultColumn,
    TestResultTable,
)
from dysleksi.utils import reverse_ordering, scan_static_files


class UserTypeMixin(LoginRequiredMixin):
    def get_template_prefix(self) -> str:
        # Override this in subclass
        return "dysleksi"  # pragma: no cover

    def get_template_names(self) -> list[str]:
        # Find template name matching prefix and user type
        prefix = self.get_template_prefix()
        if isinstance(self.user, User):
            if self.user.is_teacher:
                return [f"{prefix}/teacher.html"]
            if self.user.is_student:
                return [f"{prefix}/student.html"]
            if self.user.is_staff or self.user.is_superuser:
                return [f"{prefix}/staff.html"]
        return [f"{prefix}/other.html"]


class ObjectPermissionsMixin:

    actions_required = ["view"]

    def test_permissions(self, object):
        # Raises exceptions if user does not have access to the object
        if not isinstance(object, ModelPermissionsMixin):
            raise ImproperlyConfigured
        for action in self.actions_required:
            if not object.has_permission(self.user, action):
                raise PermissionDenied(
                    f"{self.user.username} does not have permissions"
                )

    def get_object(self, queryset=None):
        object = super().get_object(queryset)
        self.test_permissions(object)
        return object


class RootView(UserTypeMixin, TemplateView):
    def get(self, request, *args, **kwargs):
        if not self.user.is_anonymous and self.user.is_teacher:
            return redirect("dysleksi:test_assignment_list")
        return super().get(request, *args, **kwargs)

    def get_template_prefix(self) -> str:
        return "dysleksi/lobby"

    def get_context_data(self, **kwargs) -> dict[str, Any]:
        context_data = super().get_context_data(**kwargs)
        if not self.user.is_anonymous and self.user.is_student:
            context_data["student"] = self.user
            context_data["open_assignments"] = TestAssignment.objects.filter(
                Q(responses__isnull=True) | Q(responses__completed=False),
                Q(student=self.user) | Q(klasse__in=self.user.classes.all()),
            ).exists()
        return context_data


class AssignmentView(UserTypeMixin, ObjectPermissionsMixin, DetailView):

    model = TestAssignment
    context_object_name = "test_assignment"

    def get_template_names(self) -> list[str]:
        if self.user.is_superuser or self.user.is_teacher:
            if self.object.test.test_type == TestType.INDIVIDUAL:
                return ["dysleksi/admin/test_assignment/detail_individual.html"]
            else:
                return ["dysleksi/admin/test_assignment/detail_group.html"]

        return super().get_template_names()

    def get_template_prefix(self) -> str:
        if self.user.is_superuser or self.user.is_teacher or self.user.is_student:
            return "dysleksi/screening"
        raise ValueError("User is neither teacher nor student")  # pragma: no cover

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        assignment = self.object
        test = Test.objects.get(pk=assignment.test_id)
        context["test_contents"] = test.to_json(self.object)
        if assignment.klasse:
            context["student_ids"] = list(
                assignment.klasse.students.values_list("id", flat=True)
            )
        else:
            context["student_ids"] = [assignment.student.id]
        context["test_type"] = self.get_room_type()
        context["test_type_label"] = "Test"
        context["student"] = self.user
        context["room_type"] = self.get_room_type()
        context["test_name"] = test.name
        context["class_name"] = assignment.klasse_name or ", ".join(
            [c.name for c in assignment.student.classes.all()]
        )
        context["student_count"] = (
            assignment.klasse.students.all().count() if assignment.klasse else None
        )
        context["static_files"] = scan_static_files()

        return context

    def get_room_type(self) -> str:
        if self.object.klasse is not None:
            return "group"
        else:
            return "individual"


class ClassListView(GroupRequiredMixin, SingleTableView):
    model = Class
    table_class = ClassTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/class/list.html"

    def get_queryset(self):
        qs = super().get_queryset().filter_user_permissions(self.user, "view")
        # Only classes in the current school year
        # qs = qs.current()
        # Add annotations used by `ClassTable`
        qs = qs.annotate(
            number_of_students=Count("students", distinct=True),
        )
        return qs


class StudentListView(GroupRequiredMixin, SingleTableView):
    model = Student
    table_class = StudentTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/student/list.html"

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show students belonging to the teacher viewing the page
        qs = qs.filter(institution=self.user.institution, classes__teachers=self.user)
        return qs


class TestAssignmentListView(GroupRequiredMixin, SingleTableView):
    model = TestAssignment
    table_class = TestAssignmentTable
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/test_assignment/list.html"

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show test assignments belonging to the teacher viewing the page
        qs = qs.filter_user_permissions(self.user, "view")
        # Add annotations used by `TestAssignmentTable`
        qs = qs.annotate(
            number_of_students=Case(
                When(
                    student_id__isnull=True,
                    then=Count("klasse__students", distinct=True),
                ),
                When(
                    student__id__isnull=False,
                    then=Value(1),
                ),
            ),
            number_of_students_responded=Count("responses__student__pk", distinct=True),
        )
        qs = qs.annotate(
            status=Case(
                When(
                    number_of_students_responded=F("number_of_students"),
                    then=Value("Gennemført"),
                ),
                When(
                    number_of_students_responded__gt=0,
                    number_of_students_responded__lt=F("number_of_students"),
                    then=Value("I gang"),
                ),
                default=Value("Afventer"),
            )
        )
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["assign_group_form"] = StartClassRoomForm(teacher=self.user)
        context["assign_individual_form"] = StartIndividualRoomForm(teacher=self.user)
        return context


class StartAssignmentView(GroupRequiredMixin, CreateView):
    template_name = "dysleksi/lobby/start_room.html"
    model = TestAssignment
    http_method_names = ["post"]
    groups_required = [TEACHERS]
    test_type: TestType | None = None  # overridden in subclasses

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["teacher"] = self.request.user.subclass_instance()
        return kwargs

    def get_success_url(self):
        if self.object.planned_date_time is not None:
            return reverse("dysleksi:test_assignment_list")
        else:
            return reverse("dysleksi:room", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        if form.cleaned_data["test_parts"]:
            self.object = self.create_test_from_test_parts(form)
            return HttpResponseRedirect(self.get_success_url())
        else:
            return super().form_valid(form)

    @transaction.atomic
    def create_test_from_test_parts(self, form) -> TestAssignment:
        # Create test
        test = Test.objects.create(
            name=self._get_test_name(form),
            test_type=self.test_type,  # type: ignore
            custom=True,
        )
        # Add the selected test parts
        for test_part in form.cleaned_data["test_parts"]:
            test.parts.add(test_part)
        # Create test assignment for this test/test parts
        test_assignment = form.save(commit=False)
        test_assignment.test = test
        test_assignment.save()
        return test_assignment

    def _get_test_name(self, form) -> str:
        test_parts = form.cleaned_data["test_parts"]
        if len(test_parts) > 1:
            return _("{num} deltests").format(num=len(test_parts))
        elif len(test_parts) == 1:
            return _("{test_part_name}").format(test_part_name=test_parts[0].name)
        else:
            raise ValueError(  # pragma: no cover
                "cannot create test name for %d test parts", len(test_parts)
            )


class StartIndividualAssignmentView(StartAssignmentView):
    form_class = StartIndividualRoomForm
    test_type = TestType.INDIVIDUAL


class StartGroupAssignmentView(StartAssignmentView):
    form_class = StartClassRoomForm
    test_type = TestType.GROUP


class AdminRootView(GroupRequiredMixin, TemplateView):
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/base.html"


class PaginationMixin:

    def get_page_size(self) -> int:
        raise NotImplementedError  # pragma: no cover

    def get_items(self) -> QuerySet:
        raise NotImplementedError  # pragma: no cover

    def get_pagination_buttons_count(self):
        return 0

    def get_pagination(self):
        count = self.get_items().count()
        page = self.get_current_page()
        page_size = self.get_page_size()
        return {
            "current_page": page,
            "current_first": min(((page - 1) * page_size) + 1, count),
            "current_last": min(page * page_size, count),
            "total_count": count,
            "page_size": page_size,
            "last_page": ceil(count / page_size),
            "button_range": self.get_pagination_buttons_range(),
        }

    def get_current_page(self) -> int:
        page_str = self.request.GET.get("page")  # type: ignore[attr-defined]
        return int(page_str) if page_str is not None else 1

    def get_current_items(self) -> QuerySet[TestPart]:
        page = self.get_current_page()
        pagesize = self.get_page_size()
        start = (page - 1) * pagesize
        end = page * pagesize
        return self.get_items()[start:end]

    def get_pagination_buttons_range(self):
        return self.pagination_buttons_range(
            self.get_current_page(),
            ceil(self.get_items().count() / self.get_page_size()),
            self.get_pagination_buttons_count(),
        )

    @staticmethod
    def pagination_buttons_range(current_page, pages_count_total, buttons_count):
        if buttons_count > 0:
            first = max(current_page - int(ceil(buttons_count - 1) / 2), 1)
            last = first + buttons_count - 1
            if last > pages_count_total:
                first -= last - pages_count_total
                last = pages_count_total
            if first < 1:
                first = 1
            return list(range(first, last + 1))
        return []

    def get_context_data(self, **kwargs):
        context_data = super().get_context_data(**kwargs)
        context_data["pagination"] = self.get_pagination()
        return context_data


class AssignmentResultsView(
    GroupRequiredMixin, PaginationMixin, ObjectPermissionsMixin, DetailView
):
    groups_required = [TEACHERS]
    model = TestAssignment
    table_class = TestResultTable
    template_name = "dysleksi/admin/test_responses/group/list.html"

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        if self.object.test.test_type == TestType.INDIVIDUAL:
            return redirect(
                "dysleksi:test_assignment_student_results",
                assignment_pk=self.kwargs["pk"],
                response_pk=self.object.responses.values_list("pk", flat=True)[0],
            )

        context = self.get_context_data(object=self.object)
        return self.render_to_response(context)

    def get_by_category(self):
        key = "all_correct"
        count_key = f"{key}_count"
        proportion_key = f"{key}_proportion"
        category_key = f"{key}_category"

        questions_count: int = TestQuestion.objects.filter(
            part__tests=self.object.test
        ).count()

        # Data til kasserne i toppen, hvor hver kategori har nogle elever
        # Hver entry i qs er en elevs besvarelse af hele testen
        qs: TestResponseQuerySet = (
            self.object.responses.all()
            # Annotér med antallet af korrekte svar i hele testen
            .annotate_correct_count(count_key)
            # Annotér med andelen af korrekte svar i hele testen (float mellem 0 og 1)
            .annotate_proportion(count_key, proportion_key, questions_count)
            # Annotér kategorien af korrekte svar i hele testen (pk på ResultCategory)
            .annotate_score_category(proportion_key, category_key)
        )
        return [
            {
                "color": category.color_key,
                "label": category.label_da,
                "items": qs.filter(**{category_key: category.pk}).order_by(count_key),
            }
            for category in CorrectnessCategory.objects.all().order_by(
                "is_default", "upper_proportion_limit"
            )
        ]

    def get_table(self):
        # Data til tabellen, hvor linjerne er elever og kolonnerne er deltests
        qs: TestResponseQuerySet = (
            self.object.responses.all()
            # Annotér med antallet af korrekte svar i hele testen
            .annotate_correct_count("total_score")
            # Annotér med rangering ud fra rækkefølge
            .annotate_ordering("total_score", "rank", False)
        )
        parts = self.get_current_items()
        extra_columns = []
        for part in parts:
            key = f"part_{part.pk}_correct"
            count_key = f"{key}_count"
            proportion_key = f"{key}_proportion"
            category_key = f"{key}_category"
            part_questions_count = part.questions.count()
            qs = (
                # Annotér med antallet af korrekte svar i denne Part
                qs.annotate_correct_count(count_key, Q(partresponses__testpart=part))
                # Annotér med andelen af korrekte svar i denne Part
                # (float mellem 0 og 1)
                .annotate_proportion(count_key, proportion_key, part_questions_count)
                # Annotér kategorien af korrekte svar i denne Part
                # (red, yellow, green, blue)
                .annotate_score_category(proportion_key, category_key)
            )
            # Tilføj en søjle til data for denne Part
            extra_columns.append(
                (
                    key,
                    TestResultColumn(
                        template_name="dysleksi/admin/test_responses/group/score.html",
                        footer_template_name="dysleksi/admin/"
                        "test_responses/group/footer.html",
                        verbose_name=part.name,
                        accessor=count_key,
                        extra_context={  # til brug i template for celle
                            "count_key": count_key,
                            "proportion_key": proportion_key,
                            "category_key": category_key,
                            "CorrectnessCategories": {
                                category.pk: category
                                for category in CorrectnessCategory.objects.all()
                            },
                            "object": self.object,
                            "part": part,
                        },
                        average_value_modifier=partial(
                            lambda average_count, part_questions_count: {
                                # Til brug i template for footer,
                                # som viser opsummeringen
                                # average_count er det gennemsnitlige antal korrekte
                                # besvarelser af denne deltest for hele klassen
                                # "count": average_count,
                                # "total": part_questions_count,
                                # "proportion": average_count / part_questions_count,
                                "category": CorrectnessCategory.categorize_proportion(
                                    average_count / part_questions_count
                                ),
                            },
                            part_questions_count=part_questions_count,
                        ),
                        subgroups=CorrectnessCategory.partition_question_count(
                            part_questions_count
                        ),
                        assignment=self.object,
                        part=part,
                    ),
                )
            )
        e = 0
        while len(extra_columns) % self.get_page_size() != 0:
            extra_columns.append((f"empty_{e}", EmptyColumn()))
            e += 1
        qs = qs.order_by(*self.get_ordering())
        return self.table_class(data=qs, extra_columns=extra_columns)

    def get_page_size(self) -> int:
        return settings.RESULT_TABLE_SIZE  # type: ignore[misc]

    def get_items(self) -> QuerySet[TestPart]:
        return self.object.test.parts.all()

    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get("only_table") == "true":
            return HttpResponse(context["table"].as_html(self.request))
        else:
            return super().render_to_response(context, **response_kwargs)

    def get_ordering(self):
        sort = self.request.GET.get("sort")
        desc = False
        if sort is not None:
            if sort.startswith("-"):
                desc = True
                sort = sort[1:]
            if sort == "student":
                ordering = "rank"
            else:
                ordering = f"{sort}_count"
        else:
            ordering = "rank"
        if desc:
            return ["-" + ordering]
        else:
            return [ordering]

    def get_context_data(self, **kwargs):
        context_data = super().get_context_data(**kwargs)
        if self.request.GET.get("only_table") != "true":
            context_data.update(
                {
                    "by_category": self.get_by_category(),
                }
            )
        context_data.update(
            {
                "request": self.request,
                "table": self.get_table(),
                "CorrectnessCategories": {
                    category.pk: category
                    for category in CorrectnessCategory.objects.all()
                },
                "sort": self.request.GET.get("sort", "rank"),
            }
        )
        return context_data


class AssignmentResultsFlagView(GroupRequiredMixin, ObjectPermissionsMixin, UpdateView):
    model = TestResponse
    fields = ("flagged",)
    groups_required = [TEACHERS]
    actions_required = ["view", "change"]

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        return JsonResponse({"flagged": self.object.flagged})

    def form_valid(self, form):
        self.object = form.save()
        return JsonResponse({"flagged": self.object.flagged})


class AssignmentPartResultsView(GroupRequiredMixin, ObjectPermissionsMixin, ListView):
    groups_required = [TEACHERS]
    model = PartResponse
    table_class = PartResultTable
    template_name = "dysleksi/admin/part_responses/group/list.html"

    def get(self, request, *args, **kwargs):
        self.assignment = get_object_or_404(
            TestAssignment, pk=self.kwargs["assignment_pk"]
        )
        self.test_permissions(self.assignment)
        self.part = get_object_or_404(TestPart, pk=self.kwargs["testpart_pk"])
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return (
            PartResponse.objects.filter(
                testresponse__assignment=self.assignment,
                testpart=self.part,
            )
            .annotate_questionresponses_count(
                "responses_count",
                Q(question__is_practice=False),
            )
            .annotate_questionresponses_count(
                "correct_count",
                Q(correctness=Correctness.CORRECT, question__is_practice=False),
            )
            .annotate_proportion(
                "responses_count", "correct_count", "correct_proportion"
            )
            .annotate_percentage("correct_proportion", "correct_percentage")
            .annotate_ordering("correct_count", "rank", False)
        ).order_by(*self.get_ordering())

    def get_ordering(self) -> List[str]:
        sort = self.request.GET.get("sort", "student")
        desc = False
        if sort.startswith("-"):
            desc = True
            sort = sort[1:]
        if sort == "student":
            ordering = [
                "testresponse__student__first_name",
                "testresponse__student__last_name",
            ]
        else:
            ordering = [sort]
        return reverse_ordering(ordering) if desc else ordering

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "assignment": self.assignment,
                "part": self.part,
                "table": self.get_table(),
                "CorrectnessCategories": CorrectnessCategory.pk_map(),
                "sort": self.request.GET.get("sort", "student"),
                "ReadingSpeeedCategories": ReadingSpeedCategory.pk_map(reverse=True),
            }
        )
        if self.part.show_normscore_speed_plot:  # pragma: no cover
            context["plot"] = self.get_plot_data()
        return context

    def get_table(self) -> PartResultTable:
        return PartResultTable(data=self.object_list)

    def get_plot_data(self) -> List[Tuple[float, float]]:  # pragma: no cover
        # Til demonstration af hvor godt renderingen rammer
        return [
            (0.0, 0.0),
            (0.0, 0.1),
            (0.0, 0.35),
            (0.0, 0.75),
            (0.0, 1.0),
            (0.1, 0.0),
            (0.1, 0.1),
            (0.1, 0.35),
            (0.1, 0.75),
            (0.1, 1.0),
            (0.35, 0.0),
            (0.35, 0.1),
            (0.35, 0.35),
            (0.35, 0.75),
            (0.35, 1.0),
            (0.75, 0.0),
            (0.75, 0.1),
            (0.75, 0.35),
            (0.75, 0.75),
            (0.75, 1.0),
            (1.0, 0.0),
            (1.0, 0.1),
            (1.0, 0.35),
            (1.0, 0.75),
            (1.0, 1.0),
        ]


class TestResponseView(
    GroupRequiredMixin, PaginationMixin, ObjectPermissionsMixin, DetailView
):
    model = TestResponse
    template_name = "dysleksi/admin/test_response/detail.html"
    chart_template_name = "dysleksi/admin/test_response/chart.html"
    groups_required = [TEACHERS]

    @cached_property
    def test_type(self) -> TestType:
        return self.object.assignment.test.test_type

    def get_object(self, queryset=...):
        object = get_object_or_404(
            TestResponse,
            assignment=self.kwargs["assignment_pk"],
            pk=self.kwargs["response_pk"],
        )
        self.test_permissions(object)
        return object

    def get_page_size(self) -> int:
        return settings.RESULT_TABLE_SIZE  # type: ignore[misc]

    def get_items(self) -> QuerySet[TestPart]:
        return self.object.assignment.test.parts.all().order_by("pk")

    @cached_property
    def data(self) -> PartResponseQuerySet:
        qs = (
            self.object.partresponses.filter(testpart__in=self.get_current_items())
            .annotate_questions_count("questions_count", Q(is_practice=False))
            .annotate_questionresponses_count(
                "responses_count", Q(question__is_practice=False)
            )
            .annotate_questionresponses_count(
                "correct_count",
                Q(question__is_practice=False, correctness=Correctness.CORRECT),
            )
            .annotate_proportion(
                "responses_count", "correct_count", "correct_proportion_of_answered"
            )
            .annotate_percentage(
                "correct_proportion_of_answered", "correct_pct_of_answered"
            )
            .annotate_proportion(
                "questions_count", "correct_count", "correct_proportion_of_all"
            )
            .annotate_percentage("correct_proportion_of_all", "correct_pct_of_all")
        )
        if self.test_type == TestType.INDIVIDUAL:
            qs = qs.annotate_questionresponses_count(
                "skipped_count",
                Q(question__is_practice=False, correctness=Correctness.PARTIAL),
            )

        return qs.order_by("pk")

    def get_table(self) -> StudentTestResponseTable:

        qs: PartResponseQuerySet = self.data

        part_header = _("%(part_name)s (%(questions_count)s opg.)")

        extra_columns = [
            (
                f"part_{partresponse.testpart_id}",
                StudentTestResultsColumn(
                    verbose_name=part_header
                    % {
                        "part_name": partresponse.testpart.name,
                        "questions_count": partresponse.testpart.questions.filter(
                            is_practice=False
                        ).count(),
                    },
                    footer_template_name="dysleksi/admin/" "test_response/footer.html",
                    footer_value=partial(
                        lambda part, column_values: {
                            "response": self.object,
                            "part": part,
                            "category": CorrectnessCategory.categorize_proportion(
                                # Matcher rækkefølgen af linjer i `data` ovenfor.
                                # For at regne kategorien ud deler vi antal rigtige
                                # (række 1) med antal besvarelser (række 0)
                                (column_values[1] / column_values[0])
                                if column_values[0] != 0
                                else None
                            ),
                        },
                        partresponse.testpart,
                    ),
                ),
            )
            for partresponse in qs
        ]

        e = 0
        while len(extra_columns) % self.get_page_size() != 0:
            extra_columns.append((f"empty_{e}", EmptyColumn()))
            e += 1

        data = [
            {
                "data_category": _("Antal forsøgte"),
                **{f"part_{item.testpart.pk}": item.responses_count for item in qs},
            }
        ]
        if self.test_type == TestType.INDIVIDUAL:
            data += [
                {
                    "data_category": _("Antal oversprungne"),
                    **{f"part_{item.testpart.pk}": item.skipped_count for item in qs},
                }
            ]
        data += [
            {
                "data_category": _("Antal rigtige"),
                **{f"part_{item.testpart.pk}": item.correct_count for item in qs},
            },
            {
                "data_category": _("Rigtighedsprocent"),
                **{
                    f"part_{item.testpart.pk}": f"{item.correct_pct_of_answered} %"
                    for item in qs
                },
            },
            {
                "data_category": _("Normscore"),
                **{
                    f"part_{item.testpart.pk}": f"{item.correct_pct_of_all} %"
                    for item in qs
                },
            },
        ]

        return StudentTestResponseTable(data=data, extra_columns=extra_columns)

    def get_plot_data(self) -> List[int]:
        qs: PartResponseQuerySet = self.data
        return [item.correct_pct_of_all for item in qs]

    def get_part_names(self) -> Dict[int, str]:
        return {part.pk: part.name for part in self.get_current_items()}

    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get("only_table") == "true":
            return HttpResponse(context["table"].as_html(self.request))
        else:
            return super().render_to_response(context, **response_kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "request": self.request,
                "table": self.get_table(),
                "CorrectnessCategories": CorrectnessCategory.pk_map(),
                "pagination": self.get_pagination(),
                "plot": self.get_plot_data(),
                "part_names": self.get_part_names(),
            }
        )
        return context


class PartResponseView(
    GroupRequiredMixin, ObjectPermissionsMixin, PaginationMixin, DetailView
):
    model = PartResponse
    template_name = "dysleksi/admin/part_response/group/detail.html"
    groups_required = [TEACHERS]

    def get_object(self, queryset=...):
        qs = (
            PartResponse.objects.filter(
                testresponse__assignment=self.kwargs["assignment_pk"],
                testpart=self.kwargs["testpart_pk"],
                testresponse=self.kwargs["testresponse_pk"],
            )
            .annotate_questionresponses_count(
                "responses_count", Q(question__is_practice=False)
            )
            .annotate_questions_count("questions_count", Q(is_practice=False))
            .annotate_questionresponses_count(
                "almost_correct_count",
                Q(question__is_practice=False, correctness=Correctness.PARTIAL),
            )
            .annotate_questionresponses_count(
                "correct_count",
                Q(question__is_practice=False, correctness=Correctness.CORRECT),
            )
            .annotate_proportion(
                "questions_count", "responses_count", "responses_proportion"
            )
            .annotate_percentage("responses_proportion", "responses_pct")
            .annotate_proportion(
                "responses_count", "correct_count", "correct_proportion"
            )
            .annotate_proportion(
                "responses_count", "almost_correct_count", "almost_correct_proportion"
            )
            .annotate_percentage("correct_proportion", "correct_pct")
            .annotate_percentage("almost_correct_proportion", "almost_correct_pct")
        )
        object = qs.first()
        if object is None:
            raise Http404(
                "No %s matches the given query." % PartResponse._meta.object_name
            )
        self.test_permissions(object)
        return object

    @cached_property
    def part(self):
        return self.object.testpart

    def get_question_qs(self) -> QuerySet[TestQuestion]:
        return self.part.questions.filter(is_practice=False)

    def get_question_qs_annotations(self) -> Dict[str, BaseExpression]:
        annotations: Dict[str, BaseExpression] = {}
        if len(self.part.answer_wordlength_data_ranges) or len(
            self.part.answer_wordcount_data_ranges
        ):  # pragma: no branch
            annotations["challenge_text"] = Coalesce(
                F("challenge__text"),
                Subquery(
                    PossibleAnswer.objects.filter(
                        question=OuterRef("pk"),
                        correctness=Correctness.CORRECT,
                    ).values("resource__text"),
                    output_field=CharField(),
                ),
            )
            annotations["challenge_text_length"] = Length("challenge_text")
        if len(self.part.answer_wordcount_data_ranges):  # pragma: no branch
            annotations["challenge_word_count"] = ExpressionWrapper(
                # Count the number of words by
                # number_of_letters - number_of_letters_without_spaces + 1
                F("challenge_text_length")
                - Length(Replace("challenge_text", Value(" "), Value("")))
                + Value(1),
                output_field=IntegerField(),
            )
        return annotations

    def get_question_qs_aggregations(self) -> Dict[str, Aggregate]:
        aggregations: Dict[str, Aggregate] = {}
        for lower, upper in self.part.answer_wordlength_data_ranges:
            q = Q()
            if lower is not None:
                q &= Q(challenge_text_length__gte=lower)
            if upper is not None:
                q &= Q(challenge_text_length__lte=upper)
            aggregations[f"challenge_text_length__{lower}_{upper}__questions"] = Count(
                "id", filter=q
            )
        for lower, upper in self.part.answer_wordcount_data_ranges:
            q = Q()
            if lower is not None:
                q &= Q(challenge_word_count__gte=lower)
            if upper is not None:
                q &= Q(challenge_word_count__lte=upper)
            aggregations[f"challenge_word_count__{lower}_{upper}__questions"] = Count(
                "id", filter=q
            )
        return aggregations

    def get_questions_aggregated_data(self) -> Dict[str, Any]:
        question_qs = self.get_question_qs()
        aggregations = self.get_question_qs_aggregations()
        if aggregations:
            annotations = self.get_question_qs_annotations()
            if annotations:  # pragma: no branch
                question_qs = question_qs.annotate(**annotations)
            return question_qs.aggregate(**aggregations)
        return {}

    def get_questionresponse_qs(self) -> QuerySet[QuestionResponse]:
        return self.object.questionresponses.filter(question__is_practice=False)

    def get_questionresponse_qs_annotations(self) -> Dict[str, BaseExpression]:
        annotations: Dict[str, BaseExpression] = {}
        if self.part.answer_time_data_breakdown_ranges:
            annotations["submitted_after"] = ExpressionWrapper(
                F("submitted_at") - F("partresponse__started_at"),
                output_field=DurationField(),
            )
        if (
            self.part.answer_wordlength_data_ranges
            or self.part.answer_wordcount_data_ranges
        ):
            annotations["challenge_text"] = Coalesce(
                F("question__challenge__text"),
                Subquery(
                    PossibleAnswer.objects.filter(
                        question=OuterRef("question__pk"),
                        correctness=Correctness.CORRECT,
                    ).values("resource__text"),
                    output_field=CharField(),
                ),
            )
            annotations["challenge_text_length"] = Length("challenge_text")
        if self.part.answer_wordcount_data_ranges:
            annotations["challenge_word_count"] = ExpressionWrapper(
                # Count the number of words by
                # number_of_letters - number_of_letters_without_spaces + 1
                F("challenge_text_length")
                - Length(Replace("challenge_text", Value(" "), Value("")))
                + Value(1),
                output_field=IntegerField(),
            )
        return annotations

    def get_questionresponse_qs_aggregations(self) -> Dict[str, Aggregate]:
        aggregations: Dict[str, Aggregate] = {}
        for lower, upper in self.part.answer_time_data_breakdown_ranges:
            q = Q(correctness=Correctness.CORRECT)
            if lower is not None:
                q &= Q(submitted_after__gt=timedelta(minutes=lower))
            if upper is not None:
                q &= Q(submitted_after__lt=timedelta(minutes=upper))
            aggregations[f"time_slot__{lower}_{upper}__correct"] = Count("id", filter=q)
        for lower, upper in self.part.answer_wordlength_data_ranges:
            q = Q(correctness=Correctness.CORRECT)
            if lower is not None:
                q &= Q(challenge_text_length__gte=lower)
            if upper is not None:
                q &= Q(challenge_text_length__lte=upper)
            aggregations[f"challenge_text_length__{lower}_{upper}__correct"] = Count(
                "id", filter=q
            )
        for lower, upper in self.part.answer_wordcount_data_ranges:
            q = Q(correctness=Correctness.CORRECT)
            if lower is not None:
                q &= Q(challenge_word_count__gte=lower)
            if upper is not None:
                q &= Q(challenge_word_count__lte=upper)
            aggregations[f"challenge_word_count__{lower}_{upper}__correct"] = Count(
                "id", filter=q
            )
        return aggregations

    def get_questionresponses_aggregated_data(self) -> Dict[str, Any]:
        questionresponse_qs = self.get_questionresponse_qs()
        aggregations = self.get_questionresponse_qs_aggregations()
        if aggregations:
            annotations = self.get_questionresponse_qs_annotations()
            if annotations:  # pragma: no branch
                questionresponse_qs = questionresponse_qs.annotate(**annotations)
            return questionresponse_qs.aggregate(**aggregations)
        return {}

    def get_page_size(self) -> int:
        return settings.QUESTIONRESPONSES_TABLE_SIZE  # type: ignore[misc]

    def get_pagination_buttons_count(self):
        return 5

    def get_items(self):
        return (
            self.get_questionresponse_qs()
            .select_related("question", "question__challenge")
            .annotate(row_number=Window(expression=RowNumber(), order_by=F("pk").asc()))
            .order_by("pk")
        )

    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get("only_table") == "true":
            return HttpResponse(context["responses_table"].as_html(self.request))
        else:
            return super().render_to_response(context, **response_kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        questions_counts = self.get_questions_aggregated_data()
        questionresponses_counts = self.get_questionresponses_aggregated_data()

        context["questionresponses"] = questionresponses_counts

        context["has_almost_correct"] = (
            self.object.testpart.has_partially_correct_answers
        )

        if self.part.answer_time_data_breakdown_ranges:
            context["timeslot_table"] = AnswerByTimeResultsTable(
                data=[
                    {
                        "time_slot": (lower, upper),
                        "correct_count": questionresponses_counts[
                            f"time_slot__{lower}_{upper}__correct"
                        ],
                    }
                    for lower, upper in self.part.answer_time_data_breakdown_ranges
                ]
            )

        if self.part.answer_wordlength_data_ranges:
            context["wordlength_table"] = ReadingWordLengthResultsTable(
                data=[
                    {
                        "word_length": f"{lower}-{upper}",
                        "questions_count": questions_counts[
                            f"challenge_text_length__{lower}_{upper}__questions"
                        ],
                        "correct_count": questionresponses_counts[
                            f"challenge_text_length__{lower}_{upper}__correct"
                        ],
                    }
                    for lower, upper in self.part.answer_wordlength_data_ranges
                ]
            )

        if self.part.answer_wordcount_data_ranges:
            context["wordcount_table"] = ReadingWordCountResultsTable(
                data=[
                    {
                        "word_count": f"{lower}-{upper}",
                        "questions_count": questions_counts[
                            f"challenge_word_count__{lower}_{upper}__questions"
                        ],
                        "correct_count": questionresponses_counts[
                            f"challenge_word_count__{lower}_{upper}__correct"
                        ],
                    }
                    for lower, upper in self.part.answer_wordcount_data_ranges
                ]
            )

        # Find ud af hvilken kolonne vi skal vise for "challenge"
        # (billede, tekst eller lyd)
        count_type_qs = (
            self.get_questionresponse_qs()
            .filter(question__is_practice=False)
            .aggregate(
                image=Count(
                    "id",
                    filter=Q(question__challenge__image__isnull=False)
                    & ~Q(question__challenge__image=""),
                ),
                text=Count("id", filter=Q(question__challenge__text__isnull=False)),
                sound=Count(
                    "id",
                    filter=Q(question__challenge__sound__isnull=False)
                    & ~Q(question__challenge__sound=""),
                ),
                teacher_judged=Count(
                    "id",
                    filter=Q(
                        question__possible_answers__resource__text__in=("true", "false")
                    ),
                ),
            )
        )
        if count_type_qs["teacher_judged"] > 0:
            show_type = "image"
        else:
            show_type = max(count_type_qs, key=lambda t: count_type_qs[t])

        exclude_columns = [
            f"challenge_{x}" for x in ("image", "text", "sound") if x != show_type
        ]
        if count_type_qs["teacher_judged"] == 0:
            exclude_columns.append("challenge_sentence")

        context["responses_table"] = QuestionResponsesTable(
            data=self.get_current_items(),
            exclude=exclude_columns,
        )

        context["QuestionType"] = QuestionType

        return context
