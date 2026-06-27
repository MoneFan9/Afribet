"""
Test d'intégration **bout-en-bout** de la boucle de pari sûre (objectif itération 1) :
inscription (MFA e-mail) → dépôt sandbox → créer un défi vs IA → résolution → être réglé.
Traverse toutes les couches (accounts, payments, wallet, matchmaking, games).
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from accounts.models import EmailVerificationCode
from accounts.services import AuthService
from core.money import Money
from matchmaking.models import MatchStatus, OpponentType, PairingMode, StakeKind
from matchmaking.resolution import MatchResolutionService
from matchmaking.services import MatchmakingService
from payments.services import PaymentService
from wallet.services import WalletService

User = get_user_model()
XAF = "XAF"
CREDS = dict(phone="+24106999999", email="boucle@example.com", username="boucle", password="motdepasse1")


@pytest.mark.django_db
def test_boucle_de_pari_complete():
    # 1) Inscription + vérification MFA e-mail → compte actif.
    auth = AuthService()
    user = auth.register(**CREDS)
    code = EmailVerificationCode.objects.filter(user=user).latest("created_at").code
    auth.verify_email_code(email=CREDS["email"], code=code)
    user.refresh_from_db()
    assert user.is_active is True

    # 2) Maison (contrepartie vs IA).
    call_command("create_house")

    # 3) Dépôt sandbox → callback confirme → wallet crédité.
    pay = PaymentService()
    intent = pay.deposit(user, Money(5000, XAF), method="momo")["intent"]
    pay.handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "SUCCESS"})
    wallet = WalletService()
    assert wallet.get_balance(user)["real_available"].amount == 5000

    # 4) Créer un défi vs IA (mise verrouillée).
    match = MatchmakingService().create_challenge(
        creator=user, game_key="songo", opponent_type=OpponentType.AI,
        timing_mode="REALTIME", pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.REAL,
        bet_amount=Money(500, XAF), ai_level="VIEUX_SAGE",
    )
    assert match.status == MatchStatus.ACTIVE
    bal = wallet.get_balance(user)
    assert bal["real_available"].amount == 4500 and bal["real_locked"].amount == 500

    # 5) Issue forcée (victoire du joueur) → résolution + rake → être réglé.
    match.game_state = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    match.save(update_fields=["game_state"])
    MatchResolutionService().resolve(match)
    match.refresh_from_db()
    assert match.status == MatchStatus.COMPLETED and match.winner_id == user.id
    assert match.rake_amount == 50  # floor(1000 * 5%)

    # Solde final : 4500 + (pot 1000 − rake 50) = 5450, plus rien de verrouillé.
    final = wallet.get_balance(user)
    assert final["real_available"].amount == 5450
    assert final["real_locked"].amount == 0
