import json

from adminsortable2.admin import SortableAdminBase, SortableTabularInline
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpResponse
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from simple_history.admin import SimpleHistoryAdmin

from dysleksi.models import (
    Class,
    CorrectnessCategory,
    Instruction,
    InstructionSequence,
    Message,
    PartResponse,
    PossibleAnswer,
    QuestionResponse,
    ReadingSpeedCategory,
    Student,
    Teacher,
    Test,
    TestAssignment,
    TestPart,
    TestQuestion,
    TestResource,
    TestResponse,
    User,
)


@admin.register(TestPart)
class TestPartAdmin(SimpleHistoryAdmin):
    pass


@admin.register(Test)
class TestAdmin(SimpleHistoryAdmin):
    pass


@admin.register(TestResource)
class TestResourceAdmin(SimpleHistoryAdmin):
    list_display = ["name", "text", "image", "sound"]
    list_filter = ["testquestion__part"]
    search_fields = ["text"]


class SoundPlayerMixin:
    @admin.display(description="Lyd")
    def sound(self, obj):
        if getattr(obj, "resource", None) and obj.resource.sound:
            return mark_safe(
                f"<audio controls src='/media/{obj.resource.sound}' "
                "style='height: 1.5rem'>"
            )
        return ""


@admin.register(Instruction)
class InstructionAdmin(SoundPlayerMixin, SimpleHistoryAdmin):
    list_display = [
        "id",
        "sequence__id",
        "part",
        "order",
        "action",
        "on",
        "delay_after",
        "sound",
    ]
    list_filter = ["sequence__id", "sequence__question__part__name", "action"]
    list_editable = ["delay_after"]
    list_select_related = ["sequence__question__part", "resource"]
    search_fields = ["resource__name"]
    show_facets = admin.ShowFacets.ALWAYS
    ordering = ["sequence__id", "order"]

    @admin.display(description="Deltest")
    def part(self, obj):
        return obj.sequence.question.part.name

    @admin.display(description="På")
    def on(self, obj):
        return obj.resource.name if obj.resource else (obj.element or obj.data)


class InstructionInlineAdmin(SoundPlayerMixin, SortableTabularInline):
    model = Instruction
    ordering = ["order"]
    extra = 0
    readonly_fields = ["sound"]


@admin.register(InstructionSequence)
class InstructionSequenceAdmin(SortableAdminBase, SimpleHistoryAdmin):
    inlines = [InstructionInlineAdmin]
    list_display = ["id", "question__part__name", "instruction_count"]
    list_filter = ["question__part__name"]
    actions = ["export_json"]
    ordering = ["id"]

    @admin.display(description="Antal instruktioner")
    def instruction_count(self, obj):
        return obj.instructions.count()

    @admin.action(description="Eksporter i JSON-format")
    def export_json(self, request, queryset):
        def get_instruction(instruction) -> dict:
            data = {"action": instruction.action}
            resource = getattr(instruction.resource, "name", None)
            if instruction.delay_after:
                data["delayAfter"] = instruction.delay_after
            if resource:
                data["resource"] = resource
            if instruction.element:
                data["element"] = instruction.element
            if instruction.data:
                data["data"] = instruction.data
            return data

        export_data = [
            {
                "pk": seq.pk,
                "part_name": seq.question.part.name,
                "instruction_sequence": [
                    get_instruction(instruction)
                    for instruction in seq.instructions.order_by("order")
                ],
            }
            for seq in queryset.order_by("pk")
        ]
        response = HttpResponse(content_type="application/json")
        json.dump(export_data, response, indent=4)
        return response


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["uuid", "processed", "event", "user"]
    list_filter = ["event"]
    search_fields = ["uuid", "user__username"]
    date_hierarchy = "processed"
    ordering = ["-processed"]


@admin.register(CorrectnessCategory)
class CorrectnessCategoryAdmin(SimpleHistoryAdmin):
    list_display = [
        "id",
        "lower_proportion_limit",
        "upper_proportion_limit",
        "color_key",
        "label_da",
    ]
    history_list_display = [
        "id",
        "upper_proportion_limit",
        "color_key",
        "label_da",
    ]
    ordering = ["upper_proportion_limit"]

    def lower_proportion_limit(self, obj: CorrectnessCategory):
        return obj.lower_proportion_limit  # pragma: no cover


@admin.register(ReadingSpeedCategory)
class ReadingSpeedCategoryAdmin(SimpleHistoryAdmin):
    list_display = [
        "id",
        "lower_proportion_limit",
        "upper_proportion_limit",
        "color_key",
        "label_da",
    ]
    history_list_display = [
        "id",
        "upper_proportion_limit",
        "color_key",
        "label_da",
    ]
    ordering = ["upper_proportion_limit"]

    def lower_proportion_limit(self, obj: ReadingSpeedCategory):
        return obj.lower_proportion_limit  # pragma: no cover


# The models below are registered so their change history (who changed what,
# and when) can be looked up in the admin, under "Historik" on each object.


class BaseUserAdmin(DjangoUserAdmin, SimpleHistoryAdmin):
    """
    DjangoUserAdmin handles the password field safely, and
    SimpleHistoryAdmin` adds the change history.
    """

    list_display = ["id", "username", "first_name", "last_name", "is_active"]
    search_fields = ["username", "first_name", "last_name"]
    fieldsets = DjangoUserAdmin.fieldsets + (  # type: ignore[operator]
        (_("Dysleksi"), {"fields": ("cpr", "uniid")}),
    )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    pass


@admin.register(Student)
class StudentAdmin(BaseUserAdmin):
    list_filter = ["institution", "classes"]
    fieldsets = BaseUserAdmin.fieldsets + ((None, {"fields": ("institution",)}),)


@admin.register(Teacher)
class TeacherAdmin(BaseUserAdmin):
    list_filter = ["institution"]
    fieldsets = BaseUserAdmin.fieldsets + ((None, {"fields": ("institution",)}),)


@admin.register(Class)
class ClassAdmin(SimpleHistoryAdmin):
    list_display = ["id", "name", "school_year_start", "institution", "is_main"]
    list_filter = ["institution", "school_year_start", "is_main"]
    search_fields = ["name", "group_id"]


@admin.register(TestQuestion)
class TestQuestionAdmin(SimpleHistoryAdmin):
    list_display = ["id", "part", "order", "question_type", "is_practice"]
    list_filter = ["part", "question_type", "is_practice"]


@admin.register(PossibleAnswer)
class PossibleAnswerAdmin(SimpleHistoryAdmin):
    list_display = ["id", "question", "resource", "correctness", "index"]
    list_filter = ["correctness", "question__part"]


@admin.register(TestAssignment)
class TestAssignmentAdmin(SimpleHistoryAdmin):
    list_display = ["id", "test", "teacher", "student", "klasse"]
    list_filter = ["test"]
    search_fields = ["student__username", "teacher__username", "klasse__name"]


@admin.register(TestResponse)
class TestResponseAdmin(SimpleHistoryAdmin):
    list_display = ["id", "assignment", "student", "completed", "cancelled", "flagged"]
    list_filter = ["completed", "cancelled", "flagged"]
    search_fields = ["student__username"]


@admin.register(PartResponse)
class PartResponseAdmin(SimpleHistoryAdmin):
    list_display = ["id", "testresponse", "testpart", "started_at", "completed"]
    list_filter = ["testpart", "completed"]


@admin.register(QuestionResponse)
class QuestionResponseAdmin(SimpleHistoryAdmin):
    list_display = ["id", "question", "partresponse", "correctness", "submitted_at"]
    list_filter = ["correctness", "question__part"]
    date_hierarchy = "submitted_at"
