import json

from adminsortable2.admin import SortableAdminBase, SortableTabularInline
from django.contrib import admin
from django.http import HttpResponse
from django.utils.safestring import mark_safe

from dysleksi.models import (
    Instruction,
    InstructionSequence,
    Message,
    Test,
    TestPart,
    TestResource,
)


@admin.register(TestPart)
class TestPartAdmin(admin.ModelAdmin):
    pass


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    pass


@admin.register(TestResource)
class TestResourceAdmin(admin.ModelAdmin):
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
class InstructionAdmin(SoundPlayerMixin, admin.ModelAdmin):
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
class InstructionSequenceAdmin(SortableAdminBase, admin.ModelAdmin):
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
