# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.utils import translation


class StudentLanguageMiddleware:
    """
    Students have no language picker; their UI is always Greenlandic.

    Must be placed after `AuthenticationMiddleware`, as it needs `request.user`.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.user.is_student:
            translation.activate("kl")
            request.LANGUAGE_CODE = "kl"
        return self.get_response(request)
