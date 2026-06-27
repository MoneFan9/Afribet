"""
Tests CU3/CU3b/CU4/CU4b — création de défi (vs IA / AUTO / CODE), lobby, jointure,
appariement automatique, annulation. Conception §3-3b. Escrow d'engagement cohérent.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from core.errors import InsufficientFunds
from core.money import Money
from matchmaking.models import MatchStatus, OpponentType, PairingMode, StakeKind, TimingMode
from matchmaking.services import (
    BetOutOfBounds,
    CannotJoinOwnChallenge,
    InvalidAccessCode,
    MatchmakingError,
    MatchmakingService,
)
from wallet.models import Pocket, TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"


@pytest.fixture
def house():
    call_command("create_house")
    return User.objects.get(username="house")


def _player(name, funds=10000):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password="x", is_active=True)
    WalletService().ensure_wallet(u)
    if funds:
        WalletService().credit(u, Money(funds, XAF), TxType.DEPOSIT)
    return u


def _create(creator, **kw):
    defaults = dict(
        creator=creator,
        game_key="songo",
        opponent_type=OpponentType.HUMAN,
        timing_mode=TimingMode.REALTIME,
        pairing_mode=PairingMode.AUTO,
        stake_kind=StakeKind.REAL,
        bet_amount=Money(500, XAF),
    )
    defaults.update(kw)
    return MatchmakingService().create_challenge(**defaults)


def _locked(user, pocket=Pocket.REAL):
    return WalletService().get_balance(user)[
        "real_locked" if pocket == Pocket.REAL else "bonus_locked"
    ].amount


# --- CU3 : création --------------------------------------------------------
def test_create_vs_ia_demarre_actif(house):
    p = _player("p1")
    m = _create(p, opponent_type=OpponentType.AI)
    assert m.status == MatchStatus.ACTIVE
    assert m.player_2_id == house.id
    assert m.game_state is not None and m.game_state["plateau"] == [5] * 14
    assert m.current_player == 0
    assert _locked(p) == 500 and _locked(house) == 500  # les deux mises verrouillées


def test_create_auto_reste_pending_et_liste():
    p = _player("p2")
    m = _create(p)
    assert m.status == MatchStatus.PENDING
    assert _locked(p) == 500
    ouverts = MatchmakingService().list_open_challenges(game_key="songo")
    assert m.id in [x.id for x in ouverts]


def test_create_code_prive_non_liste():
    p = _player("p3")
    m = _create(p, pairing_mode=PairingMode.INVITE_CODE)
    assert m.status == MatchStatus.PENDING
    assert m.access_code and len(m.access_code) == 8
    assert m.id not in [x.id for x in MatchmakingService().list_open_challenges()]


def test_mise_hors_bornes():
    p = _player("p4")
    with pytest.raises(BetOutOfBounds):
        _create(p, bet_amount=Money(10, XAF))  # < bet_min (100)


def test_solde_insuffisant():
    p = _player("p5", funds=100)
    with pytest.raises(InsufficientFunds):
        _create(p, bet_amount=Money(500, XAF))


# --- CU4 : rejoindre depuis le lobby --------------------------------------
def test_join_from_lobby_demarre():
    a, b = _player("a"), _player("b")
    m = _create(a)
    started = MatchmakingService().join_from_lobby(joiner=b, match_id=m.id)
    assert started.status == MatchStatus.ACTIVE
    assert started.player_2_id == b.id
    assert started.game_state is not None
    assert _locked(a) == 500 and _locked(b) == 500


def test_cannot_join_own():
    a = _player("ao")
    m = _create(a)
    with pytest.raises(CannotJoinOwnChallenge):
        MatchmakingService().join_from_lobby(joiner=a, match_id=m.id)


# --- CU4b : rejoindre par code --------------------------------------------
def test_join_by_code_invalide_le_code():
    a, b = _player("ca"), _player("cb")
    m = _create(a, pairing_mode=PairingMode.INVITE_CODE)
    code = m.access_code
    started = MatchmakingService().join_by_code(joiner=b, access_code=code)
    assert started.status == MatchStatus.ACTIVE
    started.refresh_from_db()
    assert started.access_code is None  # usage unique


def test_join_by_code_expire():
    a, b = _player("ea"), _player("eb")
    m = _create(a, pairing_mode=PairingMode.INVITE_CODE)
    m.access_code_expires_at = timezone.now() - timezone.timedelta(minutes=1)
    m.save(update_fields=["access_code_expires_at"])
    with pytest.raises(InvalidAccessCode):
        MatchmakingService().join_by_code(joiner=b, access_code=m.access_code)


# --- CU3b : appariement automatique ---------------------------------------
def test_auto_pair_jamais_contre_soi_meme():
    # Un même joueur crée deux défis AUTO identiques : il ne doit PAS s'affronter.
    a = _player("solo", funds=10000)
    m1 = _create(a)
    m2 = _create(a)
    paired = MatchmakingService().auto_pair()
    assert paired == []
    m1.refresh_from_db(); m2.refresh_from_db()
    assert m1.status == MatchStatus.PENDING and m2.status == MatchStatus.PENDING


def test_auto_pair_relie_deux_createurs():
    a, b = _player("pa"), _player("pb")
    ma = _create(a)
    mb = _create(b)
    paired = MatchmakingService().auto_pair()
    ma.refresh_from_db()
    mb.refresh_from_db()
    assert ma.id in paired
    assert ma.status == MatchStatus.ACTIVE
    assert {ma.player_1_id, ma.player_2_id} == {a.id, b.id}
    assert mb.status == MatchStatus.CANCELLED
    # Escrow cohérent : chacun a exactement une mise verrouillée.
    assert _locked(a) == 500 and _locked(b) == 500


# --- Annulation / régénération --------------------------------------------
def test_cancel_rembourse():
    a = _player("xa")
    m = _create(a)
    MatchmakingService().cancel_challenge(creator=a, match_id=m.id)
    m.refresh_from_db()
    assert m.status == MatchStatus.CANCELLED
    assert _locked(a) == 0
    assert WalletService().get_balance(a)["real_available"].amount == 10000


def test_regenerate_code_change_le_code():
    a = _player("rc")
    m = _create(a, pairing_mode=PairingMode.INVITE_CODE)
    ancien = m.access_code
    m2 = MatchmakingService().regenerate_code(creator=a, match_id=m.id)
    assert m2.access_code != ancien


def test_cancel_par_non_createur_refuse():
    a, b = _player("nc_a"), _player("nc_b")
    m = _create(a)
    with pytest.raises(MatchmakingError):
        MatchmakingService().cancel_challenge(creator=b, match_id=m.id)
    m.refresh_from_db()
    assert m.status == MatchStatus.PENDING  # inchangé


def test_regenerate_par_non_createur_refuse():
    a, b = _player("ng_a"), _player("ng_b")
    m = _create(a, pairing_mode=PairingMode.INVITE_CODE)
    with pytest.raises(MatchmakingError):
        MatchmakingService().regenerate_code(creator=b, match_id=m.id)


def test_code_usage_unique_rejette_seconde_jointure():
    a, b, c = _player("u_a"), _player("u_b"), _player("u_c")
    m = _create(a, pairing_mode=PairingMode.INVITE_CODE)
    code = m.access_code
    MatchmakingService().join_by_code(joiner=b, access_code=code)
    with pytest.raises(InvalidAccessCode):
        MatchmakingService().join_by_code(joiner=c, access_code=code)  # code déjà consommé
