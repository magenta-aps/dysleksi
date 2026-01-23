import logging
from datetime import datetime

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.core.cache import caches

logger = logging.getLogger(__name__)
cache = caches["chat"]  # As defined in settings/cache.py


class ChatConsumer(JsonWebsocketConsumer):
    def connect(self):
        # Join room group
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"
        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )
        self.accept()
        logger.info("'%s' joined room '%s'", self.scope["user"], self.room_name)

        values = cache.get_many(sorted(cache.keys(f"{self.room_group_name}_*")))
        for key, message in values.items():
            if message.get("event") in ("lobby.joined", "lobby.present"):
                # Send only cached "joined" and "present" messages
                async_to_sync(self.channel_layer.send)(
                    self.channel_name, {"type": "chat.message", **message}
                )

    def disconnect(self, close_code):
        # Leave room group
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )
        logger.info("'%s' left room '%s'", self.scope["user"], self.room_name)

    # Receive message from WebSocket
    def receive_json(self, content: dict, **kwargs):
        # required by `django-channels`, must match our method name in this class
        # (dots are replaced with underscores,
        # then the class is checked for a method with that name)
        content["type"] = "chat.message"
        # Send message to room group
        async_to_sync(self.channel_layer.group_send)(self.room_group_name, content)
        logger.info("'%s' sent '%s'", self.scope["user"], content)

        # Store message in cache
        cache.set(
            f"{self.room_group_name}_{datetime.now().timestamp()}",
            content,
            timeout=300,
        )

    # Receive message from room group
    # method name must match the type attribute in the received json
    def chat_message(self, message: dict):
        # Send message to WebSocket
        self.send_json({k: v for k, v in message.items() if k != "type"})
