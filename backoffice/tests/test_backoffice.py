"""Tests Phase 8 — hub d'exploitation : registre immuable, jeu désactivé, retrait en revue."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from accounts.models import KycStatus
from backoffice.admin import TransactionAdmin
from backoffice.models import GameSetting, PlatformConfig
from core.errors import WalletError
from core.money import Money
from matchmaking.models import OpponentType, PairingMode, StakeKind
from matchmaking.services import GameNotRegistered, MatchmakingService
from payments.services import PaymentService
from wallet.models import Transaction, TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"


def _user(name="u", funds=0, kyc=KycStatus.PENDING):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password="x",
                                 is_active=True, kyc_status=kyc)
    WalletService().ensure_wallet(u)
    if funds:
        WalletService().credit(u, Money(funds, XAF), TxType.DEPOSIT)
    return u


def test_transaction_immuable():
    u = _user("imm", funds=1000)
    tx = Transaction.objects.filter(user=u).first()
    tx.amount = 999999
    with pytest.raises(WalletError):
        tx.save()
    with pytest.raises(WalletError):
        tx.delete()


def test_admins_a_actions_gardent_la_permission_de_modification():
    # Garde-fou : les admins porteurs d'actions (void, approve/reject retrait) doivent
    # garder has_change_permission par défaut, sinon Django masque le menu d'actions.
    from django.contrib import admin as dj_admin

    from backoffice.admin import MatchAdmin, PaymentIntentAdmin
    from payments.models import PaymentIntent

    pa = PaymentIntentAdmin(PaymentIntent, None)
    ro = set(pa.get_readonly_fields(None))
    assert {"amount", "status", "needs_review"} <= ro     # champs non éditables à la main
    assert pa.has_add_permission(None) is False
    assert PaymentIntentAdmin.has_change_permission is dj_admin.ModelAdmin.has_change_permission
    assert MatchAdmin.has_change_permission is dj_admin.ModelAdmin.has_change_permission


def test_transaction_admin_lecture_seule():
    admin = TransactionAdmin(Transaction, None)
    assert admin.has_add_permission(None) is False
    assert admin.has_change_permission(None) is False
    assert admin.has_delete_permission(None) is False


def test_jeu_desactive_refuse_creation():
    GameSetting.objects.create(game_key="songo", enabled=False)
    u = _user("gd", funds=10000)
    with pytest.raises(GameNotRegistered):
        MatchmakingService().create_challenge(
            creator=u, game_key="songo", opponent_type=OpponentType.HUMAN,
            timing_mode="REALTIME", pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.REAL,
            bet_amount=Money(500, XAF),
        )


def test_retrait_au_dessus_du_seuil_passe_en_revue():
    PlatformConfig.objects.create(key="withdrawal_review_threshold", value=1000)
    u = _user("wr", funds=10000, kyc=KycStatus.VERIFIED)
    intent = PaymentService().withdraw(u, Money(5000, XAF), destination="+24106000000")
    assert intent.needs_review is True
