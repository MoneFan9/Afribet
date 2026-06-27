"""
Cœur financier (conception §4, ENF1) — couche entité.

`Wallet` à **quatre soldes** : poche réelle (`available` + `locked`) et poche
bonus/virtuelle (`bonus_available` + `bonus_locked`). `Transaction` = **registre
immuable** : chaque mouvement journalisé avec sa **poche** et `balance_after`,
seule vérité financière. Un match est financé par **une seule poche**.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from core.money import Money


class Pocket(models.TextChoices):
    REAL = "REAL", "Réelle"
    BONUS = "BONUS", "Bonus/virtuelle"


class TxType(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Dépôt"
    WITHDRAWAL = "WITHDRAWAL", "Retrait"
    BET_LOCK = "BET_LOCK", "Mise verrouillée"
    BET_WIN = "BET_WIN", "Gain"
    COMMISSION = "COMMISSION", "Rake"
    REFUND = "REFUND", "Remboursement"
    HOUSE_SETTLEMENT = "HOUSE_SETTLEMENT", "Règlement Maison"
    BONUS_GRANT = "BONUS_GRANT", "Octroi de bonus"
    BONUS_CONVERSION = "BONUS_CONVERSION", "Conversion bonus→réel"


class TxStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    SETTLED = "SETTLED", "Réglée"
    FAILED = "FAILED", "Échouée"


class Wallet(models.Model):
    # NB : DecimalField(2) pour rester multi-devises ; pour XAF (0 décimale) c'est
    # `Money` qui normalise/quantifie à la construction (aucun centime fantôme créé).
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="wallet"
    )
    available_balance = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    locked_balance = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    bonus_available = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    bonus_locked = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=8, default="XAF")
    # Poche virtuelle close à vie une fois épuisée (conception §16) — exploitée en Phase 9.
    bonus_pocket_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallet_wallet"

    # --- Accès Money par poche -------------------------------------------
    def money(self, field: str) -> Money:
        return Money(getattr(self, field), self.currency)

    def available(self, pocket: str) -> Money:
        field = "available_balance" if pocket == Pocket.REAL else "bonus_available"
        return self.money(field)

    def locked(self, pocket: str) -> Money:
        field = "locked_balance" if pocket == Pocket.REAL else "bonus_locked"
        return self.money(field)

    def __str__(self) -> str:  # pragma: no cover
        return f"Wallet({self.user_id}) {self.available_balance}+{self.locked_balance} {self.currency}"


class Transaction(models.Model):
    """Mouvement **immuable** du registre (jamais modifié après écriture)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transactions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="transactions"
    )
    type = models.CharField(max_length=20, choices=TxType.choices)
    pocket = models.CharField(max_length=8, choices=Pocket.choices)
    # Variation **signée** du solde disponible de la poche (déposer +, miser -, ...).
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=8, default="XAF")
    # Solde disponible de la poche **après** le mouvement (audit/reconstruction).
    balance_after = models.DecimalField(max_digits=20, decimal_places=2)
    status = models.CharField(max_length=10, choices=TxStatus.choices, default=TxStatus.SETTLED)
    # Référence lâche au match (pas de FK : wallet ne dépend pas de matchmaking — frontière).
    match_id = models.UUIDField(null=True, blank=True)
    reference = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wallet_transaction"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["wallet", "pocket"]),
            models.Index(fields=["match_id"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.type} {self.amount} {self.currency} [{self.pocket}]"

    def save(self, *args, **kwargs):
        # Registre immuable (ENF1) : une Transaction ne se modifie pas après écriture.
        # (Les transitions de statut PENDING→SETTLED/FAILED passent volontairement par
        # QuerySet.update, qui contourne save().)
        if not self._state.adding:
            from core.errors import WalletError

            raise WalletError("Transaction immuable : modification interdite.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from core.errors import WalletError

        raise WalletError("Transaction immuable : suppression interdite.")
