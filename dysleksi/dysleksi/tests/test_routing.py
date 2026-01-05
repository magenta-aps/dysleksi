# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.test import SimpleTestCase

from dysleksi.routing import websocket_urlpatterns


class TestRouting(SimpleTestCase):
    def test_websocket_urlpatterns(self):
        self.assertIsInstance(websocket_urlpatterns, list)
        self.assertGreaterEqual(len(websocket_urlpatterns), 1)
