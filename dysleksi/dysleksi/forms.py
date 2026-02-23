from django import forms
from django.forms import ModelChoiceField, ModelMultipleChoiceField, widgets
from django.utils.translation import gettext_lazy as _
from dynamic_forms import DynamicField, DynamicFormMixin

from dysleksi.models import (
    PlannedDateTime,
    Student,
    Test,
    TestAssignment,
    TestPart,
    TestType,
)


class HTML5DateWidget(widgets.Input):
    input_type = "datetime-local"
    template_name = "django/forms/widgets/datetime.html"


class StartRoomForm(forms.ModelForm):

    class Meta:
        fields = ("test",)
        model = TestAssignment

    is_test_part = forms.BooleanField(
        initial="test",
        label=_("Vælg testtype"),
        widget=forms.RadioSelect(
            choices=[("test", _("Test")), ("part", _("Deltest"))],
            attrs={
                "data-toggle": "test=hide:.test-part-choice show:.test-choice;"
                "part=show:.test-part-choice hide:.test-choice",
            },
        ),
    )

    is_immediate = forms.BooleanField(
        initial="y",
        label=_("Vælg tidsrummet for testen"),
        widget=forms.RadioSelect(
            choices=[("y", _("Start nu")), ("n", _("Planlæg"))],
            attrs={
                "data-toggle": "y=hide:.row.start-datetime,.row.end-datetime;"
                "n=show:.row.start-datetime,div.add-end-button",
            },
        ),
    )

    start_datetime = forms.DateTimeField(
        label=_("Start"),
        required=False,
        widget=HTML5DateWidget(),
    )

    end_datetime = forms.DateTimeField(
        label=_("Slut"),
        required=False,
        widget=HTML5DateWidget(),
    )

    def __init__(self, teacher, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.teacher = self.instance.teacher = teacher
        self.period = (
            self.instance.planned_date_time.period
            if self.instance.planned_date_time
            else (None, None)
        )

    def clean_start_datetime(self):
        start_datetime = self.cleaned_data["start_datetime"]
        self.period = (start_datetime, self.period[1])
        return start_datetime

    def clean_end_datetime(self):
        end_datetime = self.cleaned_data["end_datetime"]
        self.period = (self.period[0], end_datetime)
        return end_datetime

    def save(self, commit=True):
        if self.period is None or self.cleaned_data["start_datetime"] is None:
            # No planned date time was given, so ensure the field is cleared
            self.instance.planned_date_time = None
        else:
            # Create new planned date time
            self.instance.planned_date_time = PlannedDateTime.objects.create(
                period=self.period,
            )

        return super().save(commit=commit)


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
        required=lambda form: form.data.get("test_parts") is None,
    )

    test_parts = DynamicField(
        ModelMultipleChoiceField,
        label=_("Vælg deltests"),
        widget=forms.CheckboxSelectMultiple(),
        queryset=(
            TestPart.objects.filter(tests__test_type=TestType.INDIVIDUAL).distinct()
        ),
        required=lambda form: form.data.get("test") is None,
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
        required=lambda form: form.data.get("test_parts") is None,
    )

    test_parts = DynamicField(
        ModelMultipleChoiceField,
        label=_("Vælg deltests"),
        widget=forms.CheckboxSelectMultiple(),
        queryset=TestPart.objects.filter(tests__test_type=TestType.GROUP).distinct(),
        required=lambda form: form.data.get("test") is None,
    )
