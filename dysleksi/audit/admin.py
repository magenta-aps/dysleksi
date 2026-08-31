# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from audit.models import ItemView, LoginAttempt, PageView
from django.contrib import admin


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
