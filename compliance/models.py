"""
Conformité paramétrable par juridiction + jeu responsable (conception §14, EF16/EF17).

`Jurisdiction` porte le profil réglementaire d'un pays ; `ComplianceProfile` rattache
un joueur à sa juridiction (côté compliance → aucune dépendance d'`accounts` envers
`compliance`, pas de cycle de FK). `SelfExclusion` et `ResponsibleGamblingLimit`
implémentent le jeu responsable.

`[AJUSTÉ]` : `ResponsibleGamblingLimit` (limites **par joueur**) n'est pas dans le
diagramme de conception ; ajoutée pour couvrir EF16 (« limites paramétrables par le
joueur, baisse immédiate / hausse après délai »).
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class KycLevel(models.TextChoices):
    NONE = "NONE", "Aucun"
    BASIC = "BASIC", "Basique"
    FULL = "FULL", "Complet"


class ExclusionType(models.TextChoices):
    TEMPORARY = "TEMPORARY", "Temporaire"
    PERMANENT = "PERMANENT", "Définitive"


class LimitKind(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Dépôt"
    BET = "BET", "Mise"
    LOSS = "LOSS", "Perte"
    SESSION_TIME = "SESSION_TIME", "Temps de session"


class LimitPeriod(models.TextChoices):
    DAILY = "DAILY", "Quotidienne"
    WEEKLY = "WEEKLY", "Hebdomadaire"
    MONTHLY = "MONTHLY", "Mensuelle"


class Jurisdiction(models.Model):
    """Profil réglementaire d'un pays (EF17) — éditable depuis le hub admin."""

    country_code = models.CharField(max_length=4, primary_key=True)  # ex. "GA"
    currency = models.CharField(max_length=8, default="XAF")
    legal_age = models.PositiveSmallIntegerField(default=18)
    kyc_level = models.CharField(max_length=8, choices=KycLevel.choices, default=KycLevel.NONE)
    max_rake = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    gambling_allowed = models.BooleanField(default=True)
    vs_ai_allowed = models.BooleanField(default=True)
    allowed_payment_methods = models.JSONField(default=list, blank=True)
    # Plafonds par défaut du pays, ex. {"DEPOSIT": {"DAILY": 500000}, "BET": {"DAILY": 200000}}.
    limits = models.JSONField(default=dict, blank=True)
    reporting = models.JSONField(default=dict, blank=True)
    mentions = models.TextField(blank=True, default="")
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "compliance_jurisdiction"

    def __str__(self) -> str:  # pragma: no cover
        return self.country_code


class ComplianceProfile(models.Model):
    """Rattachement joueur ↔ juridiction + consentement RGPD (ossature §14)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compliance_profile"
    )
    jurisdiction = models.ForeignKey(
        Jurisdiction, on_delete=models.SET_NULL, null=True, blank=True, related_name="players"
    )
    data_consent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "compliance_profile"


class SelfExclusion(models.Model):
    """Auto-exclusion d'un joueur (jeu responsable, §14)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="self_exclusions"
    )
    type = models.CharField(max_length=10, choices=ExclusionType.choices)
    until = models.DateTimeField(null=True, blank=True)  # null si PERMANENT
    reason = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "compliance_self_exclusion"
        indexes = [models.Index(fields=["user", "type"])]


class ResponsibleGamblingLimit(models.Model):
    """Limite fixée par le joueur (EF16) — `[AJUSTÉ]`.

    Baisse **immédiate**, hausse différée (`effective_at = now + cooldown`).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rg_limits"
    )
    kind = models.CharField(max_length=16, choices=LimitKind.choices)
    period = models.CharField(max_length=8, choices=LimitPeriod.choices, default=LimitPeriod.DAILY)
    value = models.DecimalField(max_digits=20, decimal_places=2)
    effective_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "compliance_rg_limit"
        indexes = [models.Index(fields=["user", "kind", "effective_at"])]
