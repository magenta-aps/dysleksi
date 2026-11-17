# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.utils.translation import gettext_lazy as _

from dysleksi.forms import (
    ClassStudentFormSet,
    ConsentForm,
    StartRoomForm,
    StudentChoiceField,
)
from dysleksi.models import Class, ConsentResponse, Student
from dysleksi.tests.base import ConsentTest, DysleksiTest


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

    def test_hide_end_datetime_is_false_if_not_has_end(self):
        data = {
            "student": self.student1.pk,
            "student_test": self.individual_test,
            "start_datetime": "2030-01-01T00:00:00",
            "end_datetime": "",
            **self.base_form_data,
        }
        data["has_end"] = "y"
        instance = StartRoomForm(self.teacher, data=data)
        self.assertFalse(instance.hide_end_datetime)

    @property
    def base_form_data(self):
        return {
            "test_type": "group",
            "klasse": self.klasse.pk,
            "class_test": self.group_test,
            "is_test_part": "test",
            "is_immediate": "n",
            "has_end": "n",
        }


class TestClassStudentFormSet(DysleksiTest):
    def test_requires_at_least_one_student(self):
        instance = ClassStudentFormSet(
            data={
                "form-TOTAL_FORMS": "1",
                "form-INITIAL_FORMS": "1",
                "form-MIN_NUM_FORMS": "0",
                "form-MAX_NUM_FORMS": "1000",
                "form-0-id": self.klasse.pk,
                "form-0-students": [],  # No students selected
            },
            queryset=Class.objects.filter(pk=self.klasse.pk),
        )
        self.assertFormSetError(
            instance, 0, "students", _("Vælg venligst mindst én elev")
        )


class TestConsentForm(ConsentTest):
    def get_form(self, **data):
        form = ConsentForm(
            consent_request=self.consent_request,
            given_by=self.parent_or_guardian,
            data=data,
        )
        form.full_clean()
        return form

    def test_init(self):
        form = self.get_form()
        self.assertEqual(form.consent_request, self.consent_request)
        self.assertEqual(form.given_by, self.parent_or_guardian)

    def test_save(self):
        for accepted in (False, True):
            with self.subTest(accepted=accepted):
                form = self.get_form(confirm=accepted)
                obj = form.save()
                self.assertIsInstance(obj, ConsentResponse)
                self.assertEqual(obj.given_by, self.parent_or_guardian)
                self.assertEqual(obj.accepted, accepted)

    def test_dynamic_label(self):
        form = self.get_form()
        field = form.fields["confirm"]
        self.assertEqual(
            field.label,
            "Jeg afgiver mit samtykke til at Test Person (CPR 0222222226) må tage "
            "ordblindetest",
        )
