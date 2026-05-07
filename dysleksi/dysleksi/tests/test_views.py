# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json

from bs4 import BeautifulSoup
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings
from django.urls import reverse
from django.views import View

from dysleksi.models import (
    CorrectnessCategory,
    Student,
    Test,
    TestAssignment,
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
        cases: list[tuple[User, str | None]] = [
            (self.teacher, None),
            (self.student, "student"),
            (AnonymousUser(), None),
        ]
        for user, context_key in cases:
            with self.subTest(user=user, context_key=context_key):
                view = self.setup_view(RootView, user)
                context_data = view.get_context_data()
                if context_key is not None:
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
                    test_id=self.test.id,
                    pk=assignment.id,
                )
                self.assertListEqual(view.get_template_names(), [template_name])

        with self.assertRaises(ValueError) as cm:
            self.setup_view(
                AssignmentView,
                self.other_user,
                room_name="class_123",
                test_id=self.test.id,
                pk=self.assignment1.id,
            )
            exception = cm.exception
            self.assertEqual(str(exception), "User is neither teacher nor student")

    def test_context_data(self):
        view = self.setup_view(
            AssignmentView,
            self.teacher,
            room_name="class_1",
            test_id=self.test.id,
            pk=self.assignment1.id,
        )
        context = view.get_context_data()
        self.assertIn("test_contents", context)


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
                (1, 0, "Afventer"),  # Individual student test assignment
                (3, 1, "I gang"),  # Group test assignment
            ],
            ordered=False,
            transform=lambda obj: (
                obj.number_of_students,
                obj.number_of_students_responded,
                obj.status,
            ),
        )


class TestStartRoomView(DysleksiTest):

    def test_create_individual_room_immediate(self):
        data = {
            "student": self.student.id,
            "test": self.test.id,
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
            "test": self.test.id,
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
            "test": self.test.id,
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
            "test_parts": [str(self.group_test_part.pk)],
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
        pagination = view.get_pagination(1)
        self.assertTrue(type(pagination) is dict)
        self.assertEqual(pagination["current_page"], 1)
        self.assertEqual(pagination["current_first"], 1)
        self.assertEqual(pagination["current_last"], 1)
        self.assertEqual(pagination["total_count"], 1)
        self.assertEqual(pagination["page_size"], 3)
        self.assertEqual(pagination["last_page"], 1)
        pagination = view.get_pagination(2)
        self.assertEqual(pagination["current_page"], 2)
        self.assertEqual(pagination["current_first"], 1)
        self.assertEqual(pagination["current_last"], 1)
        self.assertEqual(pagination["total_count"], 1)
        self.assertEqual(pagination["page_size"], 3)
        self.assertEqual(pagination["last_page"], 1)


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

    def test_teacher_access(self):
        view = self.request(self.teacher, "get", self.group_testresponse_1.pk)
        self.assertEqual(view.response.status_code, 200)

    def test_student_access(self):
        for student in Student.objects.all():
            view = self.request(student, "get", self.group_testresponse_1.pk)
            self.assertEqual(view.response.status_code, 403)

    def test_admin_access(self):
        view = self.request(self.admin, "get", self.group_testresponse_1.pk)
        self.assertEqual(view.response.status_code, 200)

    def test_other_access(self):
        view = self.request(self.other_user, "get", self.group_testresponse_1.pk)
        self.assertEqual(view.response.status_code, 403)

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


class TestTestResponseView(ResponseTest):
    def test_table(self):
        view = self.setup_view(
            TestResponseView,
            self.teacher,
            assignment_pk=self.test_assignment_class.pk,
            response_pk=self.group_testresponse_1.pk,
        )
        table = view.get_table()
        self.assertTrue(isinstance(table, StudentTestResponseTable))
        part_pk = self.group_test_part.pk
        self.assertEqual(
            table.data.data,
            [
                {"data_category": "Antal forsøgte", f"part_{part_pk}": 4},
                {"data_category": "Antal rigtige", f"part_{part_pk}": 4},
                {"data_category": "Rigtighedsprocent", f"part_{part_pk}": "100 %"},
                {"data_category": "Normscore", f"part_{part_pk}": "100 %"},
            ],
        )
        self.assertEqual(
            [
                BeautifulSoup(str(column.footer), "html.parser").get_text(
                    separator=";", strip=True
                )
                for column in table.columns
            ],
            ["Bedømmelse", "Over middel;Se elevens svar"],
        )
