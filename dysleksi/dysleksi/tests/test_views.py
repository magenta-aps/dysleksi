# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
from datetime import timedelta
from operator import attrgetter
from unittest.mock import patch

from bs4 import BeautifulSoup
from django.contrib.auth.models import AnonymousUser
from django.core.cache import caches
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.http.response import Http404, JsonResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View

from dysleksi.models import (
    Class,
    CorrectnessCategory,
    Institution,
    Student,
    Test,
    TestAssignment,
    TestAssignmentStatus,
    TestPart,
    TestType,
    User,
)
from dysleksi.tables import PartResultTable, StudentTestResponseTable, TestResultTable
from dysleksi.tests.base import DysleksiTest, ResponseTest
from dysleksi.views import (
    AssignmentPartResultsView,
    AssignmentResultListView,
    AssignmentResultsFlagView,
    AssignmentResultsView,
    AssignmentView,
    ClassDetailView,
    ClassListView,
    ClientErrorLogView,
    PaginationMixin,
    PartResponseView,
    RootView,
    StudentDetailView,
    StudentListView,
    TestAssignmentListView,
    TestResponseView,
    UserTypeMixin,
)


class TestUserTypeMixin(DysleksiTest):
    def test_template_name(self):
        class UserTypeView(UserTypeMixin, View):
            pass

        view = self.setup_view(UserTypeView, self.student1, False)
        self.assertEqual(view.get_template_names(), ["dysleksi/student.html"])


class TestRootView(DysleksiTest):
    def test_get_template_names(self):
        cases: list[tuple[User, str | None]] = [
            (self.teacher, "dysleksi/lobby/teacher.html"),
            (self.student1, "dysleksi/lobby/student.html"),
            (self.admin, "dysleksi/lobby/staff.html"),
            (self.other_user, "dysleksi/lobby/other.html"),
        ]
        for user, template_name in cases:
            with self.subTest(user=user, template_name=template_name):
                view = self.setup_view(RootView, user)
                self.assertListEqual(view.get_template_names(), [template_name])

    def test_get_context_data(self):
        cases: list[tuple[User, list[str]]] = [
            (self.teacher, []),
            (self.student1, ["student"]),
            (AnonymousUser(), []),
        ]
        for user, context_keys in cases:
            with self.subTest(user=user, context_keys=context_keys):
                view = self.setup_view(RootView, user)
                context_data = view.get_context_data()
                if context_keys:
                    for context_key in context_keys:
                        self.assertIn(context_key, context_data)
                else:
                    self.assertIsInstance(context_data, dict)


class TestAssignmentView(DysleksiTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.test = Test.objects.create(name="Middle 2. grade", test_type=TestType.GROUP)
        cls.test2 = Test.objects.create(
            name="Individual dummy test",
            test_type=TestType.INDIVIDUAL,
        )
        cls.assignment1 = TestAssignment.objects.create(
            test=cls.test, teacher=cls.teacher, klasse=cls.klasse
        )
        cls.assignment2 = TestAssignment.objects.create(
            test=cls.test2, teacher=cls.teacher, student=cls.student1
        )

    def test_get_template_names(self):
        cases: list[tuple[User, str, str, TestAssignment]] = [
            (
                self.teacher,
                "dysleksi/admin/test_assignment/detail_individual.html",
                "student_123",
                self.assignment2,
            ),
            (
                self.student1,
                "dysleksi/screening/student.html",
                "student_123",
                self.assignment2,
            ),
            (
                self.teacher,
                "dysleksi/admin/test_assignment/detail_group.html",
                "class_123",
                self.assignment1,
            ),
            (
                self.student1,
                "dysleksi/screening/student.html",
                "class_123",
                self.assignment1,
            ),
        ]
        for user, template_name, room_name, assignment in cases:
            with self.subTest(user=user, template_name=template_name):
                view = self.setup_view(
                    AssignmentView,
                    user,
                    room_name=room_name,
                    test_id=self.individual_test.id,
                    pk=assignment.id,
                )
                self.assertListEqual(view.get_template_names(), [template_name])

        with self.assertRaises(PermissionDenied):
            self.setup_view(
                AssignmentView,
                self.other_user,
                room_name="class_123",
                test_id=self.individual_test.id,
                pk=self.assignment1.id,
            )

    def test_context_data(self):
        view = self.setup_view(
            AssignmentView,
            self.teacher,
            room_name="class_1",
            test_id=self.individual_test.id,
            pk=self.assignment1.id,
        )
        context = view.get_context_data()
        self.assertIn("test_contents", context)

    def test_access(self):
        for assignment in (self.assignment1, self.assignment2):
            for user in (self.admin, self.teacher, self.student1, self.privileged_user):
                self.setup_view(
                    AssignmentView,
                    user,
                    room_name="class_1",
                    test_id=self.individual_test.id,
                    pk=assignment.id,
                )
            for user in (
                self.other_user,
                self.other_teacher,
                self.inactive_user,
                self.not_logged_in_user,
            ):
                with self.assertRaises(PermissionDenied):
                    self.setup_view(
                        AssignmentView,
                        user,
                        room_name="class_1",
                        test_id=self.individual_test.id,
                        pk=self.assignment1.id,
                    )
        view = self.setup_view(
            AssignmentView,
            self.admin,
            room_name="class_1",
            test_id=self.individual_test.id,
            pk=assignment.id,
        )
        with self.assertRaises(ImproperlyConfigured):
            view.test_permissions({})


class TestClassListView(DysleksiTest):

    url = reverse("dysleksi:class_list")

    def test_get_template_names(self):
        view = self.setup_view(ClassListView, self.teacher)
        self.assertEqual(view.get_template_names()[0], "dysleksi/admin/class/list.html")

    def test_teacher_view(self):
        view = self.setup_view(ClassListView, self.teacher)
        self.assertQuerySetEqual(
            view.get_context_data()["object_list"], self.teacher.classes.all()
        )
        self.client.force_login(self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], self.teacher.classes.all()
        )

    def test_student_view(self):
        self.client.force_login(self.student1)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_schoolyear_ordering(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.url + "?sort=school_year")
        self.assertQuerySetEqual(
            response.context_data["object_list"],
            self.teacher.classes.all().order_by("school_year_start"),
        )

    def test_reading_supervisor_view(self):
        # A class at `cls.school` that nobody teaches
        other_class = self.create_class(2025, "9.Z", is_main=True)
        # A class at a school the læsevejleder is not linked to
        other_school = Institution.objects.create(number="test456", name="AndenSkole")
        Class.objects.create(
            institution=other_school,
            school_year_start=2025,
            name="9.Y",
            group_id="9.Y",
            is_main=True,
        )
        supervisor = self.create_reading_supervisor("Vejleder")

        self.client.force_login(supervisor)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"],
            [self.klasse, other_class],
            ordered=False,
        )


class TestClassDetailView(DysleksiTest):
    def test_teacher_view(self):
        view = self.setup_view(ClassDetailView, self.teacher, pk=self.klasse.pk)
        context_data = view.get_context_data()
        self.assertEqual(context_data["teacher"], self.klasse.teachers.first())
        self.assertQuerySetEqual(
            context_data["completed_test_assignments"], TestAssignment.objects.none()
        )
        self.assertQuerySetEqual(
            context_data["planned_test_assignments"],
            TestAssignment.objects.filter(pk=self.test_assignment_class.pk),
        )

    def test_student_view(self):
        self.client.force_login(self.student1)
        response = self.client.get(
            reverse("dysleksi:class_detail", kwargs={"pk": self.klasse.pk})
        )
        self.assertEqual(response.status_code, 403)


class TestStudentListView(DysleksiTest):

    url = reverse("dysleksi:student_list")

    def test_get_template_names(self):
        view = self.setup_view(StudentListView, self.teacher)
        self.assertEqual(
            view.get_template_names()[0], "dysleksi/admin/student/list.html"
        )

    def test_teacher_view(self):
        view = self.setup_view(StudentListView, self.teacher)
        expected_objs = Student.objects.filter(classes__teachers=self.teacher)
        self.assertQuerySetEqual(
            view.get_context_data()["object_list"], expected_objs, ordered=False
        )
        self.client.force_login(self.teacher)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], expected_objs, ordered=False
        )

    def test_student_view(self):
        self.client.force_login(self.student1)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)


class TestStudentDetailView(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        # Add student which is not part of `cls.klasse`
        klasse = cls.create_class(2025, "Matematik", is_main=False)
        klasse.teachers.add(cls.teacher)
        cls.student3 = cls.create_student(
            "TestStudent3", cpr=1234567892, first_name="Test3", last_name="Elev"
        )
        klasse.students.add(cls.student3)

    def test_teacher_views_student_belonging_to_a_main_class(self):
        view = self.setup_view(StudentDetailView, self.teacher, pk=self.student1.pk)
        context_data = view.get_context_data()
        self.assertEqual(context_data["teacher"], self.klasse.teachers.first())
        self.assertQuerySetEqual(
            context_data["completed_test_assignments"], TestAssignment.objects.none()
        )

    def test_teacher_views_student_not_belonging_to_a_main_class(self):
        view = self.setup_view(StudentDetailView, self.teacher, pk=self.student3.pk)
        context_data = view.get_context_data()
        self.assertNotIn("main_class", context_data)
        self.assertNotIn("teacher", context_data)

    def test_student_view(self):
        self.client.force_login(self.student1)
        response = self.client.get(
            reverse("dysleksi:student_detail", kwargs={"pk": self.student1.pk})
        )
        self.assertEqual(response.status_code, 403)


class TestTestAssignmentListView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.create_parts()

    def test_get_template_names(self):
        view = self.setup_view(TestAssignmentListView, self.teacher)
        self.assertEqual(
            view.get_template_names()[0], "dysleksi/admin/test_assignment/list.html"
        )

    def test_privileged_user_view(self):
        view = self.setup_view(TestAssignmentListView, self.privileged_user)
        expected_objs = TestAssignment.objects.all()
        self.assertQuerySetEqual(
            view.get_context_data()["object_list"], expected_objs, ordered=False
        )
        self.client.force_login(self.privileged_user)
        response = self.client.get(self._get_url())
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], expected_objs, ordered=False
        )

    def test_teacher_view(self):
        view = self.setup_view(TestAssignmentListView, self.teacher)
        expected_objs = TestAssignment.objects.filter(teacher=self.teacher)
        self.assertQuerySetEqual(
            view.get_context_data()["object_list"], expected_objs, ordered=False
        )
        self.client.force_login(self.teacher)
        response = self.client.get(self._get_url())
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], expected_objs, ordered=False
        )

    def test_other_teacher_view(self):
        view = self.setup_view(TestAssignmentListView, self.other_teacher)
        expected_objs = TestAssignment.objects.filter(teacher=self.other_teacher)
        self.assertQuerySetEqual(
            view.get_context_data()["object_list"], expected_objs, ordered=False
        )
        self.client.force_login(self.other_teacher)
        response = self.client.get(self._get_url())
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], expected_objs, ordered=False
        )

    def test_student_view(self):
        self.client.force_login(self.student1)
        response = self.client.get(self._get_url())
        self.assertEqual(response.status_code, 403)

    def test_queryset_annotations(self):
        # Arrange
        # Let there be only one TestResponse to group assignment
        self.test_response_class_2.delete()
        view = self.setup_view(TestAssignmentListView, self.teacher)
        objs = view.get_context_data()["object_list"]
        # Assert
        self.assertQuerySetEqual(
            objs,
            [
                # Individual student test assignment
                TestAssignmentStatus.COMPLETED,
                # Group test assignment
                TestAssignmentStatus.IN_PROGRESS,
            ],
            ordered=False,
            transform=attrgetter("status"),
        )

    def test_queryset_filter_on_class_pk(self):
        view = self.setup_view(
            TestAssignmentListView, self.teacher, class_pk=self.klasse.pk
        )
        objs = view.get_context_data()["object_list"]
        self.assertQuerySetEqual(
            objs.order_by("klasse__pk").values("klasse__pk", "student__pk"),
            [
                {"klasse__pk": self.klasse.pk, "student__pk": None},
                {"klasse__pk": None, "student__pk": self.student1.pk},
            ],
        )

    def _get_url(self, **kwargs):
        kwargs.setdefault("class_pk", self.klasse.pk)
        return reverse("dysleksi:class_assignment_list", kwargs=kwargs)


class TestAssignmentResultListView(DysleksiTest):
    def test_get_queryset(self):
        view = self.setup_view(AssignmentResultListView, self.teacher)
        self.assertQuerySetEqual(view.get_queryset(), [])

    def test_get_context_data(self):
        view = self.setup_view(AssignmentResultListView, self.teacher)
        context_data = view.get_context_data()
        self.assertIsNone(context_data["current_class"])
        self.assertIsNone(context_data["current_assignment"])


class TestStartRoomView(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        super().create_parts()
        cls.group_test_part_2, _ = TestPart.objects.get_or_create(
            name="GroupTestPart2",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.group_test.parts.add(cls.group_test_part_2)

    def test_create_individual_room_immediate(self):
        data = {
            "student": self.student1.id,
            "test": self.individual_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "y",
            "start_datetime": "",
            "end_datetime": "",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(
            reverse("dysleksi:start_individual_room"), data=data
        )
        assignment = TestAssignment.objects.order_by("-pk").first()
        expected_url = reverse("dysleksi:room", kwargs={"pk": assignment.pk})
        self._assert_json_response_contains_redirect(response, expected_url)

    def test_create_individual_room_planned_date_time(self):
        data = {
            "student": self.student1.id,
            "test": self.individual_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "n",
            "start_datetime": "2030-01-01T12:00",
            "end_datetime": "2030-01-01T13:00",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(
            reverse("dysleksi:start_individual_room"), data=data
        )
        self._assert_json_response_contains_redirect(
            response,
            reverse(
                "dysleksi:class_assignment_list",
                kwargs={"class_pk": self.klasse.pk},
            ),
        )
        assignment = TestAssignment.objects.latest("pk")
        self.assertIsNotNone(assignment.planned_date_time)

    def test_create_individual_room_test_parts(self):
        data = {
            "student": self.student1.id,
            "test": self.individual_test.id,
            "test_parts": [str(self.part.pk)],
            "is_test_part": "part",
            "is_immediate": "y",
            "start_datetime": "",
            "end_datetime": "",
        }
        self.client.force_login(self.teacher)
        test_count_before = Test.objects.count()
        response = self.client.post(
            reverse("dysleksi:start_individual_room"), data=data
        )
        test_count_after = Test.objects.count()
        assignment = TestAssignment.objects.order_by("-pk").first()
        expected_url = reverse("dysleksi:room", kwargs={"pk": assignment.pk})
        self._assert_json_response_contains_redirect(response, expected_url)
        self.assertTrue(test_count_after == test_count_before + 1)
        self.assertTrue(assignment.test, Test.objects.latest("pk"))

    def test_create_group_room_immediate(self):
        data = {
            "klasse": self.klasse.id,
            "test": self.group_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "y",
            "start_datetime": "",
            "end_datetime": "",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)
        assignment = TestAssignment.objects.order_by("-pk").first()
        expected_url = reverse("dysleksi:room", kwargs={"pk": assignment.pk})
        self._assert_json_response_contains_redirect(response, expected_url)

    def test_create_group_room_planned_date_time(self):
        data = {
            "klasse": self.klasse.id,
            "test": self.group_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "n",
            "start_datetime": "2030-01-01T12:00",
            "end_datetime": "2030-01-01T13:00",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)
        self._assert_json_response_contains_redirect(
            response,
            reverse(
                "dysleksi:class_assignment_list",
                kwargs={"class_pk": self.klasse.pk},
            ),
        )
        assignment = TestAssignment.objects.latest("pk")
        self.assertIsNotNone(assignment.planned_date_time)

    def test_create_group_room_test_parts(self):
        data = {
            "klasse": self.klasse.id,
            "test": self.group_test.id,
            "test_parts": [
                str(self.group_test_part.pk),
                str(self.group_test_part_2.pk),
            ],
            "is_test_part": "part",
            "is_immediate": "y",
            "start_datetime": "",
            "end_datetime": "",
        }
        self.client.force_login(self.teacher)
        test_count_before = Test.objects.count()
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)
        test_count_after = Test.objects.count()
        assignment = TestAssignment.objects.order_by("-pk").first()
        expected_url = reverse("dysleksi:room", kwargs={"pk": assignment.pk})
        self._assert_json_response_contains_redirect(response, expected_url)
        self.assertTrue(test_count_after == test_count_before + 1)
        self.assertTrue(assignment.test, Test.objects.latest("pk"))

    def test_json_response_on_invalid_form(self):
        data = {
            "klasse": self.klasse.id,
            "test": self.group_test.id,
            "is_test_part": "test",
            "is_immediate": "n",
            "start_datetime": "2025-01-01T00:00",
            "end_datetime": "",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)
        self.assertIsInstance(response, JsonResponse)
        doc = response.json()
        self.assertEqual(doc["status"], "error")
        self.assertEqual(doc["error"], _("Startdato kan ikke være i fortiden"))

    def _assert_json_response_contains_redirect(self, response, redirect):
        self.assertIsInstance(response, JsonResponse)
        doc = response.json()
        self.assertEqual(doc["status"], "success")
        self.assertEqual(doc["redirect"], redirect)


class TestAssignmentResultsView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.create_parts()

    def test_by_category(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_class.pk
        )
        by_category = view.get_by_category()
        self.assertEqual(len(by_category), CorrectnessCategory.objects.count())
        self.assertEqual(
            [category["color"] for category in by_category],
            list(
                CorrectnessCategory.objects.order_by(
                    "is_default", "upper_proportion_limit"
                ).values_list("color_key", flat=True)
            ),
        )
        self.assertEqual(
            [category["label"] for category in by_category],
            list(
                CorrectnessCategory.objects.order_by(
                    "is_default", "upper_proportion_limit"
                ).values_list("label_da", flat=True)
            ),
        )
        self.assertIn(
            self.test_response_class_1, by_category[3]["items"]
        )  # test_response_class_1 er over middel
        self.assertIn(
            self.test_response_class_2, by_category[1]["items"]
        )  # test_response_class_2 er under middel

    def test_table(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_class.pk
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, TestResultTable))
        qs = table.data.data

        part1_key = f"part_{self.group_test_part.pk}_correct"
        first = qs[0]
        self.assertEqual(getattr(first, f"{part1_key}_count"), 4)
        self.assertEqual(getattr(first, f"{part1_key}_proportion"), 1.0)
        self.assertEqual(
            getattr(first, f"{part1_key}_category"),
            CorrectnessCategory.objects.get(color_key="blue").pk,
        )
        second = qs[1]
        self.assertEqual(getattr(second, f"{part1_key}_count"), 1)
        self.assertEqual(getattr(second, f"{part1_key}_proportion"), 0.25)
        self.assertEqual(
            getattr(second, f"{part1_key}_category"),
            CorrectnessCategory.objects.get(color_key="yellow").pk,
        )

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_render(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_class.pk
        )
        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Elev"], ["GroupTestPart1", "0-0", "1-1", "2-3", "4-4"], [], []],
                [["Test1 Elev"], ["4"], [], []],
                [["Test2 Elev"], ["1"], [], []],
                [["Gennemsnit"], ["Middel", "Se detaljer"], [], []],
            ],
        )
        self.assertIsNotNone(soup.find(id="results-by-category"))

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_only_table(self):
        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            query_params={"only_table": "true"},
            pk=self.test_assignment_class.pk,
        )
        response = view.response
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Elev"], ["GroupTestPart1", "0-0", "1-1", "2-3", "4-4"], [], []],
                [["Test1 Elev"], ["4"], [], []],
                [["Test2 Elev"], ["1"], [], []],
                [["Gennemsnit"], ["Middel", "Se detaljer"], [], []],
            ],
        )
        self.assertIsNone(soup.find(id="results-by-category"))

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_get_pagination(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_class.pk
        )
        with patch.object(view, "get_current_page", return_value=1):
            pagination = view.get_pagination()
            self.assertTrue(type(pagination) is dict)
            self.assertEqual(pagination["current_page"], 1)
            self.assertEqual(pagination["current_first"], 1)
            self.assertEqual(pagination["current_last"], 1)
            self.assertEqual(pagination["total_count"], 1)
            self.assertEqual(pagination["page_size"], 3)
            self.assertEqual(pagination["last_page"], 1)

        with patch.object(view, "get_current_page", return_value=2):
            pagination = view.get_pagination()
            self.assertEqual(pagination["current_page"], 2)
            self.assertEqual(pagination["current_first"], 1)
            self.assertEqual(pagination["current_last"], 1)
            self.assertEqual(pagination["total_count"], 1)
            self.assertEqual(pagination["page_size"], 3)
            self.assertEqual(pagination["last_page"], 1)

    def test_pagination_buttons_range(self):
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(1, 5, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(1, 20, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(3, 5, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(3, 20, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(4, 5, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(4, 20, 5), [2, 3, 4, 5, 6]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(5, 5, 5), [1, 2, 3, 4, 5]
        )
        self.assertEqual(
            PaginationMixin.pagination_buttons_range(5, 20, 5), [3, 4, 5, 6, 7]
        )

    def test_access(self):
        for user in (self.teacher, self.student1):
            self.setup_view(
                AssignmentResultsView, user, pk=self.test_assignment_class.pk
            )
        for user in (
            self.other_user,
            self.other_teacher,
            self.inactive_user,
            self.not_logged_in_user,
        ):
            with self.assertRaises(PermissionDenied):
                self.setup_view(
                    AssignmentResultsView, user, pk=self.test_assignment_class.pk
                )

    def test_redirect_individual(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_student.pk
        )
        response = view.response
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.headers["Location"],
            reverse(
                "dysleksi:test_assignment_student_results",
                kwargs={
                    "assignment_pk": self.test_assignment_student.pk,
                    "response_pk": self.test_response_student.pk,
                },
            ),
        )


class TestAssignmentResultsFlagView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        super().create_parts()

    def request(self, user: User, method: str, pk: int, data: dict | None = None):
        request_factory = RequestFactory()
        path = reverse("dysleksi:test_response_flag", kwargs={"pk": pk})
        if method == "get":
            request = request_factory.get(path)
        elif method == "post":
            request = request_factory.post(path, data)
        else:
            raise ValueError(f"method must be get or post, not '{method}'")
        request.user = user
        view = AssignmentResultsFlagView()
        view.setup(request, pk=pk)
        view.response = view.dispatch(request, pk=pk)
        return view

    def test_set_true(self):
        self.test_response_class_1.flagged = False
        self.test_response_class_1.save()
        view = self.request(
            self.teacher, "post", self.test_response_class_1.pk, {"flagged": "true"}
        )
        self.test_response_class_1.refresh_from_db()
        self.assertTrue(self.test_response_class_1.flagged)
        self.assertEqual(json.loads(view.response.content), {"flagged": True})

    def test_set_false(self):
        self.test_response_class_1.flagged = True
        self.test_response_class_1.save()
        view = self.request(
            self.teacher, "post", self.test_response_class_1.pk, {"flagged": "false"}
        )
        self.test_response_class_1.refresh_from_db()
        self.assertFalse(self.test_response_class_1.flagged)
        self.assertEqual(json.loads(view.response.content), {"flagged": False})

    def test_get_ordering(self):
        part1_key = f"part_{self.group_test_part.pk}_correct"
        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
            query_params={"sort": part1_key},
        )
        self.assertEqual(view.get_ordering(), [f"{part1_key}_count"])

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
            query_params={"sort": "-" + part1_key},
        )
        self.assertEqual(view.get_ordering(), [f"-{part1_key}_count"])

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
            query_params={"sort": "student"},
        )
        self.assertEqual(
            view.get_ordering(), ["student__first_name", "student__last_name"]
        )

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
            query_params={"sort": "-student"},
        )
        self.assertEqual(
            view.get_ordering(), ["-student__first_name", "-student__last_name"]
        )

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
        )
        self.assertEqual(
            view.get_ordering(), ["student__first_name", "student__last_name"]
        )

    def test_access(self):
        self.assertEqual(
            self.request(
                self.teacher, "get", self.test_response_class_1.pk
            ).response.status_code,
            200,
        )
        self.assertEqual(
            self.request(
                self.teacher, "post", self.test_response_class_1.pk, {"flagged": "true"}
            ).response.status_code,
            200,
        )
        for user in (
            self.student1,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
        ):
            with self.assertRaises(PermissionDenied, msg=user.username):
                self.request(user, "get", self.test_response_class_1.pk)

            with self.assertRaises(PermissionDenied):
                self.request(
                    user, "post", self.test_response_class_1.pk, {"flagged": "true"}
                )


class TestAssignmentPartResultsView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        super().create_parts()

    def test_table(self):
        view = self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, PartResultTable))
        qs = table.data.data
        answer1 = qs[0]
        answer2 = qs[1]

        self.assertEqual(answer1.responses_count, 4)
        self.assertEqual(answer1.correct_count, 4)
        self.assertEqual(answer1.almost_correct_count, 0)
        self.assertEqual(answer1.score, 4)
        self.assertEqual(answer1.correct_proportion, 1.0)
        self.assertEqual(answer1.correct_percentage, 100)

        self.assertEqual(answer2.responses_count, 4)
        self.assertEqual(answer2.correct_count, 1)
        self.assertEqual(answer2.almost_correct_count, 0)
        self.assertEqual(answer2.score, 1)
        self.assertEqual(answer2.correct_proportion, 0.25)
        self.assertEqual(answer2.correct_percentage, 25)

    def test_get_ordering(self):
        view = self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
            query_params={"sort": "student"},
        )
        self.assertEqual(
            view.get_ordering(),
            [
                "testresponse__student__first_name",
                "testresponse__student__last_name",
            ],
        )

        view = self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
            query_params={"sort": "-student"},
        )
        self.assertEqual(
            view.get_ordering(),
            [
                "-testresponse__student__first_name",
                "-testresponse__student__last_name",
            ],
        )

        view = self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
            query_params={"sort": "correct_count"},
        )
        self.assertEqual(view.get_ordering(), ["correct_count"])

    def test_table_render(self):
        view = self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
        )
        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        self.assertEqual(
            self.html_table_to_list(soup.find("table")),
            [
                [
                    ["Elev"],
                    ["Forsøgte"],
                    ["Rigtige"],
                    ["Næsten rigtige"],
                    ["Rigtighedsprocent"],
                    ["Normscore (0-100)"],
                ],
                [["Test1 Elev"], ["4"], ["4"], ["0"], ["100%"], ["100"]],
                [["Test2 Elev"], ["4"], ["1"], ["0"], ["25%"], ["25"]],
            ],
        )

    def test_access(self):
        self.setup_view(
            AssignmentPartResultsView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testpart_pk=self.group_test_part.pk,
        )
        for user in (
            self.student1,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
            self.not_logged_in_user,
        ):
            with self.assertRaises(PermissionDenied):
                self.setup_view(
                    AssignmentPartResultsView,
                    user,
                    assignment_pk=self.test_assignment_class.pk,
                    testpart_pk=self.group_test_part.pk,
                )


class TestTestResponseView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.create_wordspelling_part(True)
        cls.create_sentencereading_part(True)

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_table_group(self):

        self.create_wordspelling_part(False)
        self.create_sentencereading_part(False)

        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            response_pk=self.test_response_class_1.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_key_1 = f"part_{self.wordspelling_part.pk}"
        part_key_2 = f"part_{self.sentencereading_part.pk}"
        self.assertEqual(
            table.data.data,
            [
                {
                    "data_category": "Antal forsøgte",
                    f"{part_key_1}_lette_ord": 1,
                    f"{part_key_1}_nemme_ord": 1,
                    part_key_2: 1,
                },
                {
                    "data_category": "Antal rigtige",
                    f"{part_key_1}_lette_ord": 0,
                    f"{part_key_1}_nemme_ord": 1,
                    part_key_2: 1,
                },
                {
                    "data_category": "Antal næsten rigtige",
                    f"{part_key_1}_lette_ord": 1,
                    f"{part_key_1}_nemme_ord": 0,
                    part_key_2: 0,
                },
                {
                    "data_category": "Rigtighedsprocent",
                    f"{part_key_1}_lette_ord": "50 %",
                    f"{part_key_1}_nemme_ord": "100 %",
                    part_key_2: "100 %",
                },
                {
                    "data_category": "Normscore",
                    f"{part_key_1}_lette_ord": "25 %",
                    f"{part_key_1}_nemme_ord": "50 %",
                    part_key_2: "50 %",
                },
            ],
        )
        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            [
                "Bedømmelse",
                "Under middel;Se elevens svar",
                "Middel;Se elevens svar",
                "Middel;Se elevens svar",
                "",
            ],
        )

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_table_individual_unanswered(self):
        self.sentencereading_part.partresponses.all().delete()
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_key_1 = f"part_{self.wordspelling_part.pk}"
        part_key_2 = f"part_{self.sentencereading_part.pk}"
        self.assertEqual(
            table.data.data,
            [
                {
                    "data_category": "Antal forsøgte",
                    f"{part_key_1}_lette_ord": 1,
                    f"{part_key_1}_nemme_ord": 1,
                    part_key_2: None,
                },
                {
                    "data_category": "Antal oversprungne",
                    f"{part_key_1}_lette_ord": 0,
                    f"{part_key_1}_nemme_ord": 0,
                    part_key_2: None,
                },
                {
                    "data_category": "Antal rigtige",
                    f"{part_key_1}_lette_ord": 0,
                    f"{part_key_1}_nemme_ord": 1,
                    part_key_2: None,
                },
                {
                    "data_category": "Antal næsten rigtige",
                    f"{part_key_1}_lette_ord": 1,
                    f"{part_key_1}_nemme_ord": 0,
                    part_key_2: None,
                },
                {
                    "data_category": "Rigtighedsprocent",
                    f"{part_key_1}_lette_ord": "50 %",
                    f"{part_key_1}_nemme_ord": "100 %",
                    part_key_2: None,
                },
                {
                    "data_category": "Normscore",
                    f"{part_key_1}_lette_ord": "50 %",
                    f"{part_key_1}_nemme_ord": "100 %",
                    part_key_2: None,
                },
            ],
        )
        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            [
                "Bedømmelse",
                "Middel;Se elevens svar",
                "Over middel;Se elevens svar",
                "Ikke fuldført",
                "",
            ],
        )

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_only_table(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            query_params={"only_table": "true"},
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        response = view.response
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [[], ["WordSpelling (2 opg.)"], ["SentenceReading (1 opg.)"], []],
                [["Lette ord (1 opg.)"], ["Nemme ord (1 opg.)"]],
                [["Antal forsøgte"], ["1"], ["1"], ["1"], []],
                [["Antal oversprungne"], ["0"], ["0"], ["0"], []],
                [["Antal rigtige"], ["0"], ["1"], ["1"], []],
                [["Antal næsten rigtige"], ["1"], ["0"], ["0"], []],
                [["Rigtighedsprocent"], ["50 %"], ["100 %"], ["100 %"], []],
                [["Normscore"], ["50 %"], ["100 %"], ["100 %"], []],
                [
                    ["Bedømmelse"],
                    ["Middel", "Se elevens svar"],
                    ["Over middel", "Se elevens svar"],
                    ["Over middel", "Se elevens svar"],
                    [],
                ],
            ],
        )

    def test_access(self):
        self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        for user in (
            self.student1,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
            self.not_logged_in_user,
        ):
            with self.assertRaises(PermissionDenied):
                self.setup_view(
                    TestResponseView,
                    user,
                    assignment_pk=self.test_assignment_student.pk,
                    response_pk=self.test_response_student.pk,
                )

    @override_settings(RESULT_TABLE_SIZE=2)
    def test_table_individual(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_key_a = f"part_{self.wordspelling_part.pk}_lette_ord"
        part_key_b = f"part_{self.wordspelling_part.pk}_nemme_ord"
        part_key_c = f"part_{self.sentencereading_part.pk}"
        self.assertEqual(
            table.data.data[0],
            {
                "data_category": "Antal forsøgte",
                part_key_a: 1,
                part_key_b: 1,
                part_key_c: 1,
            },
        )
        self.assertEqual(
            table.data.data[1],
            {
                "data_category": "Antal oversprungne",
                part_key_a: 0,
                part_key_b: 0,
                part_key_c: 0,
            },
        )
        self.assertEqual(
            table.data.data[2],
            {
                "data_category": "Antal rigtige",
                part_key_a: 0,
                part_key_b: 1,
                part_key_c: 1,
            },
        )
        self.assertEqual(
            table.data.data[3],
            {
                "data_category": "Antal næsten rigtige",
                part_key_a: 1,
                part_key_b: 0,
                part_key_c: 0,
            },
        )
        self.assertEqual(
            table.data.data[4],
            {
                "data_category": "Rigtighedsprocent",
                part_key_a: "50 %",
                part_key_b: "100 %",
                part_key_c: "100 %",
            },
        )
        self.assertEqual(
            table.data.data[5],
            {
                "data_category": "Normscore",
                part_key_a: "50 %",
                part_key_b: "100 %",
                part_key_c: "100 %",
            },
        )

        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            [
                "Bedømmelse",
                # 0,5 rigtige ud af 1 opgave
                "Middel;Se elevens svar",
                # 1 rigtig ud af 1 opgave
                "Over middel;Se elevens svar",
                # 1 rigtig ud af 1 opgave
                "Over middel;Se elevens svar",
            ],
        )

    def test_get_plot_data(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        self.assertEqual(view.get_plot_data(), [50, 100, 100])

    def test_get_part_names(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        self.assertEqual(
            view.get_part_names(),
            {
                self.wordspelling_part.pk: (
                    "WordSpelling",
                    ["Lette ord", "Nemme ord"],
                    True,
                ),
                self.sentencereading_part.pk: ("SentenceReading", [None], True),
            },
        )


class TestPartResponseView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        super().create_parts()
        cls.create_sentencereading_part(False)
        cls.create_lettershape_part(False)
        cls.create_readingspeed_categories()

    def test_get_object(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        object = view.get_object()
        self.assertEqual(object.responses_count, 4)
        self.assertEqual(object.questions_count, 4)
        self.assertEqual(object.correct_count, 4)
        self.assertEqual(object.responses_proportion, 1.0)
        self.assertEqual(object.responses_pct, 100)
        self.assertEqual(object.correct_proportion, 1.0)
        self.assertEqual(object.correct_pct, 100)

        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_2.pk,
            testpart_pk=self.group_test_part.pk,
        )
        object = view.get_object()
        self.assertEqual(object.responses_count, 4)
        self.assertEqual(object.questions_count, 4)
        self.assertEqual(object.correct_count, 1)
        self.assertEqual(object.responses_proportion, 1.0)
        self.assertEqual(object.responses_pct, 100)
        self.assertEqual(object.correct_proportion, 0.25)
        self.assertEqual(object.correct_pct, 25)

    def test_get_object_404(self):
        with self.assertRaises(Http404):
            self.setup_view(
                PartResponseView,
                self.teacher,
                assignment_pk=self.test_assignment_class.pk,
                testresponse_pk=self.test_response_class_1.pk,
                testpart_pk=self.group_test_part.pk + 100,
            )

    def test_word_length_table(self):
        part: TestPart = self.group_test_part
        part.wordcount_data_breakdown.clear()
        part.answer_time_data_breakdown.clear()
        part.set_data_breakdown_ranges(
            "wordlength_data_breakdown", [(None, 4), (5, 6), (7, 8), (9, None)]
        )
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        context = view.get_context_data()
        table_data = [row for row in context["wordlength_table"].data]

        self.assertEqual(
            table_data,
            [
                {"word_length": "None-4", "questions_count": 0, "correct_count": 0},
                {"word_length": "5-6", "questions_count": 0, "correct_count": 0},
                {"word_length": "7-8", "questions_count": 2, "correct_count": 2},
                {"word_length": "9-None", "questions_count": 0, "correct_count": 0},
            ],
        )
        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Ordlængde (ant. bogstaver)"], ["Opgaver"], ["Rigtige"]],
                [["None-4"], ["0"], ["0"]],
                [["5-6"], ["0"], ["0"]],
                [["7-8"], ["2"], ["2"]],
                [["9-None"], ["0"], ["0"]],
            ],
        )

    def test_word_count_table(self):
        part: TestPart = self.group_test_part
        part.wordlength_data_breakdown.clear()
        part.answer_time_data_breakdown.clear()
        part.set_data_breakdown_ranges(
            "wordcount_data_breakdown", [(None, 2), (3, None)]
        )
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        context = view.get_context_data()
        table_data = [row for row in context["wordcount_table"].data]
        self.assertEqual(
            table_data,
            [
                {"word_count": "None-2", "questions_count": 2, "correct_count": 2},
                {"word_count": "3-None", "questions_count": 0, "correct_count": 0},
            ],
        )
        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Sætningslængde (ant. ord)"], ["Opgaver"], ["Rigtige"]],
                [["None-2"], ["2"], ["2"]],
                [["3-None"], ["0"], ["0"]],
            ],
        )

    def test_time_slot_table(self):
        part: TestPart = self.group_test_part
        part.wordlength_data_breakdown.clear()
        part.wordcount_data_breakdown.clear()
        part.set_data_breakdown_ranges(
            "answer_time_data_breakdown", [(None, 5), (5, None), (None, None), (0, 7)]
        )
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        context = view.get_context_data()
        table_data = [row for row in context["timeslot_table"].data]
        self.assertEqual(
            table_data,
            [
                {"time_slot": (None, 5), "correct_count": 4},
                {"time_slot": (None, None), "correct_count": 4},
                {"time_slot": (0, 7), "correct_count": 4},
                {"time_slot": (5, None), "correct_count": 0},
            ],
        )
        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Første 5 minutter"], ["4"]],
                [["Alle"], ["4"]],
                [["0 minutter til 7 minutter"], ["4"]],
                [["Sidste 5 minutter"], ["0"]],
            ],
        )

    def test_answer_time_table(self):
        part: TestPart = self.group_test_part
        part.wordlength_data_breakdown.clear()
        part.wordcount_data_breakdown.clear()
        part.show_answer_time_statistics = True
        part.save(update_fields=["show_answer_time_statistics"])
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        context = view.get_context_data()
        table_data = [row for row in context["answer_time_table"].data]
        self.assertEqual(
            table_data,
            [
                {"metric": "Totalt tidsforbrug", "answer_time": timedelta(seconds=90)},
                {
                    "metric": "Gennemsnitlig svartid",
                    "answer_time": timedelta(seconds=22, microseconds=500000),
                },
            ],
        )

        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Totalt tidsforbrug"], ["1 min. 30 sek."]],
                [["Gennemsnitlig svartid"], ["22 sek."]],
            ],
        )

    def test_no_tables(self):
        part: TestPart = self.group_test_part
        part.wordlength_data_breakdown.clear()
        part.wordcount_data_breakdown.clear()
        part.answer_time_data_breakdown.clear()
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        context = view.get_context_data()
        self.assertFalse("timeslot_table" in context)
        self.assertFalse("wordcount_table" in context)
        self.assertFalse("wordlength_table" in context)

    def test_answer_table_sentence_reading(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.sentencereading_part.pk,
        )
        context = view.get_context_data()
        table = context["responses_table"]
        self.assertNotIn("challenge_sentence", table.exclude)

    def test_answer_table_letter_shape(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.lettershape_part.pk,
        )
        context = view.get_context_data()
        table = context["responses_table"]
        self.assertIn("challenge_image", table.exclude)
        self.assertIn("challenge_text", table.exclude)
        self.assertIn("challenge_sound", table.exclude)
        self.assertIn("challenge_sentence", table.exclude)

        response = view.response
        response.render()
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(
            soup.find("div", id="test-results-table").find("table")
        )
        self.assertEqual(
            table,
            [
                [["Opg."], ["Rigtigt svar"], ["Elevens svar"], ["Tid"]],
                [["1"], ["A / a"], ["A", "/", "a"], ["5 sek."]],
                [["2"], ["B / b"], ["C", "/", "c"], ["5 sek."]],
                [[], [], [], ["10 sek."]],
            ],
        )

    def test_access(self):
        self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        for user in (
            self.student1,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
            self.not_logged_in_user,
        ):
            with self.assertRaises(PermissionDenied):
                self.setup_view(
                    PartResponseView,
                    user,
                    assignment_pk=self.test_assignment_class.pk,
                    testresponse_pk=self.test_response_class_1.pk,
                    testpart_pk=self.group_test_part.pk,
                )

    def test_only_table(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            query_params={"only_table": "true"},
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        response = view.response
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Opg."], ["Billede"], ["Rigtigt svar"], ["Elevens svar"], ["Tid"]],
                [["1"], [], [], ["TestOrd"], ["3 sek."]],
                [["2"], [], ["TestOrd"], ["TestOrd"], ["4 sek."]],
                [["3"], [], [], [], ["5 sek."]],
                [["4"], [], [], [], ["6 sek."]],
                [[], [], [], [], ["18 sek."]],
            ],
        )
        container = soup.find("table").parent
        self.assertEqual(container.attrs["class"], ["table-container"])

    def test_normscore_plot_higher(self):
        self.create_wordreading_part(False)
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.wordreading_part.pk,
        )
        context = view.get_context_data()
        self.assertIn("ReadingSpeedCategories", context)
        self.assertAlmostEqual(
            context["ReadingSpeedCategories"][1].scaled_width(), 1 / 12
        )
        self.assertAlmostEqual(context["y_scale"], 12.0)
        self.assertEqual(context["plot"], [(1.0, 12.0)])

    def test_normscore_plot_lower(self):
        self.create_wordreading_part(False)
        self.wordreading_questionresponse_1.finished_after = 10000
        self.wordreading_questionresponse_1.save()
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.test_response_class_1.pk,
            testpart_pk=self.wordreading_part.pk,
        )
        context = view.get_context_data()
        self.assertIn("ReadingSpeedCategories", context)
        self.assertAlmostEqual(context["ReadingSpeedCategories"][1].scaled_width(), 0.1)
        self.assertAlmostEqual(context["y_scale"], 10.0)
        self.assertEqual(context["plot"], [(1.0, 6.0)])


class TestClientErrorLogView(DysleksiTest):

    payload = {
        "kind": "uncaught",
        "message": "TypeError: x is not a function",
        "stack": "TypeError: x is not a function\n    at play (dom.js:12:34)",
        "source": "https://dysleksi-web/static/js/screening/dom.js:12:34",
        "url": "https://dysleksi-web/assignment/1/",
        "user_agent": "Mozilla/5.0",
    }

    def post(self, data, user=None, content_type="application/json"):
        request = RequestFactory().post("", data=data, content_type=content_type)
        request.user = user if user is not None else AnonymousUser()
        with patch("dysleksi.views.client_error_logger") as logger:
            response = ClientErrorLogView.as_view()(request)
        return response, logger

    def test_logs_report(self):
        response, logger = self.post(self.payload, user=self.student1)
        self.assertEqual(response.status_code, 204)
        logger.error.assert_called_once_with(
            f"uncaught [user={self.student1.username}] "
            "[page=https://dysleksi-web/assignment/1/] "
            "TypeError: x is not a function\n"
            "    at https://dysleksi-web/static/js/screening/dom.js:12:34\n"
            "    TypeError: x is not a function\n"
            "    at play (dom.js:12:34)\n"
            "    user agent: Mozilla/5.0"
        )

    def test_logs_report_for_anonymous_user(self):
        response, logger = self.post(self.payload)
        self.assertEqual(response.status_code, 204)
        self.assertIn("[user=anonymous]", logger.error.call_args.args[0])

    def test_logs_minimal_report(self):
        response, logger = self.post({})
        self.assertEqual(response.status_code, 204)
        logger.error.assert_called_once_with("unknown [user=anonymous] [page=?] ")

    def test_logs_unknown_kind_as_unknown(self):
        response, logger = self.post({"kind": "<script>", "message": "hey"})
        self.assertEqual(response.status_code, 204)
        logger.error.assert_called_once_with("unknown [user=anonymous] [page=?] hey")

    def test_logs_report_limit_being_reached(self):
        response, logger = self.post({"kind": "limit", "message": "no more reports"})
        self.assertEqual(response.status_code, 204)
        logger.error.assert_called_once_with(
            "limit [user=anonymous] [page=?] no more reports"
        )

    def test_truncates_long_fields(self):
        response, logger = self.post(
            {"kind": "console.error", "message": "m" * 3000, "stack": "s" * 5000}
        )
        self.assertEqual(response.status_code, 204)
        first_line, stack_line = logger.error.call_args.args[0].splitlines()
        self.assertEqual(
            first_line,
            "console.error [user=anonymous] [page=?] "
            + "m" * ClientErrorLogView.max_message_length,
        )
        self.assertEqual(stack_line.strip(), "s" * ClientErrorLogView.max_stack_length)

    def test_rejects_invalid_json(self):
        response, logger = self.post("not json", content_type="text/plain")
        self.assertEqual(response.status_code, 400)
        logger.error.assert_not_called()

    def test_rejects_non_object_payload(self):
        response, logger = self.post([1, 2, 3])
        self.assertEqual(response.status_code, 400)
        logger.error.assert_not_called()

    def test_rejects_oversized_payload(self):
        response, logger = self.post({"message": "m" * 20000})
        self.assertEqual(response.status_code, 413)
        logger.error.assert_not_called()

    def test_rejects_get(self):
        request = RequestFactory().get("")
        request.user = AnonymousUser()
        response = ClientErrorLogView.as_view()(request)
        self.assertEqual(response.status_code, 405)


LOCMEM_CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    "chat": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "window-lock-tests",
    },
}


@override_settings(CACHES=LOCMEM_CACHES)
class WindowLockViewTest(DysleksiTest):
    def setUp(self):
        super().setUp()
        caches["chat"].clear()

    def url(self, assignment=None):
        assignment = assignment or self.test_assignment_student
        return reverse("dysleksi:window_lock", kwargs={"pk": assignment.pk})

    def claim(self, window_id, assignment=None, **extra):
        # A claim without "acquire" is what a window that is already open sends
        # to renew its lease
        return self.client.post(
            self.url(assignment),
            data=json.dumps({"windowId": window_id, **extra}),
            content_type="application/json",
        )

    def acquire(self, window_id, assignment=None):
        # What a window that has just opened sends
        return self.claim(window_id, assignment, acquire=True)

    def assertGranted(self, response, granted):
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {"granted": granted})

    def test_first_window_is_granted_the_lock(self):
        self.client.force_login(self.teacher)
        self.assertGranted(self.acquire("window-a"), True)

    def test_second_window_is_refused(self):
        self.client.force_login(self.teacher)
        self.acquire("window-a")
        self.assertGranted(self.acquire("window-b"), False)

    def test_the_holder_can_renew_its_lease(self):
        self.client.force_login(self.teacher)
        self.acquire("window-a")
        self.assertGranted(self.claim("window-a"), True)
        # Renewing does not let anyone else in
        self.assertGranted(self.acquire("window-b"), False)

    def test_a_released_lock_is_free_again(self):
        self.client.force_login(self.teacher)
        self.acquire("window-a")
        self.assertGranted(self.claim("window-a", release=True), False)
        self.assertGranted(self.acquire("window-b"), True)

    def test_a_window_cannot_release_someone_elses_lock(self):
        self.client.force_login(self.teacher)
        self.acquire("window-a")
        self.claim("window-b", release=True)
        self.assertGranted(self.acquire("window-c"), False)

    def test_an_expired_lease_is_free_again(self):
        self.client.force_login(self.teacher)
        self.acquire("window-a")
        # The holder stopped renewing, so the lease ran out
        caches["chat"].clear()
        self.assertGranted(self.acquire("window-b"), True)

    def test_students_of_a_group_test_do_not_block_each_other(self):
        assignment = self.test_assignment_class
        self.client.force_login(self.student1)
        self.assertGranted(self.acquire("window-a", assignment), True)
        self.client.force_login(self.student2)
        self.assertGranted(self.acquire("window-b", assignment), True)

    def test_a_student_does_not_block_the_teacher(self):
        assignment = self.test_assignment_class
        self.client.force_login(self.student1)
        self.assertGranted(self.acquire("window-a", assignment), True)
        self.client.force_login(self.teacher)
        self.assertGranted(self.acquire("window-b", assignment), True)

    def test_a_new_student_window_takes_the_test_over(self):
        assignment = self.test_assignment_class
        self.client.force_login(self.student1)
        self.assertGranted(self.acquire("window-a", assignment), True)
        self.assertGranted(self.acquire("window-b", assignment), True)
        # The window that held the lock is told to stop
        self.assertGranted(self.claim("window-a", assignment), False)
        self.assertGranted(self.claim("window-b", assignment), True)

    def test_the_lock_is_per_assignment(self):
        self.client.force_login(self.teacher)
        self.assertGranted(self.acquire("window-a", self.test_assignment_student), True)
        self.assertGranted(self.acquire("window-b", self.test_assignment_class), True)
