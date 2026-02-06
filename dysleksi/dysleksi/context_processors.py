from django.conf import settings
from django.http import HttpRequest


def nav_context(request: HttpRequest):
    try:
        return {"current_view": request.resolver_match.view_name}  # type: ignore
    except Exception:
        return {"current_view": None}


def debug_context(request: HttpRequest):
    return {"show_debug_console": settings.SHOW_DEBUG_CONSOLE}  # type: ignore
