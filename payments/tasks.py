"""
Tâches Celery paiement (conception §5 : callbacks traités en asynchrone ;
`verify` en secours). En dev, `CELERY_TASK_ALWAYS_EAGER` exécute en synchrone.
"""
from __future__ import annotations

from celery import shared_task

from .services import PaymentService


@shared_task
def process_callback(provider_key: str, payload: dict) -> str:
    intent = PaymentService().handle_callback(provider_key, payload)
    return str(intent.id)


@shared_task
def verify_pending_deposits() -> int:
    """Filet de secours : vérifie activement les dépôts encore en attente."""
    from .models import Direction, IntentStatus, PaymentIntent

    svc = PaymentService()
    count = 0
    for intent in PaymentIntent.objects.filter(direction=Direction.IN, status=IntentStatus.PENDING):
        before = intent.status
        svc.verify(intent)
        intent.refresh_from_db()
        count += int(intent.status != before)
    return count
