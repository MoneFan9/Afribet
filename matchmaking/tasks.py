"""
Tâches Celery du cycle de vie (conception §11 : timers de coup, appariement).
En dev, `CELERY_TASK_ALWAYS_EAGER` exécute en synchrone.
"""
from __future__ import annotations

from celery import shared_task


@shared_task
def run_move_timeout(match_id: str) -> str:
    from .lifecycle import MatchLifecycleService

    match = MatchLifecycleService().on_move_timeout(match_id=match_id)
    return f"{match_id}:{match.status}"


@shared_task
def run_disconnect_timeout(match_id: str, user_id: str) -> str:
    from django.contrib.auth import get_user_model

    from .lifecycle import MatchLifecycleService

    user = get_user_model().objects.get(id=user_id)
    match = MatchLifecycleService().on_disconnect_timeout(match_id=match_id, user=user)
    return f"{match_id}:{match.status}"


@shared_task
def run_auto_pair() -> list:
    from .services import MatchmakingService

    return [str(m) for m in MatchmakingService().auto_pair()]
