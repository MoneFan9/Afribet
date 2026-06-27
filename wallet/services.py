"""
`WalletService` (couche contrôle, ENF1) — escrow et règlements **atomiques**.

Invariants tenus :
- Toute opération multi-wallet s'exécute dans **une transaction DB** avec
  `select_for_update` (verrou pessimiste, ordre déterministe → pas de double dépense,
  pas d'interblocage).
- Chaque mouvement écrit une `Transaction` immuable (poche + `balance_after`).
- **Rake uniquement en poche réelle** ; jamais en virtuel.
- Aucun solde ne devient négatif (sinon `InsufficientFunds`).
"""
from __future__ import annotations

from decimal import ROUND_DOWN, Decimal

from django.conf import settings
from django.db import transaction

from core import config
from core.errors import InsufficientFunds, WalletError
from core.money import Money

from .models import Pocket, Transaction, TxStatus, TxType, Wallet

# Champs (disponible, verrouillé) par poche.
_FIELDS = {
    Pocket.REAL: ("available_balance", "locked_balance"),
    Pocket.BONUS: ("bonus_available", "bonus_locked"),
}


def _avail_field(pocket: str) -> str:
    return _FIELDS[pocket][0]


def _locked_field(pocket: str) -> str:
    return _FIELDS[pocket][1]


class WalletService:
    # --- Cycle de vie -----------------------------------------------------
    def ensure_wallet(self, user) -> Wallet:
        """Crée (si absent) le wallet XAF à zéro du joueur (postcondition CU1)."""
        wallet, _ = Wallet.objects.get_or_create(
            user=user, defaults={"currency": settings.DEFAULT_CURRENCY}
        )
        return wallet

    def get_balance(self, user) -> dict[str, Money]:
        w = self.ensure_wallet(user)
        return {
            "real_available": w.available(Pocket.REAL),
            "real_locked": w.locked(Pocket.REAL),
            "bonus_available": w.available(Pocket.BONUS),
            "bonus_locked": w.locked(Pocket.BONUS),
        }

    # --- Primitives internes ---------------------------------------------
    @staticmethod
    def _add(wallet: Wallet, field: str, delta: Money) -> Money:
        current = wallet.money(field)
        new = current + delta  # garde-fou devise (Money)
        if new.is_negative:
            raise InsufficientFunds(f"Solde {field} insuffisant.")
        setattr(wallet, field, new.amount)
        return new

    @staticmethod
    def _write_tx(
        wallet: Wallet,
        tx_type: str,
        pocket: str,
        amount: Money,
        balance_after: Money,
        *,
        status: str = TxStatus.SETTLED,
        match_id=None,
        reference: str = "",
    ) -> Transaction:
        return Transaction.objects.create(
            wallet=wallet,
            user_id=wallet.user_id,
            type=tx_type,
            pocket=pocket,
            amount=amount.amount,
            currency=amount.currency,
            balance_after=balance_after.amount,
            status=status,
            match_id=match_id,
            reference=reference,
        )

    def _lock_wallets(self, users) -> dict:
        """Verrouille les wallets dans un ordre stable (par id) — anti-interblocage."""
        ids = {u.id for u in users}
        rows = Wallet.objects.select_for_update().filter(user_id__in=ids).order_by("id")
        by_user = {w.user_id: w for w in rows}
        missing = ids - set(by_user)
        if missing:
            raise WalletError(f"Wallet absent pour {missing}.")
        return by_user

    def _compute_rake(self, pot: Money, pocket: str, rake_rate: Decimal | None) -> Money:
        if pocket != Pocket.REAL:  # jamais de rake en virtuel
            return Money.zero(pot.currency)
        rate = rake_rate if rake_rate is not None else config.get_decimal("rake_rate")
        floored = (pot.amount * rate).quantize(Decimal("1"), rounding=ROUND_DOWN)
        return Money(floored, pot.currency)

    # --- Crédit simple (dépôt, octroi, ...) ------------------------------
    @transaction.atomic
    def credit(
        self, user, amount: Money, tx_type: str, pocket: str = Pocket.REAL, *, match_id=None, reference: str = ""
    ) -> Transaction:
        if not amount.is_positive:
            raise WalletError("Le crédit doit être strictement positif.")
        wallet = Wallet.objects.select_for_update().get(user=user)
        new = self._add(wallet, _avail_field(pocket), amount)
        wallet.save()
        return self._write_tx(wallet, tx_type, pocket, amount, new, match_id=match_id, reference=reference)

    # --- Escrow : verrou de mise -----------------------------------------
    @transaction.atomic
    def lock_funds(self, user, amount: Money, pocket: str, *, match_id=None) -> Transaction:
        """`available → locked` dans la poche (création/join d'un défi, CU3/CU4)."""
        if not amount.is_positive:
            raise WalletError("La mise doit être strictement positive.")
        wallet = Wallet.objects.select_for_update().get(user=user)
        if wallet.available(pocket) < amount:
            raise InsufficientFunds("Solde disponible insuffisant pour la mise.")
        new_avail = self._add(wallet, _avail_field(pocket), -amount)
        self._add(wallet, _locked_field(pocket), amount)
        wallet.save()
        return self._write_tx(wallet, TxType.BET_LOCK, pocket, -amount, new_avail, match_id=match_id)

    # --- Escrow : règlement gagnant/perdant ------------------------------
    @transaction.atomic
    def settle_escrow(
        self, *, match_id, winner, loser, stake: Money, pocket: str, house, rake_rate: Decimal | None = None
    ) -> dict:
        """Résout l'escrow d'un match (CU6). `locked` des deux → gagnant net du rake.

        `winner`/`loser` peuvent inclure la **Maison** (vs IA) : elle a un wallet.
        """
        wallets = self._lock_wallets([winner, loser, house])
        w_win, w_lose, w_house = wallets[winner.id], wallets[loser.id], wallets[house.id]
        lf = _locked_field(pocket)

        # Libère les mises verrouillées des deux camps.
        self._add(w_win, lf, -stake)
        self._add(w_lose, lf, -stake)

        pot = stake * 2
        rake = self._compute_rake(pot, pocket, rake_rate)
        payout = pot - rake

        new_win_avail = self._add(w_win, _avail_field(pocket), payout)
        w_win.save()
        if w_lose.pk != w_win.pk:
            w_lose.save()
        self._write_tx(w_win, TxType.BET_WIN, pocket, payout, new_win_avail, match_id=match_id)

        if rake.is_positive:
            new_house = self._add(w_house, "available_balance", rake)  # rake toujours réel
            w_house.save()
            self._write_tx(w_house, TxType.COMMISSION, Pocket.REAL, rake, new_house, match_id=match_id)
        elif w_house.pk not in (w_win.pk, w_lose.pk):
            w_house.save()

        return {"pot": pot, "rake": rake, "payout": payout}

    # --- Escrow : remboursement (nul, void, faute serveur) ----------------
    @transaction.atomic
    def refund_escrow(self, *, match_id, entries: list[tuple], pocket: str) -> None:
        """`locked → available` pour chaque (user, stake) — nul/void (CU6/CU8)."""
        users = [u for (u, _) in entries]
        wallets = self._lock_wallets(users)
        for user, stake in entries:
            w = wallets[user.id]
            self._add(w, _locked_field(pocket), -stake)
            new_avail = self._add(w, _avail_field(pocket), stake)
            w.save()
            self._write_tx(w, TxType.REFUND, pocket, stake, new_avail, match_id=match_id)

    # --- Retrait (réservation / re-crédit) — utilisé en Phase 5/7 ---------
    @transaction.atomic
    def reserve_for_payout(self, user, amount: Money, *, reference: str = "") -> Transaction:
        wallet = Wallet.objects.select_for_update().get(user=user)
        if wallet.available(Pocket.REAL) < amount:
            raise InsufficientFunds("Solde insuffisant pour le retrait.")
        new_avail = self._add(wallet, "available_balance", -amount)
        wallet.save()
        return self._write_tx(
            wallet, TxType.WITHDRAWAL, Pocket.REAL, -amount, new_avail,
            status=TxStatus.PENDING, reference=reference,
        )

    @transaction.atomic
    def credit_back(self, user, amount: Money, *, reference: str = "") -> Transaction:
        """Re-crédite la poche réelle après un payout échoué (CU7)."""
        wallet = Wallet.objects.select_for_update().get(user=user)
        new_avail = self._add(wallet, "available_balance", amount)
        wallet.save()
        return self._write_tx(wallet, TxType.REFUND, Pocket.REAL, amount, new_avail, reference=reference)
