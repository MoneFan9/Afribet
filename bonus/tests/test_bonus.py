"""
Tests Phase 9 — bonus de bienvenue, jeu virtuel bridé, conversion par tranches (§16,
CU16/CU17, EF5b-5d).
"""
from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import KycStatus
from backoffice.models import PlatformConfig
from bonus.errors import (
    ConversionBelowThreshold,
    GlobalCapReached,
    KycRequired,
    VirtualUsageExceeded,
)
from bonus.models import BonusGrant, BonusType, VirtualUsagePolicy
from bonus.services import BonusService
from core.money import Money
from matchmaking.models import Match, OpponentType, PairingMode, StakeKind, TimingMode
from wallet.models import Pocket, Transaction, TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"


def _user(name="u", kyc=KycStatus.PENDING):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password="x",
                                 is_active=True, kyc_status=kyc)
    WalletService().ensure_wallet(u)
    return u


def _intent(amount):
    return SimpleNamespace(amount=Decimal(amount), currency=XAF)


def _bonus(user):
    return WalletService().get_balance(user)["bonus_available"].amount


# --- CU16 : octroi du bonus de bienvenue ----------------------------------
def test_octroi_au_premier_depot():
    u = _user("b1")
    grant = BonusService().maybe_grant_welcome(u, _intent(5000))  # pct défaut 100 %
    assert grant is not None and grant.type == BonusType.WELCOME
    assert _bonus(u) == 5000
    assert BonusGrant.objects.filter(user=u).count() == 1


def test_octroi_une_seule_fois():
    u = _user("b2")
    svc = BonusService()
    svc.maybe_grant_welcome(u, _intent(5000))
    second = svc.maybe_grant_welcome(u, _intent(8000))  # 2e dépôt → aucun octroi
    assert second is None
    assert _bonus(u) == 5000  # pas de double crédit
    assert BonusGrant.objects.filter(user=u).count() == 1


def test_octroi_via_flux_depot_complet():
    from payments.services import PaymentService

    u = _user("b3")
    intent = PaymentService().deposit(u, Money(5000, XAF))["intent"]
    PaymentService().handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "SUCCESS"})
    # Dépôt crédité en réel + bonus de bienvenue crédité en virtuel (hook).
    bal = WalletService().get_balance(u)
    assert bal["real_available"].amount == 5000 and bal["bonus_available"].amount == 5000


# --- EF5d : bridage de l'usage virtuel ------------------------------------
def _bonus_match(user):
    return Match.objects.create(
        game_key="songo", opponent_type=OpponentType.AI, timing_mode=TimingMode.REALTIME,
        pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.BONUS, bet_amount=500,
        currency=XAF, player_1=user,
    )


def test_quota_matchs_virtuels_par_jour():
    u = _user("vq")
    VirtualUsagePolicy.objects.create(max_matches_per_day=1, active=True)
    _bonus_match(u)  # 1 match aujourd'hui
    with pytest.raises(VirtualUsageExceeded):
        BonusService().check_virtual_usage(u)


def test_cooldown_virtuel():
    u = _user("cd")
    VirtualUsagePolicy.objects.create(max_matches_per_day=0, cooldown_seconds=3600, active=True)
    _bonus_match(u)  # tout récent
    with pytest.raises(VirtualUsageExceeded):
        BonusService().check_virtual_usage(u)


def test_within_hours():
    now = timezone.now().replace(hour=12, minute=0)
    assert BonusService._within_hours(now, "08:00-18:00") is True
    assert BonusService._within_hours(now, "13:00-14:00") is False
    assert BonusService._within_hours(now, "") is True  # permissif


def test_within_hours_plage_de_nuit():
    # Plage chevauchant minuit (22:00-06:00).
    minuit2 = timezone.now().replace(hour=2, minute=0)
    midi = timezone.now().replace(hour=12, minute=0)
    assert BonusService._within_hours(minuit2, "22:00-06:00") is True   # 02h dans la plage
    assert BonusService._within_hours(midi, "22:00-06:00") is False     # 12h hors plage


# --- CU17 : conversion virtuel → réel -------------------------------------
def test_conversion_par_tranches():
    u = _user("cv", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(7_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    res = BonusService().convert_bonus_to_real(u)
    assert res["tranches"] == 3 and res["real_credited"] == 30_000 and res["remainder_virtual"] == 1_000_000
    bal = WalletService().get_balance(u)
    assert bal["bonus_available"].amount == 1_000_000 and bal["real_available"].amount == 30_000
    assert Transaction.objects.filter(user=u, type=TxType.BONUS_CONVERSION).count() == 2


def test_conversion_sous_le_seuil_refuse():
    u = _user("cs", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(1_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    with pytest.raises(ConversionBelowThreshold):
        BonusService().convert_bonus_to_real(u)


def test_conversion_exige_kyc():
    u = _user("ck", kyc=KycStatus.PENDING)
    WalletService().credit(u, Money(4_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    with pytest.raises(KycRequired):
        BonusService().convert_bonus_to_real(u)


def test_conversion_plafond_global():
    PlatformConfig.objects.create(key="bonus_global_conversion_cap", value=10_000)
    u = _user("cg", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(6_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)  # → 30k réel > cap
    with pytest.raises(GlobalCapReached):
        BonusService().convert_bonus_to_real(u)


def test_conversion_plafond_limite_exacte_autorisee():
    # already + real == cap doit PASSER (seul > cap refuse).
    PlatformConfig.objects.create(key="bonus_global_conversion_cap", value=30_000)
    u = _user("cl", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(6_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)  # → 30k pile
    res = BonusService().convert_bonus_to_real(u)
    assert res["real_credited"] == 30_000  # accepté à la limite


def test_poche_close_bloque_un_nouvel_octroi():
    u = _user("pc", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(4_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    BonusService().convert_bonus_to_real(u)  # vide la poche → close
    w = WalletService().ensure_wallet(u); w.refresh_from_db()
    assert w.bonus_pocket_closed is True
    # un nouveau « 1er dépôt » ne ré-octroie pas (poche close à vie)
    assert BonusService().maybe_grant_welcome(u, _intent(5000)) is None
    w.refresh_from_db()
    assert w.bonus_available == 0


def test_conversion_ferme_la_poche_a_zero():
    u = _user("cf", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(4_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)  # 2 tranches pile
    BonusService().convert_bonus_to_real(u)
    w = WalletService().ensure_wallet(u)
    w.refresh_from_db()
    assert w.bonus_available == 0 and w.bonus_pocket_closed is True


# --- API ------------------------------------------------------------------
def test_api_soldes_et_conversion():
    u = _user("api", kyc=KycStatus.VERIFIED)
    WalletService().credit(u, Money(4_000_000, XAF), TxType.BONUS_GRANT, Pocket.BONUS)
    client = APIClient(); client.force_authenticate(u)
    r = client.get("/api/wallet/")
    assert r.status_code == 200 and r.json()["bonus_available"] == 4_000_000
    c = client.post("/api/wallet/convert/", {}, format="json")
    assert c.status_code == 200 and c.json()["tranches"] == 2
