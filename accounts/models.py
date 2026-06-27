"""
Entité `User` (couche entité — conception §Classes, CU1).

Téléphone **unique obligatoire** + e-mail. Le KYC d'identité est différé (stub au
MVP) et conditionne retrait/conversion. Ce modèle est volontairement minimal en
Phase 0 (il doit exister avant la première migration) ; le flux d'inscription / MFA
e-mail / JWT et le `KycProvider` sont ajoutés en Phase 3.
"""
from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class KycStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    VERIFIED = "VERIFIED", "Vérifié"
    REJECTED = "REJECTED", "Rejeté"


class User(AbstractUser):
    """Joueur ou compte système (Maison). `is_admin` ≈ `is_staff` (back-office CU10/CU12)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Téléphone unique = identifiant fort du joueur (conception CU1).
    phone_number = models.CharField("téléphone", max_length=32, unique=True, null=True, blank=True)
    kyc_status = models.CharField(
        max_length=16, choices=KycStatus.choices, default=KycStatus.PENDING
    )
    reputation_score = models.IntegerField(default=0)
    # Compte interne « Maison » : contrepartie des parties vs IA + bénéficiaire du
    # rake (conception §7.3). Jamais un joueur réel.
    is_system = models.BooleanField("compte système (Maison)", default=False)

    class Meta:
        db_table = "accounts_user"

    def __str__(self) -> str:  # pragma: no cover - repr trivial
        return self.username or str(self.phone_number) or str(self.id)


class EmailVerificationCode(models.Model):
    """Code MFA e-mail à usage unique (CU1). Généré à l'inscription, expirable."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_codes")
    code = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "accounts_email_code"
        indexes = [models.Index(fields=["user", "consumed_at"])]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None
