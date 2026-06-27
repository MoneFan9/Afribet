"""
Test d'intégration WebSocket (CU5) — le `MatchConsumer` authentifie (JWT), envoie
l'état initial, applique un coup via la service layer et diffuse le nouvel état.
Couche temps réel de bout en bout (Channels), canal en mémoire pour le test.
"""
from __future__ import annotations

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings

from config.asgi import application
from core.money import Money
from games.base.service import GameService
from matchmaking.models import OpponentType, StakeKind
from matchmaking.services import MatchmakingService
from wallet.models import TxType
from wallet.services import WalletService

User = get_user_model()
INMEM = override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)


@database_sync_to_async
def _setup():
    from accounts.services import issue_tokens

    call_command("create_house")
    a = User.objects.create_user(username="ws_a", email="ws_a@ex.com", password="x", is_active=True)
    b = User.objects.create_user(username="ws_b", email="ws_b@ex.com", password="x", is_active=True)
    for u in (a, b):
        WalletService().ensure_wallet(u)
        WalletService().credit(u, Money(10000, "XAF"), TxType.DEPOSIT)
    mm = MatchmakingService()
    m = mm.create_challenge(
        creator=a, game_key="songo", opponent_type=OpponentType.HUMAN,
        timing_mode="REALTIME", pairing_mode="AUTO", stake_kind=StakeKind.REAL,
        bet_amount=Money(500, "XAF"),
    )
    m = mm.join_from_lobby(joiner=b, match_id=m.id)
    move0 = GameService().legal_moves("songo", m.game_state, 0)[0]
    return {"mid": str(m.id), "token": issue_tokens(a)["access"], "move0": move0}


@pytest.mark.django_db(transaction=True)
@INMEM
async def test_ws_connexion_jouer_et_diffusion():
    data = await _setup()
    comm = WebsocketCommunicator(application, f"/ws/match/{data['mid']}/?token={data['token']}")
    connected, _ = await comm.connect()
    assert connected

    initial = await comm.receive_json_from()
    assert initial["type"] == "state"
    assert initial["current_player"] == 0

    await comm.send_json_to({"action": "play", "move": data["move0"]})
    broadcast = await comm.receive_json_from()
    assert broadcast["type"] == "state"
    assert broadcast["current_player"] == 1  # le tour est passé à l'adversaire
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
@INMEM
async def test_ws_refuse_sans_token():
    data = await _setup()
    comm = WebsocketCommunicator(application, f"/ws/match/{data['mid']}/")
    connected, _ = await comm.connect()
    assert connected is False  # non authentifié → fermeture
