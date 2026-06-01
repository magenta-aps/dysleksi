# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
from unittest.mock import patch

from bs4 import BeautifulSoup
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.http.response import Http404
from django.test import RequestFactory, override_settings
from django.urls import reverse
from django.views import View

from dysleksi.models import (
    CorrectnessCategory,
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
    AssignmentResultsFlagView,
    AssignmentResultsView,
    AssignmentView,
    ClassListView,
    PaginationMixin,
    PartResponseView,
    RootView,
    StudentListView,
    TestAssignmentListView,
    TestResponseView,
    UserTypeMixin,
)


class TestUserTypeMixin(DysleksiTest):
    def test_template_name(self):
        class UserTypeView(UserTypeMixin, View):
            pass

        view = self.setup_view(UserTypeView, self.student, False)
        self.assertEqual(view.get_template_names(), ["dysleksi/student.html"])


class TestRootView(DysleksiTest):
    def test_get_template_names(self):
        cases: list[tuple[User, str | None]] = [
            (self.teacher, "dysleksi/lobby/teacher.html"),
            (self.student, "dysleksi/lobby/student.html"),
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
            (self.student, ["student", "open_assignments"]),
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

    def test_open_assignments_for_student(self):
        # In the default test setup, `self.student` has an open test assignment
        view = self.setup_view(RootView, self.student)
        open_assignments = view.get_context_data()["open_assignments"]
        self.assertTrue(open_assignments)


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
            test=cls.test2, teacher=cls.teacher, student=cls.student
        )

    def test_get_template_names(self):
        cases: list[tuple[User, str | None, TestAssignment]] = [
            (
                self.teacher,
                "dysleksi/admin/test_assignment/detail_individual.html",
                "student_123",
                self.assignment2,
            ),
            (
                self.student,
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
                self.student,
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
            for user in (self.admin, self.teacher, self.student, self.privileged_user):
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
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_schoolyear_ordering(self):
        self.client.force_login(self.teacher)
        response = self.client.get(self.url + "?sort=school_year")
        self.assertQuerySetEqual(
            response.context_data["object_list"],
            self.teacher.classes.all().order_by("school_year_start"),
        )


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
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)


class TestTestAssignmentListView(DysleksiTest):

    url = reverse("dysleksi:test_assignment_list")

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
        response = self.client.get(self.url)
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
        response = self.client.get(self.url)
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
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertQuerySetEqual(
            response.context_data["object_list"], expected_objs, ordered=False
        )

    def test_student_view(self):
        self.client.force_login(self.student)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_queryset_annotations(self):
        # Arrange
        view = self.setup_view(TestAssignmentListView, self.teacher)
        objs = view.get_context_data()["object_list"]
        # Assert
        self.assertQuerySetEqual(
            objs,
            [
                # Individual student test assignment
                (1, 1, TestAssignmentStatus.COMPLETED),
                # Group test assignment
                (3, 1, TestAssignmentStatus.IN_PROGRESS),
            ],
            ordered=False,
            transform=lambda obj: (
                obj.number_of_students,
                obj.number_of_students_responded,
                obj.status,
            ),
        )


class TestStartRoomView(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.group_test_part_2, _ = TestPart.objects.get_or_create(
            name="GroupTestPart2",
            timeout=60000,
            partial_score_after=30000,
        )
        cls.group_test.parts.add(cls.group_test_part_2)

    def test_create_individual_room_immediate(self):
        data = {
            "student": self.student.id,
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
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, expected_url)

    def test_create_individual_room_planned_date_time(self):
        data = {
            "student": self.student.id,
            "test": self.individual_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "n",
            "start_datetime": "2026-01-01T12:00",
            "end_datetime": "2026-01-01T13:00",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(
            reverse("dysleksi:start_individual_room"), data=data
        )
        assignment = TestAssignment.objects.latest("pk")
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("dysleksi:test_assignment_list"))
        self.assertIsNotNone(assignment.planned_date_time)

    def test_create_individual_room_test_parts(self):
        data = {
            "student": self.student.id,
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
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, expected_url)
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
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, expected_url)

    def test_create_group_room_planned_date_time(self):
        data = {
            "klasse": self.klasse.id,
            "test": self.group_test.id,
            "test_parts": [],
            "is_test_part": "test",
            "is_immediate": "n",
            "start_datetime": "2026-01-01T12:00",
            "end_datetime": "2026-01-01T13:00",
        }
        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("dysleksi:test_assignment_list"))
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
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, expected_url)
        self.assertTrue(test_count_after == test_count_before + 1)
        self.assertTrue(assignment.test, Test.objects.latest("pk"))


class TestAssignmentResultsView(ResponseTest):

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
            self.group_testresponse_1, by_category[3]["items"]
        )  # group_testresponse_1 er over middel
        self.assertIn(
            self.group_testresponse_2, by_category[1]["items"]
        )  # group_testresponse_2 er under middel

    def test_table(self):
        view = self.setup_view(
            AssignmentResultsView, self.teacher, pk=self.test_assignment_class.pk
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, TestResultTable))
        qs = table.data.data

        part1_key = f"part_{self.group_test_part.pk}_correct"

        best = qs[0]
        self.assertEqual(best.rank, 1)
        self.assertEqual(getattr(best, f"{part1_key}_count"), 4)
        self.assertEqual(getattr(best, f"{part1_key}_proportion"), 1.0)
        self.assertEqual(
            getattr(best, f"{part1_key}_category"),
            CorrectnessCategory.objects.get(color_key="blue").pk,
        )

        secondbest = qs[1]
        self.assertEqual(secondbest.rank, 2)
        self.assertEqual(getattr(secondbest, f"{part1_key}_count"), 1)
        self.assertEqual(getattr(secondbest, f"{part1_key}_proportion"), 0.25)
        self.assertEqual(
            getattr(secondbest, f"{part1_key}_category"),
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
                [["1.", "Test Elev"], ["4"], [], []],
                [["2."], ["1"], [], []],
                [["3.", "Test Elev"], ["0"], [], []],
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
                [["1.", "Test Elev"], ["4"], [], []],
                [["2."], ["1"], [], []],
                [["3.", "Test Elev"], ["0"], [], []],
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
        for user in (self.teacher, self.student):
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
        self.group_testresponse_1.flagged = False
        self.group_testresponse_1.save()
        view = self.request(
            self.teacher, "post", self.group_testresponse_1.pk, {"flagged": "true"}
        )
        self.group_testresponse_1.refresh_from_db()
        self.assertTrue(self.group_testresponse_1.flagged)
        self.assertEqual(json.loads(view.response.content), {"flagged": True})

    def test_set_false(self):
        self.group_testresponse_1.flagged = True
        self.group_testresponse_1.save()
        view = self.request(
            self.teacher, "post", self.group_testresponse_1.pk, {"flagged": "false"}
        )
        self.group_testresponse_1.refresh_from_db()
        self.assertFalse(self.group_testresponse_1.flagged)
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
        self.assertEqual(view.get_ordering(), ["rank"])

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
            query_params={"sort": "-student"},
        )
        self.assertEqual(view.get_ordering(), ["-rank"])

        view = self.setup_view(
            AssignmentResultsView,
            self.teacher,
            pk=self.test_assignment_class.pk,
        )
        self.assertEqual(view.get_ordering(), ["rank"])

    def test_access(self):
        self.assertEqual(
            self.request(
                self.teacher, "get", self.group_testresponse_1.pk
            ).response.status_code,
            200,
        )
        self.assertEqual(
            self.request(
                self.teacher, "post", self.group_testresponse_1.pk, {"flagged": "true"}
            ).response.status_code,
            200,
        )
        for user in (
            self.student,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
        ):
            with self.assertRaises(PermissionDenied, msg=user.username):
                self.request(user, "get", self.group_testresponse_1.pk)

            with self.assertRaises(PermissionDenied):
                self.request(
                    user, "post", self.group_testresponse_1.pk, {"flagged": "true"}
                )


class TestAssignmentPartResultsView(ResponseTest):

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
        self.assertEqual(answer1.correct_count, 1)
        self.assertEqual(answer1.correct_proportion, 0.25)
        self.assertEqual(answer1.correct_percentage, 25)

        self.assertEqual(answer2.responses_count, 4)
        self.assertEqual(answer2.correct_count, 4)
        self.assertEqual(answer2.correct_proportion, 1.0)
        self.assertEqual(answer2.correct_percentage, 100)

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
                    ["Rigtighedsprocent"],
                    ["Normscore (0-100)"],
                ],
                [["2."], ["4"], ["1"], ["25%"], ["25"]],
                [["1. Test Elev"], ["4"], ["4"], ["100%"], ["100"]],
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
            self.student,
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
        cls.create_individual_wordspelling_part()

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_table(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            response_pk=self.group_testresponse_1.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_key = f"part_{self.group_test_part.pk}"
        self.assertEqual(
            table.data.data,
            [
                {"data_category": "Antal forsøgte", part_key: 4},
                {"data_category": "Antal rigtige", part_key: 4},
                {"data_category": "Rigtighedsprocent", part_key: "100 %"},
                {"data_category": "Normscore", part_key: "100 %"},
            ],
        )
        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            ["Bedømmelse", "Over middel;Se elevens svar", "", ""],
        )

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_only_table(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            query_params={"only_table": "true"},
            assignment_pk=self.test_assignment_class.pk,
            response_pk=self.group_testresponse_1.pk,
        )
        response = view.response
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [[], ["GroupTestPart1 (4 opg.)"], [], []],
                [],
                [["Antal forsøgte"], ["4"], [], []],
                [["Antal rigtige"], ["4"], [], []],
                [["Rigtighedsprocent"], ["100 %"], [], []],
                [["Normscore"], ["100 %"], [], []],
                [["Bedømmelse"], ["Over middel", "Se elevens svar"], [], []],
            ],
        )

    def test_access(self):
        self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            response_pk=self.group_testresponse_1.pk,
        )
        for user in (
            self.student,
            self.other_user,
            self.other_teacher,
            self.inactive_user,
            self.not_logged_in_user,
        ):
            with self.assertRaises(PermissionDenied):
                self.setup_view(
                    TestResponseView,
                    user,
                    assignment_pk=self.test_assignment_class.pk,
                    response_pk=self.group_testresponse_1.pk,
                )

    @override_settings(RESULT_TABLE_SIZE=3)
    def test_table_individual(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_student.pk,
            response_pk=self.test_response_student.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_key = f"part_{self.part.pk}"
        self.assertEqual(
            table.data.data,
            [
                {"data_category": "Antal forsøgte", part_key: 2},
                {"data_category": "Antal oversprungne", part_key: 1},
                {"data_category": "Antal rigtige", part_key: 1},
                {"data_category": "Rigtighedsprocent", part_key: "50 %"},
                {"data_category": "Normscore", part_key: "16 %"},
            ],
        )
        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            ["Bedømmelse", "Middel;Se elevens svar", "", ""],
        )


class TestPartResponseView(ResponseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.create_group_sentencereading_part()

    def test_get_object(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.group_testresponse_1.pk,
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
            testresponse_pk=self.group_testresponse_2.pk,
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
                testresponse_pk=self.group_testresponse_1.pk,
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
            testresponse_pk=self.group_testresponse_1.pk,
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
            testresponse_pk=self.group_testresponse_1.pk,
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

    def test_answer_time_table(self):
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
            testresponse_pk=self.group_testresponse_1.pk,
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

    def test_no_tables(self):
        part: TestPart = self.group_test_part
        part.wordlength_data_breakdown.clear()
        part.wordcount_data_breakdown.clear()
        part.answer_time_data_breakdown.clear()
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.group_testresponse_1.pk,
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
            testresponse_pk=self.group_testresponse_1.pk,
            testpart_pk=self.sentencereading_part.pk,
        )
        context = view.get_context_data()
        table = context["responses_table"]
        self.assertNotIn("challenge_sentence", table.exclude)

    def test_access(self):
        self.setup_view(
            PartResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.group_testresponse_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        for user in (
            self.student,
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
                    testresponse_pk=self.group_testresponse_1.pk,
                    testpart_pk=self.group_test_part.pk,
                )

    def test_only_table(self):
        view = self.setup_view(
            PartResponseView,
            self.teacher,
            query_params={"only_table": "true"},
            assignment_pk=self.test_assignment_class.pk,
            testresponse_pk=self.group_testresponse_1.pk,
            testpart_pk=self.group_test_part.pk,
        )
        response = view.response
        soup = BeautifulSoup(response.content, "html.parser")
        table = self.html_table_to_list(soup.find("table"))
        self.assertEqual(
            table,
            [
                [["Opg."], ["Billede"], ["Rigtigt svar"], ["Elevens svar"], ["Tid"]],
                [["1"], [], [], [], ["—"]],
                [["2"], [], ["TestOrd"], [], ["—"]],
                [["3"], [], [], [], ["—"]],
                [["4"], [], [], [], ["—"]],
                [[], [], [], [], ["0 sek."]],
            ],
        )
        container = soup.find("table").parent
        self.assertEqual(container.attrs["class"], ["table-container"])
