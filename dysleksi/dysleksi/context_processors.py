from django.conf import settings
from django.http import HttpRequest


def nav_context(request: HttpRequest):
    try:
        return {"current_view": request.resolver_match.view_name}  # type: ignore
    except Exception:
        return {"current_view": None}


def debug_context(request: HttpRequest):
    return {
        "show_debug_console": settings.SHOW_DEBUG_CONSOLE,  # type: ignore
        "show_test_debug_buttons": settings.DEBUG,  # type: ignore
    }


def webrtc_settings(request):
    return {
        "WEBRTC_CONFIG": {
            "key": settings.WEBRTC_KEY,
        }
    }
