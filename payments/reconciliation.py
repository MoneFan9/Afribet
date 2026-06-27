"""
`ReconciliationService` (ossature, conception §13 Finances) — compare le registre
interne aux fonds réels centralisés. Au MVP : contrôle de cohérence interne
(dépôts/retraits réglés vs soldes réels). Le rapprochement bancaire réel est branché
avec les prestataires.
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from wallet.models import Pocket, Transaction, TxType


class ReconciliationService:
    def reconcile_user_real(self, user) -> dict:
        """Vérifie : available_real ≈ Σ(mouvements réels du registre)."""
        from wallet.services import WalletService

        wallet = WalletService().ensure_wallet(user)
        ledger = Transaction.objects.filter(user=user, pocket=Pocket.REAL).aggregate(
            s=Sum("amount")
        )["s"] or Decimal("0")
        available = wallet.available_balance
        return {
            "user": user.id,
            "ledger_sum": ledger,
            "available": available,
            "balanced": ledger == available,
        }

    def deposits_total(self) -> Decimal:
        return Transaction.objects.filter(type=TxType.DEPOSIT).aggregate(s=Sum("amount"))[
            "s"
        ] or Decimal("0")
