"""
`BonusService` (couche contrôle, CU16/CU17, §16).

- Octroi du **bonus de bienvenue** couplé au 1er dépôt (poche virtuelle, une seule fois).
- **Bridage** de l'usage virtuel (EF5d) via `VirtualUsagePolicy` (usage dérivé de `Match`).
- **Conversion** virtuel→réel par **tranches entières** 200:1, reste laissé en virtuel,
  sous KYC, exposition bornée par un plafond global.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import KycStatus
from core import config
from core.money import Money
from wallet.models import Pocket, TxType, Wallet
from wallet.services import WalletService

from .errors import (
    ConversionBelowThreshold,
    GlobalCapReached,
    KycRequired,
    VirtualUsageExceeded,
)
from .models import BonusConversionCounter, BonusGrant, BonusType, VirtualUsagePolicy


class BonusService:
    def __init__(self, wallet_service: WalletService | None = None) -> None:
        self.wallet = wallet_service or WalletService()

    # --- CU16 : octroi du bonus de bienvenue (1er dépôt) -----------------
    def _expiry(self):
        days = config.get_int("bonus_expiry_days")
        return timezone.now() + timedelta(days=days) if days else None

    @transaction.atomic
    def maybe_grant_welcome(self, user, intent) -> BonusGrant | None:
        """Octroie le bonus une seule fois, au 1er dépôt confirmé. Idempotent."""
        pct = config.get_decimal("welcome_bonus_pct")
        amount = Money(intent.amount, intent.currency) * pct
        if not amount.is_positive:
            return None
        wallet = self.wallet.ensure_wallet(user)
        if wallet.bonus_pocket_closed:
            return None
        try:
            grant = BonusGrant.objects.create(
                user=user, type=BonusType.WELCOME, amount=amount.amount, expires_at=self._expiry()
            )
        except IntegrityError:
            return None  # déjà octroyé (contrainte d'unicité) → idempotent
        self.wallet.credit(user, amount, TxType.BONUS_GRANT, Pocket.BONUS, reference="welcome-bonus")
        return grant

    # --- EF5d : bridage de l'usage virtuel -------------------------------
    def _policy(self):
        p = VirtualUsagePolicy.objects.filter(active=True).first()
        if p is not None:
            return p.max_matches_per_day, p.allowed_hours, p.cooldown_seconds
        return (
            config.get_int("virtual_max_matches_per_day"),
            config.get_str("virtual_allowed_hours"),
            config.get_int("virtual_cooldown_seconds"),
        )

    @staticmethod
    def _within_hours(now, spec: str) -> bool:
        if not spec or "-" not in spec:
            return True
        try:
            start_s, end_s = spec.split("-", 1)
            sh, sm = (int(x) for x in start_s.split(":"))
            eh, em = (int(x) for x in end_s.split(":"))
            start, end = time(sh, sm), time(eh, em)
        except (ValueError, TypeError):
            return True  # spec mal formée → permissif
        t = now.time()
        if start <= end:
            return start <= t <= end
        # Plage chevauchant minuit (ex. 22:00-06:00).
        return t >= start or t <= end

    def check_virtual_usage(self, user) -> None:
        """Applique la `VirtualUsagePolicy` avant un défi en poche BONUS."""
        from matchmaking.models import Match, StakeKind

        max_per_day, allowed_hours, cooldown = self._policy()
        now = timezone.now()
        if not self._within_hours(now, allowed_hours):
            raise VirtualUsageExceeded("Hors plage horaire autorisée pour le jeu virtuel.")
        participated = Match.objects.filter(stake_kind=StakeKind.BONUS).filter(
            Q(player_1=user) | Q(player_2=user)
        )
        if max_per_day:
            day_start = datetime.combine(now.date(), time.min, tzinfo=now.tzinfo)
            if participated.filter(created_at__gte=day_start).count() >= max_per_day:
                raise VirtualUsageExceeded("Quota de matchs virtuels du jour atteint.")
        if cooldown:
            last = participated.order_by("-created_at").first()
            if last and (now - last.created_at).total_seconds() < cooldown:
                raise VirtualUsageExceeded("Cooldown entre parties virtuelles non écoulé.")

    # --- CU17 : conversion virtuel → réel (tranches, sous KYC) -----------
    def convert_bonus_to_real(self, user) -> dict:
        if user.kyc_status != KycStatus.VERIFIED:
            raise KycRequired("La conversion nécessite un KYC validé.")
        from compliance.services import ComplianceService

        ComplianceService().is_allowed(user, "convert")
        threshold = config.get_int("bonus_conversion_threshold")
        per_tranche = config.get_int("bonus_conversion_real_per_tranche")
        cap = config.get_int("bonus_global_conversion_cap")
        if threshold <= 0:
            raise ConversionBelowThreshold("Seuil de conversion non configuré.")

        with transaction.atomic():
            # Point de sérialisation GLOBAL : on verrouille le compteur d'exposition
            # avant toute lecture/vérification → pas de TOCTOU sur le plafond (anti
            # dépassement par conversions concurrentes de joueurs différents).
            BonusConversionCounter.objects.get_or_create(id=1)
            counter = BonusConversionCounter.objects.select_for_update().get(id=1)
            wallet = Wallet.objects.select_for_update().get(user=user)
            bonus_avail = wallet.bonus_available
            n = int(bonus_avail // threshold)
            if n < 1:
                raise ConversionBelowThreshold(
                    f"Solde virtuel sous le seuil de conversion ({threshold})."
                )
            bonus_amount = Money(n * threshold, wallet.currency)
            real_amount = Money(n * per_tranche, wallet.currency)
            if cap and counter.total_converted_real + real_amount.amount > cap:
                raise GlobalCapReached("Plafond global de conversion atteint.")
            self.wallet.convert_bonus(user, bonus_amount, real_amount)
            counter.total_converted_real += real_amount.amount
            counter.save(update_fields=["total_converted_real"])
            # Clôture à vie si la poche virtuelle retombe à zéro (§16).
            wallet.refresh_from_db()
            if wallet.bonus_available == 0 and wallet.bonus_locked == 0:
                wallet.bonus_pocket_closed = True
                wallet.save(update_fields=["bonus_pocket_closed"])
        return {
            "tranches": n,
            "real_credited": real_amount.amount,
            "remainder_virtual": bonus_avail - bonus_amount.amount,
        }
