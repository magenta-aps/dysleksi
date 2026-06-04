# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from dysleksi.forms import StudentChoiceField
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
