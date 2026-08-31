# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from audit.admin import ItemViewAdmin, ItemViewInline, LoginAttemptAdmin, PageViewAdmin
from audit.models import ItemView, LoginAttempt, LoginResult, PageView
from django.contrib.admin.sites import AdminSite
from django.test import TestCase
from django.urls import reverse

from dysleksi.models import User
from dysleksi.tests.base import DysleksiTest


class AuditAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.admin = User.objects.create(
            username="admin", is_staff=True, is_superuser=True
        )
        cls.teacher = User.objects.create(username="teacher")
        cls.attempt = LoginAttempt.objects.create(
            user=cls.admin, username="admin", result=LoginResult.SUCCESS
        )
        cls.pageview = PageView.objects.create(
            user=cls.admin,
            username="admin",
            url="/admin/students/1/",
            class_name="StudentDetailView",
        )
        cls.itemview = ItemView.objects.create(
            pageview=cls.pageview, item=cls.teacher, item_label=str(cls.teacher)
        )

    def get_model_admin(self, admin_class, model):
        return admin_class(model=model, admin_site=AdminSite())

    def test_audit_log_is_read_only(self):
        for admin_class, model in (
            (LoginAttemptAdmin, LoginAttempt),
            (PageViewAdmin, PageView),
            (ItemViewAdmin, ItemView),
        ):
            model_admin = self.get_model_admin(admin_class, model)
            self.assertFalse(model_admin.has_add_permission(None))
            self.assertFalse(model_admin.has_change_permission(None))
            self.assertFalse(model_admin.has_delete_permission(None))

        inline = ItemViewInline(parent_model=PageView, admin_site=AdminSite())
        self.assertFalse(inline.has_add_permission(None))
        self.assertFalse(inline.can_delete)

    def test_login_attempt_display_columns(self):
        model_admin = self.get_model_admin(LoginAttemptAdmin, LoginAttempt)
        self.assertEqual(model_admin.user_id(self.attempt), self.admin.pk)

    def test_pageview_display_columns(self):
        model_admin = self.get_model_admin(PageViewAdmin, PageView)
        self.assertEqual(model_admin.user_id(self.pageview), self.admin.pk)
        self.assertEqual(model_admin.items_accessed(self.pageview), str(self.teacher))

    def test_itemview_display_columns(self):
        model_admin = self.get_model_admin(ItemViewAdmin, ItemView)
        self.assertEqual(model_admin.timestamp(self.itemview), self.pageview.timestamp)
        self.assertEqual(model_admin.username(self.itemview), "admin")

    def test_admin_can_read_the_log(self):
        self.client.force_login(self.admin)
        for url in (
            "admin:audit_loginattempt_changelist",
            "admin:audit_pageview_changelist",
            "admin:audit_itemview_changelist",
        ):
            response = self.client.get(reverse(url))
            self.assertEqual(response.status_code, 200)

    def test_non_admin_cannot_read_the_log(self):
        self.client.force_login(self.teacher)
        response = self.client.get(reverse("admin:audit_pageview_changelist"))
        # Non-staff users are redirected to the admin login page
        self.assertEqual(response.status_code, 302)


class HistoryAdminTest(DysleksiTest):
    """Checks that the change history of the audited models can be looked up in
    the admin."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.admin.is_staff = True
        cls.admin.save()
        cls.create_parts()

    def setUp(self):
        super().setUp()
        self.client.force_login(self.admin)

    def test_history_page_is_available(self):
        for model, obj in (
            ("student", self.student1),
            ("teacher", self.teacher),
            ("class", self.klasse),
            ("test", self.individual_test),
            ("testpart", self.part),
            ("testquestion", self.question1),
            ("testresource", self.resource1),
            ("possibleanswer", self.possible_correct_answer1),
            ("testassignment", self.test_assignment_student),
        ):
            with self.subTest(model=model):
                url = reverse(f"admin:dysleksi_{model}_history", args=[obj.pk])
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_history_lists_the_change(self):
        self.individual_test.name = "Omdøbt test"
        self.individual_test._history_user = self.admin
        self.individual_test.save()

        response = self.client.get(
            reverse("admin:dysleksi_test_history", args=[self.individual_test.pk])
        )
        # Who made the change, and what the change was
        self.assertContains(response, str(self.admin))
        self.assertContains(response, "Omdøbt test")
