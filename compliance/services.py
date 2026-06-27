"""
`ComplianceService` (couche contrôle, §13/§14, EF16/EF17).

**Permissif par défaut** : sans juridiction assignée, sans auto-exclusion et sans
limite configurée, toutes les vérifications sont neutres (l'itération 1 n'est pas
bridée tant qu'on ne configure pas la conformité). Branché paresseusement dans
`payments`/`matchmaking` pour éviter tout cycle d'apps.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from core import config
from core.money import Money

from .errors import (
    JurisdictionForbidden,
    KycLevelRequired,
    LimitExceeded,
    SelfExcluded,
)
from .models import (
    ComplianceProfile,
    ExclusionType,
    Jurisdiction,
    KycLevel,
    LimitKind,
    LimitPeriod,
    ResponsibleGamblingLimit,
    SelfExclusion,
)

# Action → nature de limite applicable.
_ACTION_LIMIT = {"deposit": LimitKind.DEPOSIT, "bet": LimitKind.BET, "bet_vs_ai": LimitKind.BET}
_PERIOD_DELTA = {
    LimitPeriod.DAILY: timedelta(days=1),
    LimitPeriod.WEEKLY: timedelta(weeks=1),
    LimitPeriod.MONTHLY: timedelta(days=30),
}


class ComplianceService:
    # --- Juridiction ------------------------------------------------------
    def jurisdiction_of(self, user) -> Jurisdiction | None:
        profile = ComplianceProfile.objects.filter(user=user).select_related("jurisdiction").first()
        if profile and profile.jurisdiction:
            return profile.jurisdiction
        code = config.get_str("default_jurisdiction")
        if code:
            return Jurisdiction.objects.filter(country_code=code, active=True).first()
        return None

    # --- Autorisation d'une action ---------------------------------------
    def is_allowed(self, user, action: str) -> None:
        """Lève si l'action est interdite (auto-exclusion, juridiction, KYC)."""
        if self._active_self_exclusion(user):
            raise SelfExcluded("Compte auto-exclu : action indisponible.")
        juris = self.jurisdiction_of(user)
        if juris is None:
            return  # permissif par défaut
        if action in ("deposit", "withdraw", "bet", "bet_vs_ai") and not juris.gambling_allowed:
            raise JurisdictionForbidden("Jeu d'argent non autorisé dans cette juridiction.")
        if action == "bet_vs_ai" and not juris.vs_ai_allowed:
            raise JurisdictionForbidden("Parties contre l'IA non autorisées ici.")
        if action in ("withdraw", "convert") and juris.kyc_level == KycLevel.FULL:
            from accounts.models import KycStatus

            if user.kyc_status != KycStatus.VERIFIED:
                raise KycLevelRequired("KYC complet requis pour cette opération.")
        # NB : contrôle d'âge non appliqué (date de naissance non collectée au MVP).

    def _active_self_exclusion(self, user) -> bool:
        now = timezone.now()
        qs = SelfExclusion.objects.filter(user=user)
        if qs.filter(type=ExclusionType.PERMANENT).exists():
            return True
        return qs.filter(type=ExclusionType.TEMPORARY, until__gt=now).exists()

    def assert_payment_method_allowed(self, user, method: str) -> None:
        """Refuse un moyen de paiement non autorisé par la juridiction (EF17)."""
        juris = self.jurisdiction_of(user)
        if juris and juris.allowed_payment_methods and method:
            if method not in juris.allowed_payment_methods:
                raise JurisdictionForbidden(f"Moyen de paiement non autorisé : {method}.")

    # --- Limites de jeu responsable (EF16) -------------------------------
    def enforce_limits(self, user, action: str, amount: Money) -> None:
        kind = _ACTION_LIMIT.get(action)
        if kind is None:
            return
        for value, period in self._applicable_limits(user, kind):
            used = self._cumulative(user, kind, period)
            if used + amount.amount > value:
                raise LimitExceeded(
                    f"Limite {kind} ({period}) dépassée : {used + amount.amount} > {value}."
                )

    def _applicable_limits(self, user, kind: str):
        now = timezone.now()
        out = []
        for lim in ResponsibleGamblingLimit.objects.filter(
            user=user, kind=kind, effective_at__lte=now
        ):
            out.append((lim.value, lim.period))
        juris = self.jurisdiction_of(user)
        if juris and isinstance(juris.limits, dict):
            by_period = juris.limits.get(kind)
            if isinstance(by_period, dict):
                for period, val in by_period.items():
                    try:
                        out.append((Decimal(str(val)), period))
                    except (TypeError, ValueError, ArithmeticError):
                        continue  # plafond mal saisi → ignoré (pas de 500)
        return out

    def _cumulative(self, user, kind: str, period: str) -> Decimal:
        from wallet.models import Transaction, TxType

        since = timezone.now() - _PERIOD_DELTA.get(period, timedelta(days=1))
        tx_type = TxType.DEPOSIT if kind == LimitKind.DEPOSIT else TxType.BET_LOCK
        total = Transaction.objects.filter(
            user=user, type=tx_type, created_at__gte=since
        ).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        return abs(total)  # BET_LOCK est négatif

    def set_limit(self, user, kind: str, value, period: str = LimitPeriod.DAILY) -> ResponsibleGamblingLimit:
        """Pose une limite : baisse **immédiate**, hausse après délai de réflexion."""
        value = Decimal(str(value))
        now = timezone.now()
        current = (
            ResponsibleGamblingLimit.objects.filter(
                user=user, kind=kind, period=period, effective_at__lte=now
            )
            .order_by("value")
            .first()
        )
        is_increase = current is not None and value > current.value
        if is_increase:
            effective_at = now + timedelta(hours=config.get_int("rg_limit_increase_cooldown_hours"))
        else:
            effective_at = now
        return ResponsibleGamblingLimit.objects.create(
            user=user, kind=kind, period=period, value=value, effective_at=effective_at
        )

    # --- Auto-exclusion ---------------------------------------------------
    def self_exclude(self, user, type: str, until=None) -> SelfExclusion:
        return SelfExclusion.objects.create(user=user, type=type, until=until)

    # --- Rake borné par la juridiction (§14) -----------------------------
    def effective_rake_rate(self, user) -> Decimal:
        rate = config.get_decimal("rake_rate")
        juris = self.jurisdiction_of(user)
        if juris and juris.max_rake is not None:
            rate = min(rate, juris.max_rake)
        return rate

    # --- Reporting régulateur (ossature) ---------------------------------
    def report(self, jurisdiction: str, period: str = LimitPeriod.MONTHLY) -> dict:
        from wallet.models import Transaction, TxType

        since = timezone.now() - _PERIOD_DELTA.get(period, timedelta(days=30))
        deposits = Transaction.objects.filter(type=TxType.DEPOSIT, created_at__gte=since).aggregate(
            s=Sum("amount")
        )["s"] or Decimal("0")
        rake = Transaction.objects.filter(type=TxType.COMMISSION, created_at__gte=since).aggregate(
            s=Sum("amount")
        )["s"] or Decimal("0")
        return {"jurisdiction": jurisdiction, "period": period,
                "deposits": deposits, "rake": rake}
