from django.urls import re_path

from dysleksi import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/relay/(?P<room_name>\w+)/$",
        consumers.RelayConsumer.as_asgi(),  # type: ignore[arg-type]
    ),
]
