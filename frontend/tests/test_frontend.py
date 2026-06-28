"""
Tests du front (Phase 10) — rendu des pages server-rendered + flux d'auth web +
actions (dépôt, entraînement, accès match). Test client Django.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client

from accounts.models import EmailVerificationCode, KycStatus
from core.money import Money
from matchmaking.models import OpponentType, PairingMode, StakeKind
from matchmaking.services import MatchmakingService
from wallet.models import TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"
PWD = "motdepasse1"


def _user(name="u", funds=0, kyc=KycStatus.PENDING):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password=PWD,
                                 is_active=True, kyc_status=kyc)
    WalletService().ensure_wallet(u)
    if funds:
        WalletService().credit(u, Money(funds, XAF), TxType.DEPOSIT)
    return u


# --- Pages publiques -------------------------------------------------------
def test_landing_200():
    assert Client().get("/").status_code == 200


def test_register_get_200():
    assert Client().get("/register/").status_code == 200


def test_login_get_200():
    assert Client().get("/login/").status_code == 200


# --- Flux d'inscription web complet ---------------------------------------
def test_inscription_verification_connecte():
    c = Client()
    r = c.post("/register/", {"phone": "+24107000001", "email": "web@ex.com",
                              "username": "webuser", "password": PWD})
    assert r.status_code == 302 and r.url == "/verify/"
    user = User.objects.get(email="web@ex.com")
    code = EmailVerificationCode.objects.filter(user=user).latest("created_at").code
    r2 = c.post("/verify/", {"email": "web@ex.com", "code": code})
    assert r2.status_code == 302 and r2.url == "/dashboard/"
    # Session authentifiée → dashboard accessible.
    assert c.get("/dashboard/").status_code == 200


# --- Accès protégé ---------------------------------------------------------
def test_dashboard_exige_connexion():
    r = Client().get("/dashboard/")
    assert r.status_code == 302 and "/login/" in r.url


def test_dashboard_connecte_200():
    u = _user("dash")
    c = Client(); c.force_login(u)
    assert c.get("/dashboard/").status_code == 200


# --- Portefeuille : dépôt (sandbox auto-confirmé) -------------------------
def test_wallet_depot_credite():
    u = _user("wal")
    c = Client(); c.force_login(u)
    assert c.get("/wallet/").status_code == 200
    c.post("/wallet/", {"action": "deposit", "amount": 5000, "method": "momo"})
    assert WalletService().get_balance(u)["real_available"].amount == 5000


# --- Lobby + entraînement --------------------------------------------------
def test_lobby_200():
    u = _user("lob")
    c = Client(); c.force_login(u)
    assert c.get("/lobby/").status_code == 200


def test_entrainement_redirige_vers_le_plateau():
    call_command("create_house")
    u = _user("tr")
    c = Client(); c.force_login(u)
    r = c.post("/train/")
    assert r.status_code == 302 and r.url.startswith("/match/")
    assert c.get(r.url).status_code == 200  # plateau accessible


# --- Plateau : accès réservé aux participants -----------------------------
def test_match_non_participant_refuse():
    b = _user("mb", funds=10000)
    other = _user("mo")
    m = MatchmakingService().create_challenge(
        creator=b, game_key="songo", opponent_type=OpponentType.HUMAN,
        timing_mode="REALTIME", pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.REAL,
        bet_amount=Money(500, XAF),
    )
    c = Client(); c.force_login(other)
    r = c.get(f"/match/{m.id}/")
    assert r.status_code == 302 and r.url == "/dashboard/"  # accès refusé
