"""
`PaymentService` (couche contrôle, CU2/CU7) — cycle de vie d'un `PaymentIntent`
(`PENDING → SETTLED | FAILED`), **idempotent** et **serveur-autoritaire** :
aucun crédit avant confirmation réelle (callback vérifié), un callback rejoué ne
crédite qu'une fois (ENF8).
"""
from __future__ import annotations

import uuid

from django.db import transaction

from accounts.models import KycStatus
from core.errors import DomainError
from core.money import Money
from wallet.models import Transaction, TxStatus, TxType
from wallet.services import WalletService

from .models import Direction, IntentStatus, PaymentIntent
from .providers import registry


class PaymentError(DomainError):
    pass


class KycRequired(PaymentError):
    pass


class PaymentService:
    def __init__(self, wallet_service: WalletService | None = None) -> None:
        self.wallet = wallet_service or WalletService()

    # --- Dépôt (CU2) ------------------------------------------------------
    def deposit(
        self, user, amount: Money, *, method: str = "", provider_key: str = "sandbox",
        idempotency_key: str | None = None,
    ) -> dict:
        if not amount.is_positive:
            raise PaymentError("Le montant du dépôt doit être positif.")
        # Idempotence requête : une re-soumission avec la même clé renvoie l'intent existant.
        if idempotency_key:
            existing = PaymentIntent.objects.filter(idempotency_key=idempotency_key).first()
            if existing is not None:
                return {"intent": existing, "instruction": "Dépôt déjà initié."}
        provider = registry.get(provider_key)
        intent = PaymentIntent.objects.create(
            user=user,
            direction=Direction.IN,
            amount=amount.amount,
            currency=amount.currency,
            provider_key=provider_key,
            method=method,
            idempotency_key=idempotency_key or uuid.uuid4().hex,
        )
        instruction = provider.initiate_deposit(intent)
        intent.external_ref = instruction.get("external_ref", "")
        intent.save(update_fields=["external_ref"])
        return {"intent": intent, "instruction": instruction.get("instruction", "")}

    # --- Retrait (CU7, KYC requis) ---------------------------------------
    def withdraw(self, user, amount: Money, *, destination: str, provider_key: str = "sandbox") -> PaymentIntent:
        if user.kyc_status != KycStatus.VERIFIED:
            raise KycRequired("Le retrait nécessite un KYC validé.")
        if not amount.is_positive:
            raise PaymentError("Le montant du retrait doit être positif.")
        provider = registry.get(provider_key)
        with transaction.atomic():
            intent = PaymentIntent.objects.create(
                user=user,
                direction=Direction.OUT,
                amount=amount.amount,
                currency=amount.currency,
                provider_key=provider_key,
                destination=destination,
                idempotency_key=uuid.uuid4().hex,
            )
            # Réserve immédiatement le montant (débit available, tx WITHDRAWAL PENDING).
            self.wallet.reserve_for_payout(user, amount, reference=str(intent.id))
            instruction = provider.initiate_payout(intent)
            intent.external_ref = instruction.get("external_ref", "")
            intent.save(update_fields=["external_ref"])
        return intent

    # --- Callback prestataire (idempotent) -------------------------------
    @transaction.atomic
    def handle_callback(self, provider_key: str, payload: dict) -> PaymentIntent:
        provider = registry.get(provider_key)
        result = provider.parse_callback(payload)
        intent = (
            PaymentIntent.objects.select_for_update()
            .filter(external_ref=result.external_ref, provider_key=provider_key)
            .first()
        )
        if intent is None:
            raise PaymentError("Ordre de paiement introuvable pour ce callback.")
        if intent.status != IntentStatus.PENDING:
            return intent  # déjà traité → idempotent (callback rejoué ignoré)

        if result.success:
            self._settle(intent)
        else:
            self._fail(intent)
        return intent

    def verify(self, intent: PaymentIntent) -> PaymentIntent:
        """Vérification active de secours pour un **dépôt** (si le callback manque).

        Bornée à `direction == IN` : on ne règle jamais un **retrait** par simple
        vérification optimiste (un payout doit être confirmé par le prestataire).
        """
        if intent.direction != Direction.IN:
            return intent
        provider = registry.get(intent.provider_key)
        if intent.status == IntentStatus.PENDING and provider.verify(intent.external_ref):
            with transaction.atomic():
                locked = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
                if locked.status == IntentStatus.PENDING:
                    self._settle(locked)
                return locked
        return intent

    # --- Règlement interne -----------------------------------------------
    def _settle(self, intent: PaymentIntent) -> None:
        money = Money(intent.amount, intent.currency)
        if intent.direction == Direction.IN:
            self.wallet.credit(intent.user, money, TxType.DEPOSIT, reference=str(intent.id))
            intent.status = IntentStatus.SETTLED
            intent.save(update_fields=["status"])
            _maybe_grant_welcome_bonus(intent)  # hook bonus (Phase 9)
        else:  # OUT : le débit était déjà réservé ; on le rend définitif.
            updated = Transaction.objects.filter(
                reference=str(intent.id), type=TxType.WITHDRAWAL, status=TxStatus.PENDING
            ).update(status=TxStatus.SETTLED)
            if updated != 1:
                # Incohérence : pas exactement une réservation à régler → on refuse.
                raise PaymentError(
                    f"Réservation de retrait introuvable/multiple ({updated}) pour {intent.id}."
                )
            intent.status = IntentStatus.SETTLED
            intent.save(update_fields=["status"])

    def _fail(self, intent: PaymentIntent) -> None:
        if intent.direction == Direction.OUT:
            # Payout échoué → re-créditer et marquer la réservation échouée.
            self.wallet.credit_back(intent.user, Money(intent.amount, intent.currency), reference=str(intent.id))
            Transaction.objects.filter(
                reference=str(intent.id), type=TxType.WITHDRAWAL, status=TxStatus.PENDING
            ).update(status=TxStatus.FAILED)
        intent.status = IntentStatus.FAILED
        intent.save(update_fields=["status"])


def _maybe_grant_welcome_bonus(intent: PaymentIntent) -> None:
    """Hook : octroi du bonus de bienvenue au 1er dépôt confirmé (CU16).

    Implémenté en Phase 9 (`bonus.services`). Importé paresseusement pour ne pas
    coupler `payments` à `bonus` tant que l'app n'est pas active.
    """
    try:
        from bonus.services import BonusService
    except Exception:  # noqa: BLE001 - bonus pas encore branché
        return
    BonusService().maybe_grant_welcome(intent.user, intent)
