"""Routing WebSocket (conception §Navigation : /match/:id en temps réel)."""
from __future__ import annotations

from django.urls import re_path

from .consumers import MatchConsumer

websocket_urlpatterns = [
    re_path(r"^ws/match/(?P<match_id>[0-9a-f-]+)/$", MatchConsumer.as_asgi()),
]
