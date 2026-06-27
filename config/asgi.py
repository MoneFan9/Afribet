"""
Point d'entrée ASGI — HTTP (Django) + WebSocket (Channels, temps réel).

Le routing WebSocket des matchs/lobby (conception §9, app `realtime`) est branché
en Phase 7 via `realtime.routing.websocket_urlpatterns`.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# L'app Django doit être initialisée avant d'importer le routing Channels.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # "websocket": branché en Phase 7 (realtime).
    }
)
