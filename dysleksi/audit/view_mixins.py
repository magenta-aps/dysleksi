# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from typing import Iterable, List

from audit.models import ItemView, PageView
from django.db.models import Model, QuerySet


class ViewLogMixin:
    def log_view(
        self,
        items: Model | Iterable[Model] | QuerySet[Model] | None = None,
    ) -> PageView:
        request = self.request  # type: ignore[attr-defined]
        user = request.user
        pageview = PageView.objects.create(
            user=user,
            username=user.get_username(),
            url=request.build_absolute_uri()[:1024],
            class_name=self.__class__.__name__,
            kwargs=self.kwargs,  # type: ignore[attr-defined]
            params=request.GET.dict(),
        )
        if items is not None:
            if isinstance(items, Model):
                items = [items]
            ItemView.objects.bulk_create(
                [
                    ItemView(pageview=pageview, item=item, item_label=str(item)[:255])
                    for item in items
                ]
            )
        return pageview


class ListViewLogMixin(ViewLogMixin):
    """Logs access to all objects listed by a `ListView`."""

    def get_logged_items(self) -> List[Model] | QuerySet[Model]:
        return self.object_list  # type: ignore[attr-defined]

    def get_context_data(self, **kwargs):
        self.log_view(self.get_logged_items())
        return super().get_context_data(**kwargs)


class DetailViewLogMixin(ViewLogMixin):
    """Logs access to the object displayed by a `DetailView`."""

    def get_logged_items(self) -> Model | List[Model] | QuerySet[Model]:
        return self.object  # type: ignore[attr-defined]

    def get_context_data(self, **kwargs):
        self.log_view(self.get_logged_items())
        return super().get_context_data(**kwargs)
