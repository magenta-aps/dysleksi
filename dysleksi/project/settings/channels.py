CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("dysleksi-redis", 6379)],
            "expiry": 300,
        },
    },
}
