# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from collections import defaultdict
from itertools import chain
from operator import itemgetter

from audit.models import ItemView, LoginAttempt, ObjectChange, PageView
from django.apps import apps
from django.contrib import admin
from django.core.exceptions import ObjectDoesNotExist
from django.core.paginator import Paginator
from django.template.response import TemplateResponse
from django.urls import reverse

from dysleksi.models import (
    Instruction,
    InstructionSequence,
    PossibleAnswer,
    Student,
    Teacher,
    Test,
    TestPart,
    TestQuestion,
    TestResource,
    User,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """A `ModelAdmin` that can only be searched and read, not written."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LoginAttempt)
class LoginAttemptAdmin(ReadOnlyAdmin):
    list_display = [
        "timestamp",
        "user_id",
        "username",
        "result",
        "backend",
        "ip_address",
    ]
    list_filter = ["result", "backend"]
    list_select_related = ["user"]
    search_fields = ["username", "user__id", "ip_address"]
    date_hierarchy = "timestamp"

    @admin.display(description="Bruger-id", ordering="user__id")
    def user_id(self, obj: LoginAttempt):
        return obj.user_id


class ItemViewInline(admin.TabularInline):
    model = ItemView
    fields = ["content_type", "object_id", "item_label"]
    readonly_fields = ["content_type", "object_id", "item_label"]
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PageView)
class PageViewAdmin(ReadOnlyAdmin):
    list_display = ["timestamp", "user_id", "username", "class_name", "items_accessed"]
    list_filter = ["class_name", "items__content_type"]
    list_select_related = ["user"]
    search_fields = [
        "username",
        "user__id",
        "url",
        "items__item_label",
        "items__object_id",
    ]
    date_hierarchy = "timestamp"
    inlines = [ItemViewInline]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("items")

    @admin.display(description="Bruger-id", ordering="user__id")
    def user_id(self, obj: PageView):
        return obj.user_id

    @admin.display(description="Tilgåede data")
    def items_accessed(self, obj: PageView):
        return ", ".join(item.item_label for item in obj.items.all())


@admin.register(ItemView)
class ItemViewAdmin(ReadOnlyAdmin):
    """Lets you search the log by the data that was accessed, rather than by
    the user who accessed it."""

    list_display = ["timestamp", "username", "content_type", "object_id", "item_label"]
    list_filter = ["content_type"]
    list_select_related = ["pageview", "content_type"]
    search_fields = ["item_label", "object_id", "pageview__username"]
    date_hierarchy = "pageview__timestamp"

    @admin.display(description="Tidspunkt", ordering="pageview__timestamp")
    def timestamp(self, obj: ItemView):
        return obj.pageview.timestamp

    @admin.display(description="Brugernavn", ordering="pageview__username")
    def username(self, obj: ItemView):
        return obj.pageview.username


HISTORY_MODELS = [
    User,
    Student,
    Teacher,
    Test,
    TestPart,
    TestQuestion,
    TestResource,
    PossibleAnswer,
    InstructionSequence,
    Instruction,
]
IGNORED_FIELDS = {
    "id",
    "history_id",
    "history_date",
    "history_type",
    "history_user",
    "history_change_reason",
    "last_login",
}
CHANGE_TYPES = {"+": "Oprettet", "~": "Ændret", "-": "Slettet"}


def m2m_values(history, field):
    m2m_history = apps.get_model(
        history._meta.app_label, f"{history.__name__}_{field.name}"
    )
    related = f"{field.m2m_reverse_field_name()}_id"
    values = defaultdict(list)
    for history_id, related_id in m2m_history.objects.order_by(related).values_list(
        "history_id", related
    ):
        values[history_id].append(related_id)
    return values


def describe(changes):
    if len(changes) == 1 and "password" not in changes:
        [(field, (old, new))] = changes.items()
        return f"{field}: {old} → {new}"
    return ", ".join(changes)


def label(record):
    try:
        return str(record.instance)
    except ObjectDoesNotExist:
        return record.id


def object_changes(model):
    history = model.history.model
    fields = [f.attname for f in history._meta.fields if f.name not in IGNORED_FIELDS]
    m2m = {f.name: m2m_values(history, f) for f in history._history_m2m_fields}
    rows = history.objects.order_by("id", "history_id").values(
        "id", "history_id", "history_date", "history_type", *fields
    )
    previous_id = previous = None
    for row in rows.iterator():
        tracked = {f: row[f] for f in fields} | {
            name: values[row["history_id"]] for name, values in m2m.items()
        }
        changes = {
            f: (previous[f], value)
            for f, value in tracked.items()
            if previous_id == row["id"] and previous[f] != value
        }
        if row["history_type"] != "~" or previous_id != row["id"] or changes:
            yield {
                "timestamp": row["history_date"],
                "history": history,
                "history_id": row["history_id"],
                "change_type": CHANGE_TYPES[row["history_type"]],
                "model": model._meta.verbose_name,
                "object_id": row["id"],
                "url": reverse(
                    f"admin:dysleksi_{model._meta.model_name}_history",
                    args=[row["id"]],
                ),
                "changes": describe(changes),
            }
        previous_id, previous = row["id"], tracked


@admin.register(ObjectChange)
class ObjectChangeAdmin(ReadOnlyAdmin):
    def changelist_view(self, request, extra_context=None):
        selected = request.GET.get("model")
        models = [m for m in HISTORY_MODELS if selected in (None, m._meta.model_name)]
        changes = sorted(
            chain.from_iterable(map(object_changes, models)),
            key=itemgetter("timestamp"),
            reverse=True,
        )
        page = Paginator(changes, 100).get_page(request.GET.get("p"))
        history_ids = defaultdict(list)
        for change in page:
            history_ids[change["history"]].append(change["history_id"])
        records = {
            (history, record.history_id): record
            for history, ids in history_ids.items()
            for record in history.objects.filter(history_id__in=ids).select_related(
                "history_user"
            )
        }
        for change in page:
            record = records[change["history"], change["history_id"]]
            change["user"] = record.history_user
            change["object"] = label(record)
        return TemplateResponse(
            request,
            "admin/audit/objectchange/change_list.html",
            {
                **self.admin_site.each_context(request),
                "opts": self.opts,
                "title": self.opts.verbose_name_plural,
                "models": [
                    (m._meta.model_name, m._meta.verbose_name) for m in HISTORY_MODELS
                ],
                "selected": selected,
                "page": page,
            },
        )
