# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.utils.translation import gettext_lazy as _

from dysleksi.forms import StartRoomForm, StudentChoiceField
from dysleksi.models import Student
from dysleksi.tests.base import DysleksiTest


class TestStudentChoiceField(DysleksiTest):
    def setUp(self):
        super().setUp()
        self.instance = StudentChoiceField(Student.objects.none())

    def test_label_from_instance_includes_main_class_name(self):
        self.assertEqual(
            self.instance.label_from_instance(self.student1),
            "Test1 Elev (1.A)",
        )


class TestStartRoomForm(DysleksiTest):
    def test_clean_start_datetime(self):
        instance = StartRoomForm(
            self.teacher,
            data={
                "start_datetime": "2025-01-01T00:00:00",
                "end_datetime": "2030-01-01T00:00:00",
                **self.base_form_data,
            },
        )
        self.assertFormError(
            instance, "start_datetime", _("Startdato kan ikke være i fortiden")
        )

    def test_clean_end_datetime(self):
        instance = StartRoomForm(
            self.teacher,
            data={
                "start_datetime": "2030-01-01T00:00:00",
                "end_datetime": "2025-01-01T00:00:00",
                **self.base_form_data,
            },
        )
        self.assertFormError(
            instance, "end_datetime", _("Slutdato kan ikke være i fortiden")
        )

    def test_clean_non_field_errors(self):
        instance = StartRoomForm(
            self.teacher,
            data={
                "start_datetime": "2030-02-01T00:00:00",
                "end_datetime": "2030-01-01T00:00:00",
                **self.base_form_data,
            },
        )
        self.assertFormError(instance, None, _("Slutdato kan ikke være før startdato"))

    @property
    def base_form_data(self):
        return {
            "test": self.group_test,
            "is_test_part": "test",
            "is_immediate": "n",
        }
