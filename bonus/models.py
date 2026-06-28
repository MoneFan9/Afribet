"""
Bonus de bienvenue & portefeuille virtuel (conception §16, CU16/CU17, EF5b-5d).

`BonusGrant` = octroi (couplé au 1er dépôt, **une seule fois**). `VirtualUsagePolicy` =
bridage paramétrable de l'usage virtuel (EF5d). Les 4 soldes et `bonus_pocket_closed`
vivent déjà sur `wallet.Wallet`.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class BonusType(models.TextChoices):
    WELCOME = "WELCOME", "Bienvenue (1er dépôt)"


class BonusGrant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bonus_grants")
    type = models.CharField(max_length=16, choices=BonusType.choices, default=BonusType.WELCOME)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "bonus_grant"
        # Un seul octroi par (utilisateur, type) → bonus de bienvenue unique à vie.
        constraints = [models.UniqueConstraint(fields=["user", "type"], name="uniq_bonus_per_user_type")]


class VirtualUsagePolicy(models.Model):
    """Bridage de l'usage virtuel (EF5d). Une ligne `active` ; éditable depuis le hub."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    max_matches_per_day = models.PositiveIntegerField(default=20)  # 0 = illimité
    allowed_hours = models.CharField(max_length=32, blank=True, default="")  # ex. "08:00-23:00"
    cooldown_seconds = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bonus_virtual_usage_policy"

    def __str__(self) -> str:  # pragma: no cover
        return f"VirtualUsagePolicy(max/j={self.max_matches_per_day}, cd={self.cooldown_seconds}s)"
