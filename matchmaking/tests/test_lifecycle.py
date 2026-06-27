"""
Tests CU5/CU6/CU8/CU11 — jouer un coup (serveur-autoritaire), résolution + rake,
équité réseau (timeout→pire coup auto, forfait, void, DisconnectPolicy), vs IA.
Conception §6/§7/§8.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from backoffice.models import PlatformConfig
from core.money import Money
from matchmaking.lifecycle import (
    IllegalMove,
    MatchLifecycleService,
    NotYourTurn,
)
from matchmaking.models import EndReason, EventType, MatchStatus, OpponentType, StakeKind
from matchmaking.resolution import MatchResolutionService
from matchmaking.services import MatchmakingService
from wallet.models import TxType
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
    WalletService().credit(u, Money(funds, XAF), TxType.DEPOSIT)
    return u


def _active_p2p(bet=500):
    a, b = _player("life_a"), _player("life_b")
    mm = MatchmakingService()
    m = mm.create_challenge(
        creator=a, game_key="songo", opponent_type=OpponentType.HUMAN,
        timing_mode="REALTIME", pairing_mode="AUTO", stake_kind=StakeKind.REAL,
        bet_amount=Money(bet, XAF),
    )
    m = mm.join_from_lobby(joiner=b, match_id=m.id)
    return m, a, b


def _active_ai(house, bet=500, level="VIEUX_SAGE"):
    p = _player("life_ai")
    m = MatchmakingService().create_challenge(
        creator=p, game_key="songo", opponent_type=OpponentType.AI,
        timing_mode="REALTIME", pairing_mode="AUTO", stake_kind=StakeKind.REAL,
        bet_amount=Money(bet, XAF), ai_level=level,
    )
    return m, p


def _avail(u):
    return WalletService().get_balance(u)["real_available"].amount


def _locked(u):
    return WalletService().get_balance(u)["real_locked"].amount


# --- CU5 : jouer un coup --------------------------------------------------
def test_play_move_journalise_et_alterne():
    from games.base.service import GameService

    m, a, b = _active_p2p()
    life = MatchLifecycleService()
    legal = GameService().legal_moves("songo", m.game_state, 0)
    m2 = life.play_move(match_id=m.id, user=a, move=legal[0])
    assert m2.current_player == 1
    assert m2.moves.count() == 1
    assert m2.moves.first().is_auto is False


def test_play_pas_son_tour():
    m, a, b = _active_p2p()
    with pytest.raises(NotYourTurn):
        MatchLifecycleService().play_move(match_id=m.id, user=b, move=0)


def test_play_coup_illegal():
    m, a, b = _active_p2p()
    with pytest.raises(IllegalMove):
        MatchLifecycleService().play_move(match_id=m.id, user=a, move=7)  # trou adverse


# --- CU6 : résolution + rake ---------------------------------------------
def test_resolution_victoire_regle_escrow(house):
    m, a, b = _active_p2p(bet=500)
    m.game_state = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    m.save(update_fields=["game_state"])
    MatchResolutionService().resolve(m)
    m.refresh_from_db()
    assert m.status == MatchStatus.COMPLETED and m.end_reason == EndReason.WIN
    assert m.winner_id == a.id
    assert m.rake_amount == 50  # floor(1000*0.05)
    assert _avail(a) == 9500 + 950 and _locked(a) == 0  # gain net
    assert _locked(b) == 0
    assert _avail(house) > 0  # rake encaissé


def test_resolution_nul_rembourse(house):
    m, a, b = _active_p2p(bet=500)
    m.game_state = {"plateau": [0] * 14, "greniers": [0, 0], "current_player": 0}  # rareté, égalité
    m.save(update_fields=["game_state"])
    MatchResolutionService().resolve(m)
    m.refresh_from_db()
    assert m.end_reason == EndReason.DRAW and m.winner_id is None
    assert _avail(a) == 10000 and _avail(b) == 10000  # remboursés


# --- CU8 : forfait --------------------------------------------------------
def test_forfait_adversaire_gagne(house):
    m, a, b = _active_p2p()
    MatchLifecycleService().forfeit(match_id=m.id, user=b)
    m.refresh_from_db()
    assert m.status == MatchStatus.COMPLETED and m.end_reason == EndReason.FORFEIT
    assert m.winner_id == a.id
    assert m.events.filter(type=EventType.FORFEIT).exists()


# --- CU8 : timeout → pire coup auto --------------------------------------
def test_timeout_joue_pire_coup_auto():
    m, a, b = _active_p2p()
    m.move_deadline = timezone.now() - timezone.timedelta(seconds=1)
    m.save(update_fields=["move_deadline"])
    life = MatchLifecycleService()
    life.on_move_timeout(match_id=m.id)
    m.refresh_from_db()
    assert m.moves.count() == 1
    auto = m.moves.first()
    assert auto.is_auto is True
    assert m.events.filter(type=EventType.TIMEOUT_AUTOMOVE).exists()


# --- CU8 : panne serveur → void + remboursement --------------------------
def test_void_rembourse_les_deux(house):
    m, a, b = _active_p2p()
    MatchLifecycleService().void_match(match_id=m.id, reason="server_fault")
    m.refresh_from_db()
    assert m.status == MatchStatus.CANCELLED and m.end_reason == EndReason.VOID
    assert _avail(a) == 10000 and _avail(b) == 10000
    assert m.events.filter(type=EventType.VOID).exists()


# --- CU8 : DisconnectPolicy ----------------------------------------------
def test_disconnect_auto_resolve_termine_la_partie(house):
    m, a, b = _active_p2p()
    MatchLifecycleService().on_disconnect_timeout(match_id=m.id, user=a)
    m.refresh_from_db()
    assert m.status == MatchStatus.COMPLETED  # auto-finish → résolu


def test_disconnect_void_refund(house):
    PlatformConfig.objects.create(key="disconnect_policy", value="VOID_REFUND")
    m, a, b = _active_p2p()
    MatchLifecycleService().on_disconnect_timeout(match_id=m.id, user=a)
    m.refresh_from_db()
    assert m.status == MatchStatus.CANCELLED and m.end_reason == EndReason.VOID
    assert _avail(a) == 10000 and _avail(b) == 10000


# --- CU11 : vs IA ---------------------------------------------------------
def test_vs_ia_repond_apres_coup_du_joueur(house):
    from games.base.service import GameService

    m, p = _active_ai(house)
    legal = GameService().legal_moves("songo", m.game_state, 0)
    m2 = MatchLifecycleService().play_move(match_id=m.id, user=p, move=legal[0])
    # Après le coup du joueur, l'IA a répondu (≥2 coups) et la main revient au joueur,
    # ou la partie est terminée.
    assert m2.moves.count() >= 2 or m2.status == MatchStatus.COMPLETED
    if m2.status == MatchStatus.ACTIVE:
        assert m2.current_player == 0


def test_vs_ia_resolution_paye_par_la_maison(house):
    m, p = _active_ai(house)
    house_avant = _avail(house)
    m.game_state = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    m.save(update_fields=["game_state"])
    MatchResolutionService().resolve(m)
    m.refresh_from_db()
    assert m.winner_id == p.id  # le joueur (index 0) gagne
    assert _avail(p) == 9500 + 950
    assert _avail(house) < house_avant + 500  # la Maison a payé le gain (net du rake)
