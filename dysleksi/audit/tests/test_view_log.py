# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from audit.models import ItemView, PageView
from audit.view_mixins import ViewLogMixin
from django.test import RequestFactory
from django.urls import reverse

from dysleksi.tests.base import DysleksiTest, ResponseTest


class ViewLogTest(ResponseTest):
    """Checks that access to sensitive personal data is recorded."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.create_parts()

    def setUp(self):
        super().setUp()
        self.client.force_login(self.teacher)
        # Ignore the `PageView` rows written while logging in
        PageView.objects.all().delete()

    def assert_logged(self, class_name: str, items: list):
        pageview = PageView.objects.get(class_name=class_name)
        self.assertEqual(pageview.user, self.teacher.user_ptr)
        self.assertEqual(pageview.username, self.teacher.username)
        self.assertIsNotNone(pageview.timestamp)
        self.assertCountEqual(
            [(item.object_id, item.item_label) for item in pageview.items.all()],
            [(item.pk, str(item)) for item in items],
        )

    def test_student_detail_is_logged(self):
        self.client.get(
            reverse("dysleksi:student_detail", kwargs={"pk": self.student1.pk})
        )
        self.assert_logged("StudentDetailView", [self.student1])

    def test_student_list_is_logged(self):
        self.client.get(reverse("dysleksi:student_list"))
        self.assert_logged("StudentListView", [self.student1, self.student2])

    def test_class_detail_logs_class_and_students(self):
        self.client.get(reverse("dysleksi:class_detail", kwargs={"pk": self.klasse.pk}))
        self.assert_logged(
            "ClassDetailView", [self.klasse, self.student1, self.student2]
        )

    def test_test_response_is_logged(self):
        self.client.get(
            reverse(
                "dysleksi:test_assignment_student_results",
                kwargs={
                    "assignment_pk": self.test_assignment_class.pk,
                    "response_pk": self.test_response_class_1.pk,
                },
            )
        )
        self.assert_logged("TestResponseView", [self.test_response_class_1])

    def test_assignment_results_logs_all_responses(self):
        self.client.get(
            reverse(
                "dysleksi:test_assignment_results",
                kwargs={"pk": self.test_assignment_class.pk},
            )
        )
        self.assert_logged(
            "AssignmentResultsView",
            [
                self.test_assignment_class,
                self.test_response_class_1,
                self.test_response_class_2,
            ],
        )

    def test_part_response_is_logged(self):
        self.client.get(
            reverse(
                "dysleksi:test_assignment_part_result",
                kwargs={
                    "assignment_pk": self.test_assignment_class.pk,
                    "testpart_pk": self.group_test_part.pk,
                    "testresponse_pk": self.test_response_class_1.pk,
                },
            )
        )
        self.assert_logged("PartResponseView", [self.group_partresponse_1])

    def test_pageview_records_url_and_params(self):
        self.client.get(
            reverse("dysleksi:student_detail", kwargs={"pk": self.student1.pk}),
            {"foo": "bar"},
        )
        pageview = PageView.objects.get(class_name="StudentDetailView")
        self.assertEqual(pageview.kwargs, {"pk": self.student1.pk})
        self.assertEqual(pageview.params, {"foo": "bar"})
        self.assertIn(str(self.student1.pk), pageview.url)

    def test_item_label_survives_deletion(self):
        label = str(self.student2)
        self.client.get(
            reverse("dysleksi:student_detail", kwargs={"pk": self.student2.pk})
        )
        self.student2.delete()

        itemview = ItemView.objects.get(item_label=label)
        self.assertIsNone(itemview.item)
        self.assertEqual(itemview.item_label, label)
        self.assertIn(label, str(itemview))

    def test_pageview_str(self):
        self.client.get(
            reverse("dysleksi:student_detail", kwargs={"pk": self.student1.pk})
        )
        pageview = PageView.objects.get(class_name="StudentDetailView")
        self.assertIn(self.teacher.username, str(pageview))
        self.assertIn(pageview.url, str(pageview))


class LogViewWithoutItemsTest(DysleksiTest):
    """A view can log that a page was accessed without naming any objects."""

    def test_log_view_without_items(self):
        view = ViewLogMixin()
        view.request = RequestFactory().get("/some/page/")
        view.request.user = self.teacher
        view.kwargs = {}

        pageview = view.log_view()

        self.assertEqual(pageview.username, self.teacher.username)
        self.assertEqual(pageview.items.count(), 0)
