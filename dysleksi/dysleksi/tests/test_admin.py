# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.contrib.admin.sites import AdminSite

from dysleksi.admin import InstructionAdmin, InstructionSequenceAdmin
from dysleksi.models import Instruction, InstructionSequence
from dysleksi.tests.base import DysleksiTest


class InstructionDysleksiTest(DysleksiTest):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.seq, _ = InstructionSequence.objects.get_or_create(question=cls.question1)
        cls.obj, _ = Instruction.objects.get_or_create(
            sequence=cls.seq,
            order=1,
            action="Action",
            delay_after=1000,
            resource=cls.resource1,
            element="Element",
            data="Data",
        )
        cls.empty_obj, _ = Instruction.objects.get_or_create(
            sequence=cls.seq,
            order=2,
        )

    @classmethod
    def get_model_admin(cls):
        return cls.model_admin(model=cls.model, admin_site=AdminSite())


class TestInstructionSequenceAdmin(InstructionDysleksiTest):
    model = InstructionSequence
    model_admin = InstructionSequenceAdmin

    def test_instruction_count_display(self):
        self.assertEqual(self.get_model_admin().instruction_count(self.seq), 2)

    def test_export_json(self):
        response = self.get_model_admin().export_json(
            None, InstructionSequence.objects.all()
        )
        self.assertJSONEqual(
            response.content,
            [
                {
                    "instruction_sequence": [
                        {
                            "action": "Action",
                            "delayAfter": 1000,
                            "resource": self.resource1.name,
                            "element": "Element",
                            "data": "Data",
                        },
                        {
                            "action": "",
                        },
                    ],
                    "part_name": self.seq.question.part.name,
                    "pk": self.seq.pk,
                }
            ],
        )


class TestInstructionAdmin(InstructionDysleksiTest):
    model = Instruction
    model_admin = InstructionAdmin

    def test_part_display(self):
        self.assertEqual(
            self.get_model_admin().part(self.obj), self.question1.part.name
        )

    def test_on_display(self):
        self.assertEqual(self.get_model_admin().on(self.obj), self.resource1.name)

    def test_sound_display_present(self):
        self.obj.resource = self.resource4  # has sound
        self.assertEqual(
            self.get_model_admin().sound(self.obj),
            f"<audio controls src='/media/{self.resource4.sound}' "
            "style='height: 1.5rem'>",
        )

    def test_sound_display_not_present(self):
        self.assertEqual(self.get_model_admin().sound(self.obj), "")
