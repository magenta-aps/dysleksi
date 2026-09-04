from django import forms
from django.db.models import Prefetch
from django.forms import (
    ModelChoiceField,
    ModelMultipleChoiceField,
    ValidationError,
    widgets,
)
from django.utils import timezone
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


class TestSelect(forms.Select):
    """`Select` widget which adds the names of the test parts of each test to a
    `data-parts` attribute on the corresponding `<option>` element. This allows the
    teacher UI to show which test parts a given test consists of.
    """

    def create_option(self, name, value, *args, **kwargs):
        option = super().create_option(name, value, *args, **kwargs)
        if value:
            option["attrs"]["data-parts"] = ", ".join(
                part.name for part in value.instance.parts.all()
            )
        return option


class StudentChoiceField(ModelChoiceField):
    def label_from_instance(self, obj: Student) -> str:
        # Join all student "main" class names (only one "main" class is expected for
        # each student.)
        main_class_name = ", ".join(
            obj.classes.filter(is_main=True).values_list("name", flat=True)
        )
        return f"{obj.first_name} {obj.last_name} ({main_class_name})"


def tests_of_type(test_type: TestType):
    return Test.objects.filter(test_type=test_type, custom=False).prefetch_related(
        Prefetch("parts", queryset=TestPart.objects.order_by("id"))
    )


class StartRoomForm(DynamicFormMixin, forms.ModelForm):
    class Meta:
        model = TestAssignment
        exclude = ("teacher", "test")

    name = forms.CharField(
        initial=_("Ny test til målgruppen"),
        required=False,
        widget=forms.TextInput(
            attrs={
                "class": "inline-field",
                "placeholder": _("Ny test til målgruppen"),
            }
        ),
    )

    test_type = forms.ChoiceField(
        initial="group",
        required=True,
        choices=[
            (TestType.GROUP, _("Gruppetest")),
            (TestType.INDIVIDUAL, _("Individuel test")),
        ],
        label=_("Vælg testtype"),
        widget=forms.RadioSelect(),
    )

    klasse = DynamicField(
        ModelChoiceField,
        required=lambda form: form.data.get("test_type") == TestType.GROUP,
        queryset=lambda form: form.teacher.accessible_classes.order_by("name"),
        label=_("Vælg klasse"),
    )

    student = DynamicField(
        StudentChoiceField,
        required=lambda form: form.data.get("test_type") == TestType.INDIVIDUAL,
        queryset=lambda form: Student.objects.filter(
            classes__in=form.teacher.accessible_classes,
        )
        .distinct()
        .prefetch_related("classes")
        .order_by("first_name"),
        label=_("Vælg elev"),
    )

    is_test_part = forms.ChoiceField(
        initial="test",
        required=True,
        choices=[("test", _("Test")), ("part", _("Deltest"))],
        label=_("Vælg testsammensætning"),
        widget=forms.RadioSelect(),
    )

    class_test = DynamicField(
        ModelChoiceField,
        required=lambda form: (
            form.data.get("test_type") == TestType.GROUP
            and form.data.get("is_test_part") == "test"
            and form.data.get("klasse") is not None
        ),
        queryset=tests_of_type(TestType.GROUP),
        label=_("Vælg test"),
        widget=TestSelect(),
    )

    class_test_parts = DynamicField(
        ModelMultipleChoiceField,
        required=lambda form: (
            form.data.get("test_type") == TestType.GROUP
            and form.data.get("is_test_part") == "part"
            and form.data.get("klasse") is not None
        ),
        queryset=TestPart.objects.filter(tests__test_type=TestType.GROUP).distinct(),
        label=_("Vælg deltests"),
        widget=forms.CheckboxSelectMultiple(),
    )

    student_test = DynamicField(
        ModelChoiceField,
        required=lambda form: (
            form.data.get("test_type") == TestType.INDIVIDUAL
            and form.data.get("is_test_part") == "test"
            and form.data.get("student") is not None
        ),
        queryset=tests_of_type(TestType.INDIVIDUAL),
        label=_("Vælg test"),
        widget=TestSelect(),
    )

    student_test_parts = DynamicField(
        ModelMultipleChoiceField,
        required=lambda form: (
            form.data.get("test_type") == TestType.INDIVIDUAL
            and form.data.get("is_test_part") == "part"
            and form.data.get("student") is not None
        ),
        queryset=TestPart.objects.filter(
            tests__test_type=TestType.INDIVIDUAL
        ).distinct(),
        label=_("Vælg deltests"),
        widget=forms.CheckboxSelectMultiple(),
    )

    is_immediate = forms.BooleanField(
        initial="y",
        required=True,
        label=_("Vælg tidsrummet for testen"),
        widget=forms.RadioSelect(choices=[("y", _("Start nu")), ("n", _("Planlæg"))]),
    )

    start_datetime = DynamicField(
        forms.DateTimeField,
        required=lambda form: form.data.get("is_immediate") == "n",
        label=_("Start"),
        widget=HTML5DateWidget(),
    )

    end_datetime = DynamicField(
        forms.DateTimeField,
        required=False,
        label=_("Slut"),
        widget=HTML5DateWidget(),
    )

    def __init__(self, teacher, *args, **kwargs):
        self.teacher = teacher
        super().__init__(*args, **kwargs)
        self.instance.teacher = teacher
        self.period = (
            self.instance.planned_date_time.period
            if self.instance.planned_date_time
            else (None, None)
        )

    def clean_test_type(self):
        return TestType(self.cleaned_data["test_type"])

    def clean_start_datetime(self):
        start_datetime = self.cleaned_data["start_datetime"]
        if start_datetime is not None and start_datetime < timezone.now():
            raise ValidationError(_("Startdato kan ikke være i fortiden"))
        self.period = (start_datetime, self.period[1])
        return start_datetime

    def clean_end_datetime(self):
        start_datetime = self.cleaned_data.get("start_datetime")
        end_datetime = self.cleaned_data["end_datetime"]
        if end_datetime is not None and end_datetime < timezone.now():
            raise ValidationError(_("Slutdato kan ikke være i fortiden"))
        if (
            start_datetime is not None
            and end_datetime is not None
            and (end_datetime <= start_datetime)
        ):
            raise ValidationError(_("Slutdato kan ikke være før startdato"))
        self.period = (self.period[0], end_datetime)
        return end_datetime

    def clean(self):
        cleaned_data = super().clean()
        # Populate keys used by `StartAssignmentView` and the Django `CreateView`
        cleaned_data["test"] = self._get_test(cleaned_data)
        cleaned_data["test_parts"] = self._get_test_parts(cleaned_data)
        # If `test_type` is `TestType.GROUP`, clear any `student`-related fields (and
        # vice versa.)
        if cleaned_data["test_type"] == TestType.GROUP:
            cleaned_data["student"] = None
            cleaned_data["student_test"] = None
            cleaned_data["student_test_parts"] = None
        elif cleaned_data["test_type"] == TestType.INDIVIDUAL:
            cleaned_data["klasse"] = None
            cleaned_data["class_test"] = None
            cleaned_data["class_test_parts"] = None
        else:
            pass  # pragma: no cover

    def save(self, commit=True):
        if self.period is None or self.cleaned_data["start_datetime"] is None:
            # No planned date time was given, so ensure the field is cleared
            self.instance.planned_date_time = None
        else:
            # Create new planned date time
            self.instance.planned_date_time = PlannedDateTime.objects.create(
                period=self.period,
            )

        if self.cleaned_data["test"] is not None:
            self.instance.test = self.cleaned_data["test"]

        return super().save(commit=commit)

    @property
    def is_group(self):
        return self.data.get("test_type") in (None, TestType.GROUP)

    @property
    def is_test(self):
        return self.data.get("is_test_part") in (None, "test")

    @property
    def hide_start_datetime(self) -> bool:
        return self.data.get("is_immediate") in (None, "y")

    @property
    def hide_end_datetime(self) -> bool:
        return self.data.get("end_datetime") in (None, "")

    def _get_test(self, cleaned_data):
        if cleaned_data["is_test_part"] == "test":
            test_type = cleaned_data.get("test_type")
            if (
                test_type == TestType.GROUP
                and cleaned_data.get("klasse")
                and cleaned_data.get("class_test")
            ):
                return cleaned_data["class_test"]
            elif (
                test_type == TestType.INDIVIDUAL
                and cleaned_data.get("student")
                and cleaned_data.get("student_test")
            ):
                return cleaned_data["student_test"]
            else:
                return None  # pragma: no cover
        return None

    def _get_test_parts(self, cleaned_data):
        if cleaned_data["is_test_part"] == "part":
            test_type = cleaned_data.get("test_type")
            if (
                test_type == TestType.GROUP
                and cleaned_data.get("klasse")
                and cleaned_data.get("class_test_parts")
            ):
                return cleaned_data["class_test_parts"]
            elif (
                test_type == TestType.INDIVIDUAL
                and cleaned_data.get("student")
                and cleaned_data.get("student_test_parts")
            ):
                return cleaned_data["student_test_parts"]
            else:
                return None  # pragma: no cover
        return None
