"""
Pont avec l'argent réel (conception §5, CU2/CU7) — couche entité.

`PaymentIntent` = ordre de dépôt (IN) ou de retrait (OUT) auprès d'un prestataire,
avec **idempotence** (`idempotency_key` + `external_ref`) : un callback rejoué ne
crédite qu'une fois (ENF8). Le wallet ne voit que des intents **confirmés**.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Direction(models.TextChoices):
    IN = "IN", "Dépôt"
    OUT = "OUT", "Retrait"


class IntentStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    SETTLED = "SETTLED", "Réglé"
    FAILED = "FAILED", "Échoué"


class PaymentIntent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payment_intents"
    )
    direction = models.CharField(max_length=3, choices=Direction.choices)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=8, default="XAF")
    provider_key = models.CharField(max_length=32)
    method = models.CharField(max_length=32, blank=True, default="")
    external_ref = models.CharField(max_length=128, blank=True, default="", db_index=True)
    idempotency_key = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=10, choices=IntentStatus.choices, default=IntentStatus.PENDING)
    destination = models.CharField(max_length=128, blank=True, default="")  # retrait
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments_intent"
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.direction} {self.amount} {self.currency} [{self.status}]"
