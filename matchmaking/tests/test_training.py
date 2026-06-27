"""
Tests EF12 / CU11 « sans enjeu » — mode entraînement vs IA : aucun escrow, aucune
Transaction, IA **adaptative** (point d'entrée du NN), résolution sans règlement.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

from games.base.service import GameService
from matchmaking.lifecycle import MatchLifecycleService
from matchmaking.models import EndReason, MatchStatus
from matchmaking.resolution import MatchResolutionService
from matchmaking.services import MatchmakingService
from wallet.models import Transaction
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def house():
    call_command("create_house")
    return User.objects.get(username="house")


def _player(name="t", funds=0):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password="x", is_active=True)
    WalletService().ensure_wallet(u)
    return u


def test_entrainement_sans_solde_ni_escrow(house):
    # Aucun fonds requis : l'entraînement est accessible sans solde.
    p = _player("train_a", funds=0)
    m = MatchmakingService().create_training_match(creator=p, ai_level="VIEUX_SAGE")
    assert m.is_training is True and m.status == MatchStatus.ACTIVE and m.bet_amount == 0
    bal = WalletService().get_balance(p)
    assert bal["real_locked"].amount == 0  # rien n'est verrouillé
    # Aucune Transaction n'a été écrite pour ce joueur.
    assert Transaction.objects.filter(user=p).count() == 0


def test_entrainement_ia_repond_et_sadapte(house):
    p = _player("train_b")
    m = MatchmakingService().create_training_match(creator=p, ai_level="VIEUX_SAGE")
    legal = GameService().legal_moves("songo", m.game_state, 0)
    m2 = MatchLifecycleService().play_move(match_id=m.id, user=p, move=legal[0])
    # En entraînement, l'IA répond ET le profil adverse est appris (NN actif).
    assert m2.moves.count() >= 2 or m2.status == MatchStatus.COMPLETED
    if m2.status == MatchStatus.ACTIVE:
        assert m2.ai_profile is not None and m2.ai_profile["total_moves"] >= 1


def test_resolution_entrainement_sans_mouvement_financier(house):
    p = _player("train_c")
    m = MatchmakingService().create_training_match(creator=p, ai_level="VIEUX_SAGE")
    m.game_state = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    m.save(update_fields=["game_state"])
    MatchResolutionService().resolve(m)
    m.refresh_from_db()
    assert m.status == MatchStatus.COMPLETED and m.end_reason == EndReason.WIN
    assert m.winner_id == p.id and m.rake_amount == 0
    # Toujours aucune Transaction (ni règlement, ni rake).
    assert Transaction.objects.filter(user=p).count() == 0


def test_forfait_entrainement_sans_transaction(house):
    p = _player("train_ff")
    m = MatchmakingService().create_training_match(creator=p, ai_level="VIEUX_SAGE")
    MatchLifecycleService().forfeit(match_id=m.id, user=p)
    m.refresh_from_db()
    assert m.status == MatchStatus.COMPLETED and m.end_reason == EndReason.FORFEIT
    assert Transaction.objects.filter(user=p).count() == 0  # le joueur n'a aucun mouvement
    assert Transaction.objects.filter(match_id=m.id).count() == 0  # aucun règlement pour ce match


def test_void_entrainement_sans_transaction(house):
    p = _player("train_void")
    m = MatchmakingService().create_training_match(creator=p, ai_level="VIEUX_SAGE")
    MatchLifecycleService().void_match(match_id=m.id, reason="server_fault")
    m.refresh_from_db()
    assert m.status == MatchStatus.CANCELLED and m.end_reason == EndReason.VOID
    assert Transaction.objects.filter(user=p).count() == 0


def test_api_training(house):
    p = _player("train_api")
    client = APIClient(); client.force_authenticate(p)
    r = client.post("/api/matches/training/", {"ai_level": "VIEUX_SAGE"}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["is_training"] is True
