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
        self.assertFormError(
            instance, "end_datetime", _("Slutdato kan ikke være før startdato")
        )

    def test_clean_removes_student_fields_on_group_assignment(self):
        data = {
            "student": self.student1.pk,
            "student_test": self.individual_test,
            "start_datetime": "2030-01-01T00:00:00",
            "end_datetime": "",
            **self.base_form_data,
        }
        instance = StartRoomForm(self.teacher, data=data)
        instance.is_valid()
        self.assertIsNone(instance.cleaned_data["student"])
        self.assertIsNone(instance.cleaned_data["student_test"])
        self.assertIsNone(instance.cleaned_data["student_test_parts"])

    def test_clean_removes_class_fields_on_individual_assignment(self):
        data = {
            "student": self.student1.pk,
            "student_test": self.individual_test,
            "start_datetime": "2030-01-01T00:00:00",
            "end_datetime": "",
            **self.base_form_data,
        }
        data["test_type"] = "individual"
        instance = StartRoomForm(self.teacher, data=data)
        instance.is_valid()
        self.assertIsNone(instance.cleaned_data["klasse"])
        self.assertIsNone(instance.cleaned_data["class_test"])
        self.assertIsNone(instance.cleaned_data["class_test_parts"])

    @property
    def base_form_data(self):
        return {
            "test_type": "group",
            "klasse": self.klasse.pk,
            "class_test": self.group_test,
            "is_test_part": "test",
            "is_immediate": "n",
        }
