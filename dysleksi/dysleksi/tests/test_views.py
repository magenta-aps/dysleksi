# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.auth.models import AnonymousUser
from django.urls import reverse
from django.views import View

from dysleksi.models import Test, User
from dysleksi.tests.base import DysleksiTest
from dysleksi.views import ClassListView, RoomView, RootView, UserTypeMixin


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
            (self.teacher, "students"),
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
                view = self.setup_view(RoomView, user, room_name=room_name)
                self.assertListEqual(view.get_template_names(), [template_name])

    def test_context_data(self):
        view = self.setup_view(RoomView, self.teacher, room_name="class_1")
        context = view.get_context_data()
        self.assertIn("test_contents", context)


class TestClassListView(DysleksiTest):

    url = reverse("dysleksi:class_list")

    def test_get_template_names(self):
        view = self.setup_view(ClassListView, self.teacher)
        self.assertEqual(view.get_template_names()[0], "dysleksi/class/list.html")

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
