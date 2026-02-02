# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import AnonymousUser
from django.urls import reverse
from django.views import View

from dysleksi.models import Student, Test, TestAssignment, TestType, User
from dysleksi.tests.base import DysleksiTest
from dysleksi.views import (
    ClassListView,
    RoomView,
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


class TestRoomView(DysleksiTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.test = Test.objects.create(name="Middle 2. grade")
        cls.test2 = Test.objects.create(name="Individual dummy test")

    def test_get_template_names(self):
        cases: list[tuple[User, str | None]] = [
            (self.teacher, "dysleksi/screening/individual/teacher.html", "student_123"),
            (self.student, "dysleksi/screening/individual/student.html", "student_123"),
            (self.teacher, "dysleksi/screening/group/teacher.html", "class_123"),
            (self.student, "dysleksi/screening/group/student.html", "class_123"),
        ]
        for user, template_name, room_name in cases:
            with self.subTest(user=user, template_name=template_name):
                view = self.setup_view(
                    RoomView, user, room_name=room_name, test_id=self.test.id
                )
                self.assertListEqual(view.get_template_names(), [template_name])

    def test_context_data(self):
        view = self.setup_view(
            RoomView, self.teacher, room_name="class_1", test_id=self.test.id
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

        self.assertEqual(response.status_code, 302)

        expected_url = reverse(
            "dysleksi:room",
            kwargs={
                "room_name": f"student_{self.student.pk}",
                "test_id": self.test.pk,
            },
        )

        self.assertRedirects(response, expected_url)

    def test_create_group_room(self):
        data = {"klasse": self.klasse.id, "test": self.group_test.id}

        self.client.force_login(self.teacher)
        response = self.client.post(reverse("dysleksi:start_group_room"), data=data)

        self.assertEqual(response.status_code, 302)

        expected_url = reverse(
            "dysleksi:room",
            kwargs={
                "room_name": f"class_{self.klasse.pk}",
                "test_id": self.group_test.pk,
            },
        )

        self.assertRedirects(response, expected_url)
