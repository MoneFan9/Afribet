"""
Tests CU2 — recharge sandbox : dépôt PENDING → callback confirme → wallet crédité,
idempotence (callback rejoué), échec sans crédit. Conception §5, ENF8.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.money import Money
from payments.models import Direction, IntentStatus, PaymentIntent
from payments.services import KycRequired, PaymentService
from wallet.models import TxType
from wallet.services import WalletService

User = get_user_model()
pytestmark = pytest.mark.django_db
XAF = "XAF"


def _user(name="j", **kw):
    u = User.objects.create_user(username=name, email=f"{name}@ex.com", password="x", is_active=True, **kw)
    WalletService().ensure_wallet(u)
    return u


def _avail(user):
    return WalletService().get_balance(user)["real_available"].amount


# --- Service ---------------------------------------------------------------
def test_depot_cree_intent_pending_sans_crediter():
    u = _user()
    out = PaymentService().deposit(u, Money(5000, XAF), method="momo")
    intent = out["intent"]
    assert intent.status == IntentStatus.PENDING
    assert intent.external_ref.startswith("SBX-")
    assert _avail(u) == 0  # aucun crédit avant confirmation


def test_callback_succes_credite_le_wallet():
    u = _user()
    intent = PaymentService().deposit(u, Money(5000, XAF))["intent"]
    PaymentService().handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "SUCCESS"})
    intent.refresh_from_db()
    assert intent.status == IntentStatus.SETTLED
    assert _avail(u) == 5000
    assert u.transactions.filter(type=TxType.DEPOSIT).count() == 1


def test_callback_idempotent():
    u = _user()
    intent = PaymentService().deposit(u, Money(5000, XAF))["intent"]
    payload = {"external_ref": intent.external_ref, "status": "SUCCESS"}
    PaymentService().handle_callback("sandbox", payload)
    PaymentService().handle_callback("sandbox", payload)  # rejoué
    assert _avail(u) == 5000  # crédité une seule fois
    assert u.transactions.filter(type=TxType.DEPOSIT).count() == 1


def test_callback_echec_pas_de_credit():
    u = _user()
    intent = PaymentService().deposit(u, Money(5000, XAF))["intent"]
    PaymentService().handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "FAILED"})
    intent.refresh_from_db()
    assert intent.status == IntentStatus.FAILED
    assert _avail(u) == 0


def test_verify_secours_credite():
    u = _user()
    intent = PaymentService().deposit(u, Money(3000, XAF))["intent"]
    PaymentService().verify(intent)  # sandbox optimiste → settle
    assert _avail(u) == 3000


def test_callback_introuvable_leve():
    from payments.services import PaymentError

    with pytest.raises(PaymentError):
        PaymentService().handle_callback("sandbox", {"external_ref": "inexistant", "status": "SUCCESS"})


# --- Retrait (KYC) ---------------------------------------------------------
def test_retrait_exige_kyc():
    u = _user()  # kyc PENDING par défaut
    WalletService().credit(u, Money(10000, XAF), TxType.DEPOSIT)
    with pytest.raises(KycRequired):
        PaymentService().withdraw(u, Money(5000, XAF), destination="+24106000000")


def test_retrait_kyc_ok_reserve_puis_regle():
    from accounts.models import KycStatus

    u = _user("kycok", kyc_status=KycStatus.VERIFIED)
    WalletService().credit(u, Money(10000, XAF), TxType.DEPOSIT)
    intent = PaymentService().withdraw(u, Money(4000, XAF), destination="+24106000000")
    assert _avail(u) == 6000  # réservé
    PaymentService().handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "SUCCESS"})
    intent.refresh_from_db()
    assert intent.status == IntentStatus.SETTLED
    assert _avail(u) == 6000  # débit définitif


def test_verify_ne_regle_jamais_un_retrait():
    from accounts.models import KycStatus

    u = _user("vko", kyc_status=KycStatus.VERIFIED)
    WalletService().credit(u, Money(10000, XAF), TxType.DEPOSIT)
    intent = PaymentService().withdraw(u, Money(4000, XAF), destination="+24106000000")
    PaymentService().verify(intent)  # OUT : verify optimiste ne doit pas régler
    intent.refresh_from_db()
    assert intent.status == IntentStatus.PENDING


def test_retrait_echec_recredite():
    from accounts.models import KycStatus

    u = _user("kycko", kyc_status=KycStatus.VERIFIED)
    WalletService().credit(u, Money(10000, XAF), TxType.DEPOSIT)
    intent = PaymentService().withdraw(u, Money(4000, XAF), destination="+24106000000")
    PaymentService().handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "FAILED"})
    assert _avail(u) == 10000  # re-crédité


# --- API -------------------------------------------------------------------
def test_api_depot_et_callback():
    u = _user("api")
    client = APIClient()
    client.force_authenticate(u)
    r = client.post("/api/payments/deposit/", {"amount": 7000, "method": "momo"}, format="json")
    assert r.status_code == 201, r.content
    ext = r.json()["external_ref"]
    # Webhook public (idempotent).
    cb = APIClient().post(
        "/api/payments/callback/sandbox/", {"external_ref": ext, "status": "SUCCESS"}, format="json"
    )
    assert cb.status_code == 202, cb.content
    assert _avail(u) == 7000
    assert PaymentIntent.objects.filter(user=u, direction=Direction.IN, status=IntentStatus.SETTLED).count() == 1
