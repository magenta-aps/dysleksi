from django import forms
from django.forms import ModelChoiceField
from django.utils.translation import gettext_lazy as _
from dynamic_forms import DynamicField, DynamicFormMixin

from dysleksi.models import Student, Test, TestAssignment, TestType


class StartRoomForm(forms.ModelForm):

    class Meta:
        fields = ("test",)
        model = TestAssignment

    def __init__(self, teacher, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.teacher = self.instance.teacher = teacher


class StudentChoiceField(ModelChoiceField):
    def label_from_instance(self, obj: Student) -> str:
        return f"{obj.first_name} {obj.last_name} ({obj.klasse})"


class StartIndividualRoomForm(DynamicFormMixin, StartRoomForm):

    class Meta:
        model = StartRoomForm.Meta.model
        fields = StartRoomForm.Meta.fields + ("student",)

    student = DynamicField(
        StudentChoiceField,
        label=_("Vælg elev"),
        queryset=lambda form: Student.objects.filter(
            klasse__in=form.teacher.classes.all()
        )
        .select_related("klasse")
        .order_by("first_name"),
    )

    test = DynamicField(
        ModelChoiceField,
        label=_("Vælg test"),
        queryset=Test.objects.filter(test_type=TestType.INDIVIDUAL),
    )


class StartClassRoomForm(DynamicFormMixin, StartRoomForm):

    class Meta:
        model = StartRoomForm.Meta.model
        fields = StartRoomForm.Meta.fields + ("klasse",)

    klasse = DynamicField(
        ModelChoiceField,
        label=_("Vælg klasse"),
        queryset=lambda form: form.teacher.classes.all().order_by(
            "start_year", "letter"
        ),
    )

    test = DynamicField(
        ModelChoiceField,
        label=_("Vælg test"),
        queryset=Test.objects.filter(test_type=TestType.GROUP),
    )
