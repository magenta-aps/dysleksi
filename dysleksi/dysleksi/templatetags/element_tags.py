# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.template.defaultfilters import register


@register.inclusion_tag(
    "dysleksi/admin/templatetags/details_popup.html", takes_context=True
)
def details_popup(context):
    return {**context.flatten()}
