"""
Services temps réel (conception §8/§9) — `PresenceService` (heartbeat/déconnexion)
et `MoveTimerService` (planification du timeout de coup via Celery).

Découplés des consumers (frontière 3) : un consumer Channels appelle ces services,
qui appellent à leur tour la logique métier (lifecycle).
"""
from __future__ import annotations

from core import config


class MoveTimerService:
    """Planifie l'échéance d'un coup (temps réel) → pire coup auto à expiration."""

    def schedule(self, match_id) -> None:
        from matchmaking.tasks import run_move_timeout

        secs = config.get_int("move_timer_seconds")
        run_move_timeout.apply_async(args=[str(match_id)], countdown=secs)


class PresenceService:
    """Fenêtre de grâce de reconnexion (conception §8.2)."""

    def schedule_disconnect_timeout(self, match_id, user_id, disconnect_event_id=None) -> None:
        from matchmaking.tasks import run_disconnect_timeout

        grace = config.get_int("grace_seconds")
        run_disconnect_timeout.apply_async(
            args=[str(match_id), str(user_id), str(disconnect_event_id) if disconnect_event_id else None],
            countdown=grace,
        )
