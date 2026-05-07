# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from functools import partial
from math import ceil
from typing import Any, List, Tuple

from django.conf import settings
from django.db import transaction
from django.db.models import Case, Count, F, Q, QuerySet, Value, When
from django.http import HttpResponseRedirect
from django.http.response import HttpResponse, HttpResponseForbidden, JsonResponse
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
    CorrectnessCategory,
    PartResponse,
    PartResponseQuerySet,
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
    ClassTable,
    EmptyColumn,
    PartResultTable,
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
        return context_data


class AssignmentView(UserTypeMixin, DetailView):

    model = TestAssignment
    context_object_name = "test_assignment"

    def get_template_names(self) -> list[str]:
        if self.user.is_teacher:
            if self.object.test.test_type == TestType.INDIVIDUAL:
                return ["dysleksi/admin/test_assignment/detail_individual.html"]
            else:
                return ["dysleksi/admin/test_assignment/detail_group.html"]

        return super().get_template_names()

    def get_template_prefix(self) -> str:
        if self.user.is_teacher or self.user.is_student:
            return "dysleksi/screening"
        raise ValueError("User is neither teacher nor student")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        assignment = self.object
        test = Test.objects.get(pk=assignment.test_id)
        context["test_contents"] = test.to_json()
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
        qs = super().get_queryset()
        # Only show classes belonging to the teacher viewing the page
        qs = qs.filter(institution=self.user.institution, teachers=self.user)
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
        qs = qs.filter(teacher=self.user)
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


class StartAssignmentView(CreateView):
    template_name = "dysleksi/lobby/start_room.html"
    model = TestAssignment
    http_method_names = ["post"]
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
            name=", ".join(
                str(test_part) for test_part in form.cleaned_data["test_parts"]
            ),
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


class StartIndividualAssignmentView(StartAssignmentView):
    form_class = StartIndividualRoomForm
    test_type = TestType.INDIVIDUAL


class StartGroupAssignmentView(StartAssignmentView):
    form_class = StartClassRoomForm
    test_type = TestType.GROUP


class AdminRootView(GroupRequiredMixin, TemplateView):
    groups_required = [TEACHERS]
    template_name = "dysleksi/admin/base.html"


class AssignmentResultsView(GroupRequiredMixin, DetailView):
    groups_required = [TEACHERS]
    model = TestAssignment
    table_class = TestResultTable

    def get_template_names(self) -> list[str]:
        if self.object.test.test_type == TestType.INDIVIDUAL:  # pragma: no cover
            # Endnu ikke klar, kommer senere
            return ["dysleksi/admin/test_responses/individual/list.html"]
        else:
            return ["dysleksi/admin/test_responses/group/list.html"]

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
            .annotate_correct_proportion(count_key, proportion_key, questions_count)
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

    def get_current_page(self) -> int:
        page_str = self.request.GET.get("page")
        return int(page_str) if page_str is not None else 1

    def get_page_size(self) -> int:
        return settings.RESULT_TABLE_SIZE  # type: ignore[misc]

    def get_table(self, page: int = 1):
        # Data til tabellen, hvor linjerne er elever og kolonnerne er deltests
        qs: TestResponseQuerySet = (
            self.object.responses.all()
            # Annotér med antallet af korrekte svar i hele testen
            .annotate_correct_count("total_score")
            # Annotér med rangering ud fra rækkefølge
            .annotate_ordering("total_score", "rank", False)
        )
        pagesize = self.get_page_size()
        parts: QuerySet[TestPart] = self.object.test.parts.all()[
            (page - 1) * pagesize : page * pagesize
        ]
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
                .annotate_correct_proportion(
                    count_key, proportion_key, part_questions_count
                )
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

    def get_pagination(self, page: int):
        parts_count = self.object.test.parts.count()
        page_size = self.get_page_size()
        return {
            "current_page": page,
            "current_first": min(((page - 1) * page_size) + 1, parts_count),
            "current_last": min(page * page_size, parts_count),
            "total_count": parts_count,
            "page_size": page_size,
            "last_page": ceil(parts_count / page_size),
        }

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
        page = self.get_current_page()
        if self.request.GET.get("only_table") != "true":
            context_data.update(
                {
                    "by_category": self.get_by_category(),
                    "pagination": self.get_pagination(page),
                }
            )
        context_data.update(
            {
                "request": self.request,
                "table": self.get_table(page),
                "CorrectnessCategories": {
                    category.pk: category
                    for category in CorrectnessCategory.objects.all()
                },
                "sort": self.request.GET.get("sort", "rank"),
            }
        )
        return context_data


class AssignmentResultsFlagView(LoginRequiredMixin, UpdateView):
    model = TestResponse
    fields = ("flagged",)

    def dispatch(self, request, *args, **kwargs):
        if not (
            self.user.is_superuser
            or (
                isinstance(self.user, User)
                and self.user.is_teacher
                and self.user.institution is not None
                and self.user.institution.students.filter(
                    responses__pk=self.kwargs.get(self.pk_url_kwarg)
                ).exists()
            )
        ):
            return HttpResponseForbidden()
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        return JsonResponse({"flagged": self.object.flagged})

    def form_valid(self, form):
        self.object = form.save()
        return JsonResponse({"flagged": self.object.flagged})


class AssignmentPartResultsView(GroupRequiredMixin, ListView):
    groups_required = [TEACHERS]
    model = PartResponse
    table_class = PartResultTable
    template_name = "dysleksi/admin/part_responses/group/list.html"

    def get(self, request, *args, **kwargs):
        self.assignment = get_object_or_404(
            TestAssignment, pk=self.kwargs["assignment_pk"]
        )
        self.part = get_object_or_404(TestPart, pk=self.kwargs["testpart_pk"])
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return (
            PartResponse.objects.filter(
                testresponse__assignment=self.assignment, testpart=self.part
            )
            .annotate_responses_count(
                "responses_count",
            )
            .annotate_correct_count(
                "correct_count",
            )
            .annotate_correct_proportion(
                "responses_count", "correct_count", "correct_proportion"
            )
            .annotate_correct_percentage("correct_proportion", "correct_percentage")
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


class TestResponseView(LoginRequiredMixin, DetailView):
    model = TestResponse
    template_name = "dysleksi/admin/test_response/group/detail.html"

    def get_object(self, queryset=...):
        return get_object_or_404(
            TestResponse,
            assignment=self.kwargs["assignment_pk"],
            pk=self.kwargs["response_pk"],
        )

    def get_table(self):

        data: PartResponseQuerySet = (
            self.object.partresponses.all()
            .annotate_questions_count("questions_count", Q(is_practice=False))
            .annotate_responses_count("responses_count")
            .annotate_correct_count("correct_count")
            .annotate_correct_proportion(
                "responses_count", "correct_count", "correct_proportion_of_answered"
            )
            .annotate_correct_percentage(
                "correct_proportion_of_answered", "correct_pct_of_answered"
            )
            .annotate_correct_proportion(
                "questions_count", "correct_count", "correct_proportion_of_all"
            )
            .annotate_correct_percentage(
                "correct_proportion_of_all", "correct_pct_of_all"
            )
        )

        part_header = _("%(part_name)s (%(questions_count)s opg.)")

        return StudentTestResponseTable(
            data=[
                {
                    "data_category": _("Antal forsøgte"),
                    **{
                        f"part_{item.testpart.pk}": item.responses_count
                        for item in data
                    },
                },
                {
                    "data_category": _("Antal rigtige"),
                    **{f"part_{item.testpart.pk}": item.correct_count for item in data},
                },
                {
                    "data_category": _("Rigtighedsprocent"),
                    **{
                        f"part_{item.testpart.pk}": f"{item.correct_pct_of_answered} %"
                        for item in data
                    },
                },
                {
                    "data_category": _("Normscore"),
                    **{
                        f"part_{item.testpart.pk}": f"{item.correct_pct_of_all} %"
                        for item in data
                    },
                },
            ],
            extra_columns=[
                (
                    f"part_{part.pk}",
                    StudentTestResultsColumn(
                        verbose_name=part_header
                        % {
                            "part_name": part.name,
                            "questions_count": part.questions.count(),
                        },
                        footer_template_name="dysleksi/admin/"
                        "test_response/group/footer.html",
                        footer_value=lambda column_values: {
                            "category": CorrectnessCategory.categorize_proportion(
                                # Matcher rækkefølgen af linjer i `data` ovenfor.
                                # For at regne kategorien ud deler vi antal rigtige
                                # (række 1) med antal besvarelser (række 0)
                                (column_values[1] / column_values[0])
                                if column_values[0] != 0
                                else None
                            ),
                        },
                    ),
                )
                for part in self.object.assignment.test.parts.all()
            ],
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(
            {
                "table": self.get_table(),
            }
        )
        return context
