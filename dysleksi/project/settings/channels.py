CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                {"address": "redis://dysleksi-redis:6379", "socket_timeout": None}
            ],
            "expiry": 300,
            "capacity": 2000,
        },
    },
}
