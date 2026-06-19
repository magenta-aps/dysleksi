# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.db.models import TextChoices
from django.template.defaultfilters import register
from psycopg.types.range import Range


@register.filter
def get(item, attribute):
    try:
        if item is not None:
            if type(attribute) is str:
                if hasattr(item, attribute):
                    return getattr(item, attribute)
                if hasattr(item, "get"):
                    return item.get(attribute)
            if isinstance(item, (tuple, list)):
                return item[int(attribute)]
            if isinstance(item, dict):
                if str(attribute) in item:
                    return item[str(attribute)]
                return item[attribute]
    except (KeyError, TypeError, IndexError):
        pass
    return None


@register.filter
def range_attr(item, attribute):
    if isinstance(item, Range):
        return getattr(item, attribute) or "-"
    return "-"


@register.filter
def label_from_choices(value, choices: TextChoices):
    choice = choices(value)  # type: ignore[operator]
    return choice.label
