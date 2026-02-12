# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import AnonymousUser
from django.urls import reverse
from django.views import View

from dysleksi.models import Student, Test, TestAssignment, TestType, User
from dysleksi.tests.base import DysleksiTest
from dysleksi.views import (
    AssignmentView,
    ClassListView,
    RootView,
    StudentListView,
    TestAssignmentListView,
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

        cls.test = Test.objects.create(name="Middle 2. grade")
        cls.test2 = Test.objects.create(name="Individual dummy test")

        cls.assignment1 = TestAssignment.objects.create(
            test=cls.test, teacher=cls.teacher, klasse=cls.klasse
        )
        cls.assignment2 = TestAssignment.objects.create(
            test=cls.test, teacher=cls.teacher, student=cls.student
        )

    def test_get_template_names(self):
        cases: list[tuple[User, str | None, TestAssignment]] = [
            (
                self.teacher,
                "dysleksi/screening/teacher.html",
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
                "dysleksi/screening/teacher.html",
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


class TestStudentListView(DysleksiTest):

    url = reverse("dysleksi:student_list")

    def test_get_template_names(self):
        view = self.setup_view(StudentListView, self.teacher)
        self.assertEqual(
            view.get_template_names()[0], "dysleksi/admin/student/list.html"
        )

    def test_teacher_view(self):
        view = self.setup_view(StudentListView, self.teacher)
        expected_objs = Student.objects.filter(klasse__teachers=self.teacher)
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

    def test_group_view_context(self):
        self.client.force_login(self.teacher)
        response = self.client.get(reverse("dysleksi:start_group_room"))

        context_data = response.context

        self.assertEqual(context_data.get("test_type"), TestType.GROUP)

    def test_individual_view_context(self):
        self.client.force_login(self.teacher)
        response = self.client.get(reverse("dysleksi:start_individual_room"))

        context_data = response.context

        self.assertEqual(context_data.get("test_type"), TestType.INDIVIDUAL)

    def test_create_individual_room(self):
        data = {"student": self.student.id, "test": self.test.id}

        self.client.force_login(self.teacher)
        response = self.client.post(
            reverse("dysleksi:start_individual_room"), data=data
        )

        assignment = TestAssignment.objects.order_by("-pk").first()
        self.assertEqual(response.status_code, 302)

        expected_url = reverse(
            "dysleksi:room",
            kwargs={
                "pk": assignment.pk,
            },
        )

        self.assertRedirects(response, expected_url)

    def test_create_group_room(self):
        data = {"klasse": self.klasse.id, "test": self.group_test.id}

        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)

        assignment = TestAssignment.objects.order_by("-pk").first()

        self.assertEqual(response.status_code, 302)

        expected_url = reverse(
            "dysleksi:room",
            kwargs={"pk": assignment.pk},
        )

        self.assertRedirects(response, expected_url)
