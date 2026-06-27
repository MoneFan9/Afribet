"""Tests CU1 — inscription, MFA e-mail, KYC différé, JWT. Couche service + API."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import EmailVerificationCode, KycStatus
from accounts.services import (
    AuthService,
    CodeExpired,
    InvalidCode,
    PhoneAlreadyUsed,
    RegistrationError,
)

User = get_user_model()
LOCMEM = override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")

VALID = dict(phone="+24106000001", email="joueur@example.com", username="joueur", password="motdepasse1")


def _latest_code(user) -> str:
    return EmailVerificationCode.objects.filter(user=user).latest("created_at").code


@pytest.mark.django_db
@LOCMEM
def test_register_cree_compte_inactif_et_envoie_code(django_capture_on_commit_callbacks):
    # L'e-mail est envoyé via transaction.on_commit → on capture/exécute les callbacks.
    with django_capture_on_commit_callbacks(execute=True):
        user = AuthService().register(**VALID)
    assert user.is_active is False
    assert user.kyc_status == KycStatus.PENDING  # KYC différé
    assert user.phone_number == VALID["phone"]
    assert EmailVerificationCode.objects.filter(user=user).count() == 1
    assert len(mail.outbox) == 1
    assert _latest_code(user) in mail.outbox[0].body


@pytest.mark.django_db
@LOCMEM
def test_register_telephone_unique():
    AuthService().register(**VALID)
    dup = dict(VALID, email="autre@example.com", username="autre")
    with pytest.raises(PhoneAlreadyUsed):
        AuthService().register(**dup)


@pytest.mark.django_db
@LOCMEM
def test_verify_active_le_compte_et_renvoie_jwt():
    svc = AuthService()
    user = svc.register(**VALID)
    result = svc.verify_email_code(email=VALID["email"], code=_latest_code(user))
    user.refresh_from_db()
    assert user.is_active is True
    assert "access" in result["tokens"] and "refresh" in result["tokens"]


@pytest.mark.django_db
@LOCMEM
def test_verify_code_incorrect_incremente_tentatives():
    svc = AuthService()
    user = svc.register(**VALID)
    with pytest.raises(InvalidCode):
        svc.verify_email_code(email=VALID["email"], code="000000")
    entry = EmailVerificationCode.objects.filter(user=user).latest("created_at")
    assert entry.attempts == 1
    user.refresh_from_db()
    assert user.is_active is False


@pytest.mark.django_db
def test_register_refuse_mot_de_passe_faible():
    with pytest.raises(RegistrationError):
        AuthService().register(**dict(VALID, password="12345678"))  # purement numérique


@pytest.mark.django_db
@LOCMEM
def test_resend_invalide_les_codes_precedents():
    svc = AuthService()
    user = svc.register(**VALID)
    code1 = _latest_code(user)
    svc.resend_email_code(email=VALID["email"])
    old = EmailVerificationCode.objects.get(user=user, code=code1)
    assert old.consumed_at is not None  # ancien code invalidé
    # Le nouveau code (le seul valide) active bien le compte.
    nouveau = EmailVerificationCode.objects.filter(user=user, consumed_at__isnull=True).latest("created_at")
    res = svc.verify_email_code(email=VALID["email"], code=nouveau.code)
    assert res["user"].is_active is True


@pytest.mark.django_db
@LOCMEM
def test_lockout_apres_max_tentatives():
    svc = AuthService()
    user = svc.register(**VALID)
    for _ in range(5):  # email_code_max_attempts = 5
        with pytest.raises(InvalidCode):
            svc.verify_email_code(email=VALID["email"], code="000000")
    # Code épuisé : même le bon code est désormais refusé.
    with pytest.raises(InvalidCode):
        svc.verify_email_code(email=VALID["email"], code=_latest_code(user))
    user.refresh_from_db()
    assert user.is_active is False


@pytest.mark.django_db
@LOCMEM
def test_verify_code_expire():
    svc = AuthService()
    user = svc.register(**VALID)
    entry = EmailVerificationCode.objects.filter(user=user).latest("created_at")
    entry.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    entry.save(update_fields=["expires_at"])
    with pytest.raises(CodeExpired):
        svc.verify_email_code(email=VALID["email"], code=entry.code)


@pytest.mark.django_db
@LOCMEM
def test_flux_api_complet():
    client = APIClient()
    r = client.post("/api/auth/register/", VALID, format="json")
    assert r.status_code == 201, r.content
    user = User.objects.get(email=VALID["email"])
    r = client.post(
        "/api/auth/verify/",
        {"email": VALID["email"], "code": _latest_code(user)},
        format="json",
    )
    assert r.status_code == 200, r.content
    access = r.json()["tokens"]["access"]
    # Accès authentifié (EF2).
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.json()["email"] == VALID["email"]


@pytest.mark.django_db
@LOCMEM
def test_compte_non_verifie_ne_peut_pas_login():
    AuthService().register(**VALID)
    client = APIClient()
    # is_active=False => SimpleJWT refuse la délivrance du token.
    r = client.post(
        "/api/auth/token/",
        {"username": VALID["username"], "password": VALID["password"]},
        format="json",
    )
    assert r.status_code == 401


@pytest.mark.django_db
def test_create_house_idempotent():
    from django.core.management import call_command

    call_command("create_house")
    call_command("create_house")
    houses = User.objects.filter(is_system=True, username="house")
    assert houses.count() == 1
    assert houses.first().is_active is True
