from django.conf import settings
from django.http import HttpRequest
from django.middleware.csrf import get_token
from django.urls import reverse


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


def version_context(request: HttpRequest):
    return {
        "version": settings.VERSION,  # type: ignore
    }


def client_error_log_context(request: HttpRequest):
    # Where and how `static/js/error-reporting.js` should post browser errors.
    return {
        "CLIENT_ERROR_LOG_CONFIG": {
            "url": reverse("dysleksi:client_error_log"),
            "csrf_token": get_token(request),
        }
    }


def auto_logout_context(request: HttpRequest):
    return {
        "AUTO_LOGOUT_CONFIG": {
            "enabled": request.user.is_authenticated,
            # Never log the user out if he is taking a test
            "logout_on_idle": nav_context(request)["current_view"] != "dysleksi:room",
            "timeout": settings.SESSION_IDLE_TIMEOUT,  # type: ignore
            "ping_url": reverse("dysleksi:ping"),
            "logout_url": reverse("login:logout"),
        }
    }


def webrtc_settings(request):
    return {
        "WEBRTC_CONFIG": {
            "key": settings.WEBRTC_KEY,
        }
    }
