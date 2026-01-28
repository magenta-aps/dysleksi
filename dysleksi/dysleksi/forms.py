from typing import cast

from django import forms
from django.forms import ModelChoiceField
from django.utils.translation import gettext_lazy as _

from dysleksi.models import Class, Student, Test, TestType


class StartRoomForm(forms.Form):
    test: ModelChoiceField = forms.ModelChoiceField(
        queryset=Test.objects.all(),
        label=_("Test"),
        empty_label=_("Vælg test"),
        widget=forms.Select(attrs={"class": "form-select"}),
    )


class StartIndividualRoomForm(StartRoomForm):
    student: ModelChoiceField = forms.ModelChoiceField(
        queryset=Student.objects.none(),
        label="Elev",
        empty_label=_("Vælg elev"),
        widget=forms.Select(attrs={"class": "form-select"}),
    )

    def __init__(self, *args, teacher, **kwargs):
        super().__init__(*args, **kwargs)

        student_field = cast(ModelChoiceField, self.fields["student"])
        student_field.queryset = (
            Student.objects.filter(klasse__in=teacher.classes.all())
            .select_related("klasse")
            .order_by("first_name")
        )

        student_field.label_from_instance = (
            lambda s: f"{s.first_name} {s.last_name} ({s.klasse.name})"
        )

        test_field = cast(ModelChoiceField, self.fields["test"])
        test_field.queryset = Test.objects.filter(test_type=TestType.INDIVIDUAL)

    def get_room_name(self) -> str:
        student: Student = self.cleaned_data["student"]
        return f"student_{student.pk}"


class StartClassRoomForm(StartRoomForm):
    klasse: ModelChoiceField = forms.ModelChoiceField(
        queryset=Class.objects.none(),
        label=_("Klasse"),
        empty_label=_("Vælg klasse"),
        widget=forms.Select(attrs={"class": "form-select"}),
    )

    def __init__(self, *args, teacher, **kwargs):
        super().__init__(*args, **kwargs)

        klasse_field = cast(ModelChoiceField, self.fields["klasse"])
        klasse_field.queryset = teacher.classes.all().order_by("start_year", "letter")

        test_field = cast(ModelChoiceField, self.fields["test"])
        test_field.queryset = Test.objects.filter(test_type=TestType.GROUP)

    def get_room_name(self) -> str:
        klasse: Class = self.cleaned_data["klasse"]
        return f"class_{klasse.pk}"
