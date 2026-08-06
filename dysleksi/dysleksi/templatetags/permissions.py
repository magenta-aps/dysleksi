# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import logging

from django.template.defaultfilters import register

from dysleksi.models import PermissionsMixin

logger = logging.getLogger(__name__)


@register.simple_tag(takes_context=True)
def has_permission(context, obj, action):
    user = context["request"].user
    if isinstance(obj, PermissionsMixin):
        return obj.has_permission(user, action)
    logger.warning(
        "attempted to use template filter `has_permission` on object %r, which is not "
        "a subclass of `PermissionsMixin`"
    )
    return True
