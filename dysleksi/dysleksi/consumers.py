import json
import logging

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer


logger = logging.getLogger(__name__)


class ChatConsumer(WebsocketConsumer):
    def connect(self):
        # Join room group
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"
        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )
        self.accept()
        logger.info("'%s' joined room '%s'", self.scope["user"], self.room_name)

    def disconnect(self, close_code):
        # Leave room group
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )
        logger.info("'%s' left room '%s'", self.scope["user"], self.room_name)

    # Receive message from WebSocket
    def receive(self, text_data=None, bytes_data=None):
        # Send message to room group
        text_data_json = json.loads(text_data)
        text_data_json["type"] = "chat.message"  # required by `django-channels`
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name, text_data_json
        )
        logger.info("'%s' sent '%s'", self.scope["user"], text_data)

    # Receive message from room group
    def chat_message(self, message):
        # Send message to WebSocket
        self.send(
            text_data=json.dumps({k: v for k, v in message.items() if k != "type"})
        )
