"""
Tests du cœur financier (ENF1) : escrow atomique, rake, invariants du registre,
anti-double-dépense. Conception §4.
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum

from core.errors import InsufficientFunds
from core.money import Money
from wallet.models import Pocket, Transaction, TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"


def _user(name: str):
    return User.objects.create_user(username=name, email=f"{name}@ex.com", password="x")


def _svc_with_funds(name: str, montant: int, pocket=Pocket.REAL):
    svc = WalletService()
    u = _user(name)
    svc.ensure_wallet(u)
    if montant:
        svc.credit(u, Money(montant, XAF), TxType.DEPOSIT, pocket)
    return svc, u


def _avail(user, pocket=Pocket.REAL) -> Decimal:
    return WalletService().get_balance(user)[
        "real_available" if pocket == Pocket.REAL else "bonus_available"
    ].amount


def _total(user) -> Decimal:
    b = WalletService().get_balance(user)
    return sum(m.amount for m in b.values())


# --- Base -----------------------------------------------------------------
def test_ensure_wallet_zero_xaf():
    u = _user("a")
    w = WalletService().ensure_wallet(u)
    assert w.currency == XAF
    assert w.available_balance == 0 and w.locked_balance == 0


def test_credit_depot_ecrit_transaction():
    svc, u = _svc_with_funds("dep", 1000)
    assert _avail(u) == 1000
    tx = Transaction.objects.get(user=u, type=TxType.DEPOSIT)
    assert tx.amount == 1000 and tx.balance_after == 1000 and tx.pocket == Pocket.REAL


# --- Verrou de mise -------------------------------------------------------
def test_lock_funds_deplace_vers_locked():
    svc, u = _svc_with_funds("lock", 1000)
    svc.lock_funds(u, Money(400, XAF), Pocket.REAL)
    b = svc.get_balance(u)
    assert b["real_available"].amount == 600 and b["real_locked"].amount == 400


def test_lock_funds_insuffisant_refuse():
    svc, u = _svc_with_funds("poor", 100)
    with pytest.raises(InsufficientFunds):
        svc.lock_funds(u, Money(500, XAF), Pocket.REAL)
    assert _avail(u) == 100  # inchangé


def test_anti_double_depense():
    # Deux verrous successifs ne peuvent pas dépasser le disponible.
    svc, u = _svc_with_funds("dd", 500)
    svc.lock_funds(u, Money(300, XAF), Pocket.REAL)
    with pytest.raises(InsufficientFunds):
        svc.lock_funds(u, Money(300, XAF), Pocket.REAL)  # il ne reste que 200
    assert _avail(u) == 200


# --- Règlement (rake, conservation) --------------------------------------
def test_settle_escrow_p2p_rake_et_conservation():
    svc = WalletService()
    win, lose = _user("win"), _user("lose")
    house = _user("house")
    for u in (win, lose, house):
        svc.ensure_wallet(u)
    svc.credit(win, Money(1000, XAF), TxType.DEPOSIT)
    svc.credit(lose, Money(1000, XAF), TxType.DEPOSIT)
    stake = Money(500, XAF)
    svc.lock_funds(win, stake, Pocket.REAL, match_id=None)
    svc.lock_funds(lose, stake, Pocket.REAL, match_id=None)

    total_avant = _total(win) + _total(lose) + _total(house)
    res = svc.settle_escrow(
        match_id=None, winner=win, loser=lose, stake=stake,
        pocket=Pocket.REAL, house=house, rake_rate=Decimal("0.05"),
    )
    # pot=1000, rake=floor(1000*0.05)=50, payout=950
    assert res["rake"] == Money(50, XAF) and res["payout"] == Money(950, XAF)
    bw = svc.get_balance(win)
    assert bw["real_locked"].amount == 0
    assert bw["real_available"].amount == 500 + 950  # reste 500 + gain net
    assert _avail(house) == 50  # rake
    assert svc.get_balance(lose)["real_locked"].amount == 0
    # Conservation : rien créé ni détruit (le rake reste dans le système).
    assert _total(win) + _total(lose) + _total(house) == total_avant


def test_rake_floor():
    svc = WalletService()
    win, lose, house = _user("w2"), _user("l2"), _user("h2")
    for u in (win, lose, house):
        svc.ensure_wallet(u)
    svc.credit(win, Money(333, XAF), TxType.DEPOSIT)
    svc.credit(lose, Money(333, XAF), TxType.DEPOSIT)
    stake = Money(333, XAF)
    svc.lock_funds(win, stake, Pocket.REAL)
    svc.lock_funds(lose, stake, Pocket.REAL)
    res = svc.settle_escrow(
        match_id=None, winner=win, loser=lose, stake=stake,
        pocket=Pocket.REAL, house=house, rake_rate=Decimal("0.05"),
    )
    # pot=666, 666*0.05=33.3 -> floor 33
    assert res["rake"] == Money(33, XAF)


def test_pas_de_rake_en_poche_bonus():
    svc = WalletService()
    win, lose, house = _user("wb"), _user("lb"), _user("hb")
    for u in (win, lose, house):
        svc.ensure_wallet(u)
    svc.credit(win, Money(1000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    svc.credit(lose, Money(1000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    stake = Money(500, XAF)
    svc.lock_funds(win, stake, Pocket.BONUS)
    svc.lock_funds(lose, stake, Pocket.BONUS)
    res = svc.settle_escrow(
        match_id=None, winner=win, loser=lose, stake=stake,
        pocket=Pocket.BONUS, house=house, rake_rate=Decimal("0.05"),
    )
    assert res["rake"] == Money(0, XAF)  # jamais de rake en virtuel
    assert _avail(house) == 0
    assert svc.get_balance(win)["bonus_available"].amount == 500 + 1000


# --- Remboursement --------------------------------------------------------
def test_refund_escrow_nul():
    svc = WalletService()
    a, b = _user("ra"), _user("rb")
    for u in (a, b):
        svc.ensure_wallet(u)
    svc.credit(a, Money(800, XAF), TxType.DEPOSIT)
    svc.credit(b, Money(800, XAF), TxType.DEPOSIT)
    stake = Money(300, XAF)
    svc.lock_funds(a, stake, Pocket.REAL)
    svc.lock_funds(b, stake, Pocket.REAL)
    svc.refund_escrow(match_id=None, entries=[(a, stake), (b, stake)], pocket=Pocket.REAL)
    for u in (a, b):
        bal = svc.get_balance(u)
        assert bal["real_locked"].amount == 0 and bal["real_available"].amount == 800


# --- Invariant registre ---------------------------------------------------
def test_invariant_available_egale_somme_transactions():
    svc, u = _svc_with_funds("inv", 1000)
    svc.lock_funds(u, Money(400, XAF), Pocket.REAL)
    somme = (
        Transaction.objects.filter(user=u, pocket=Pocket.REAL).aggregate(s=Sum("amount"))["s"]
    )
    # available = somme des mouvements de la poche réelle.
    assert _avail(u) == somme == 600


# --- Retrait (réservation / re-crédit) -----------------------------------
def test_reserve_et_credit_back():
    svc, u = _svc_with_funds("pay", 1000)
    svc.reserve_for_payout(u, Money(400, XAF), reference="wd1")
    assert _avail(u) == 600
    svc.credit_back(u, Money(400, XAF), reference="wd1-failed")
    assert _avail(u) == 1000


def test_reserve_insuffisant_refuse():
    svc, u = _svc_with_funds("pr", 100)
    with pytest.raises(InsufficientFunds):
        svc.reserve_for_payout(u, Money(500, XAF))
    assert _avail(u) == 100


def test_credit_montant_non_positif_refuse():
    from core.errors import WalletError

    svc, u = _svc_with_funds("np", 0)
    with pytest.raises(WalletError):
        svc.credit(u, Money(0, XAF), TxType.DEPOSIT)
    with pytest.raises(WalletError):
        svc.lock_funds(u, Money(0, XAF), Pocket.REAL)


# --- Règlement vs-IA (Maison gagnante / perdante) — chemin MVP critique ---
def _setup_vs_ia(player_funds=10000, house_funds=100000, stake=500):
    svc = WalletService()
    p = _user("ia_p")
    house = _user("ia_house")
    svc.ensure_wallet(p)
    svc.ensure_wallet(house)
    svc.credit(p, Money(player_funds, XAF), TxType.DEPOSIT)
    svc.credit(house, Money(house_funds, XAF), TxType.HOUSE_SETTLEMENT)
    s = Money(stake, XAF)
    svc.lock_funds(p, s, Pocket.REAL)
    svc.lock_funds(house, s, Pocket.REAL)
    return svc, p, house, s


def test_settle_vs_ia_joueur_gagne():
    svc, p, house, s = _setup_vs_ia()
    total_avant = _total(p) + _total(house)
    res = svc.settle_escrow(match_id=None, winner=p, loser=house, stake=s,
                            pocket=Pocket.REAL, house=house, rake_rate=Decimal("0.05"))
    assert res["rake"] == Money(50, XAF)
    assert svc.get_balance(p)["real_available"].amount == 9500 + 950
    assert svc.get_balance(p)["real_locked"].amount == 0
    # Conservation globale (la Maison perd net 450, encaisse 50 de rake).
    assert _total(p) + _total(house) == total_avant


def test_settle_vs_ia_maison_gagne():
    svc, p, house, s = _setup_vs_ia()
    total_avant = _total(p) + _total(house)
    # Maison gagnante : elle est à la fois winner ET bénéficiaire du rake (même wallet).
    res = svc.settle_escrow(match_id=None, winner=house, loser=p, stake=s,
                            pocket=Pocket.REAL, house=house, rake_rate=Decimal("0.05"))
    assert svc.get_balance(p)["real_locked"].amount == 0
    assert svc.get_balance(house)["real_locked"].amount == 0
    # La Maison récupère le pot entier (payout 950 + rake 50 = 1000), le joueur perd sa mise.
    assert svc.get_balance(p)["real_available"].amount == 9500
    assert _total(p) + _total(house) == total_avant
    assert res["pot"] == Money(1000, XAF)
