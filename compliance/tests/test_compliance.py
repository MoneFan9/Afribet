"""
Tests Phase 8 — conformité paramétrable & jeu responsable (§13/§14, EF16/EF17).
Principe vérifié : **permissif par défaut**, restrictif seulement une fois configuré.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from accounts.models import KycStatus
from compliance.errors import (
    JurisdictionForbidden,
    KycLevelRequired,
    LimitExceeded,
    SelfExcluded,
)
from compliance.models import (
    ComplianceProfile,
    ExclusionType,
    Jurisdiction,
    KycLevel,
    LimitKind,
    ResponsibleGamblingLimit,
)
from compliance.services import ComplianceService
from core.money import Money
from matchmaking.models import OpponentType, PairingMode, StakeKind
from matchmaking.resolution import MatchResolutionService
from matchmaking.services import MatchmakingService
from payments.services import PaymentService
from wallet.models import TxType
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


def _assign(user, **juris_kwargs):
    j = Jurisdiction.objects.create(country_code=juris_kwargs.pop("country_code", "GA"), **juris_kwargs)
    ComplianceProfile.objects.create(user=user, jurisdiction=j)
    return j


# --- Permissif par défaut --------------------------------------------------
def test_permissif_sans_configuration():
    c = ComplianceService()
    u = _user("perm")
    c.is_allowed(u, "deposit")   # ne lève pas
    c.is_allowed(u, "bet_vs_ai")
    c.enforce_limits(u, "deposit", Money(10_000_000, XAF))  # aucune limite → ok


# --- Juridiction -----------------------------------------------------------
def test_jeu_interdit_par_juridiction():
    u = _user("ji")
    _assign(u, gambling_allowed=False)
    with pytest.raises(JurisdictionForbidden):
        ComplianceService().is_allowed(u, "deposit")


def test_vs_ia_interdit():
    u = _user("vai")
    _assign(u, gambling_allowed=True, vs_ai_allowed=False)
    ComplianceService().is_allowed(u, "bet")  # P2P ok
    with pytest.raises(JurisdictionForbidden):
        ComplianceService().is_allowed(u, "bet_vs_ai")


def test_kyc_full_requis_pour_retrait():
    u = _user("kf", kyc=KycStatus.PENDING)
    _assign(u, kyc_level=KycLevel.FULL)
    with pytest.raises(KycLevelRequired):
        ComplianceService().is_allowed(u, "withdraw")


# --- Auto-exclusion --------------------------------------------------------
def test_auto_exclusion_bloque_depot_et_pari():
    u = _user("ex", funds=10000)
    ComplianceService().self_exclude(u, ExclusionType.PERMANENT)
    with pytest.raises(SelfExcluded):
        PaymentService().deposit(u, Money(1000, XAF))
    with pytest.raises(SelfExcluded):
        MatchmakingService().create_challenge(
            creator=u, game_key="songo", opponent_type=OpponentType.HUMAN,
            timing_mode="REALTIME", pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.REAL,
            bet_amount=Money(500, XAF),
        )


def test_auto_exclusion_temporaire_expiree_nautorise():
    u = _user("ext")
    svc = ComplianceService()
    svc.self_exclude(u, ExclusionType.TEMPORARY, until=timezone.now() - timedelta(hours=1))
    svc.is_allowed(u, "deposit")  # expirée → autorisé


# --- Limites de jeu responsable (EF16) ------------------------------------
def test_limite_depot_depassee():
    u = _user("ld")
    ResponsibleGamblingLimit.objects.create(
        user=u, kind=LimitKind.DEPOSIT, period="DAILY", value=Decimal("3000"),
        effective_at=timezone.now(),
    )
    with pytest.raises(LimitExceeded):
        PaymentService().deposit(u, Money(5000, XAF))


def test_set_limit_baisse_immediate_hausse_differee():
    u = _user("sl")
    svc = ComplianceService()
    l1 = svc.set_limit(u, LimitKind.DEPOSIT, 1000)
    assert l1.effective_at <= timezone.now()
    l2 = svc.set_limit(u, LimitKind.DEPOSIT, 500)   # baisse → immédiate
    assert l2.effective_at <= timezone.now()
    l3 = svc.set_limit(u, LimitKind.DEPOSIT, 2000)  # hausse → différée
    assert l3.effective_at > timezone.now()


# --- Rake borné par la juridiction (§14) ----------------------------------
def test_rake_borne_par_max_rake():
    call_command("create_house")
    a, b = _user("ra", funds=10000), _user("rb", funds=10000)
    _assign(a, country_code="GA", max_rake=Decimal("0.0200"))  # 2 % < 5 % config
    mm = MatchmakingService()
    m = mm.create_challenge(
        creator=a, game_key="songo", opponent_type=OpponentType.HUMAN,
        timing_mode="REALTIME", pairing_mode=PairingMode.AUTO, stake_kind=StakeKind.REAL,
        bet_amount=Money(500, XAF),
    )
    m = mm.join_from_lobby(joiner=b, match_id=m.id)
    m.game_state = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    m.save(update_fields=["game_state"])
    MatchResolutionService().resolve(m)
    m.refresh_from_db()
    assert m.rake_amount == 20  # floor(1000 * 0.02) au lieu de 50


# --- effective_rake_rate par défaut ---------------------------------------
def test_effective_rake_rate_defaut():
    u = _user("er")
    assert ComplianceService().effective_rake_rate(u) == Decimal("0.05")
