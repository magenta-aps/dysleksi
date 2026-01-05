from django.urls import re_path

from dysleksi import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/chat/(?P<room_name>\w+)/$",
        consumers.ChatConsumer.as_asgi(),  # type: ignore[arg-type]
    ),
]
