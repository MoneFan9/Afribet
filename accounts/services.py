"""
Services `accounts` (couche contrôle, CU1) — toute la logique d'inscription /
vérification MFA e-mail vit ici, jamais dans les vues (frontière 3).

Décision MVP (conception §Décidé en v1) : **téléphone unique obligatoire** +
**vérification par code MFA e-mail**. Un mot de passe est requis à l'inscription
(support de l'auth JWT, EF2) ; le code e-mail prouve la possession de l'adresse et
**active** le compte. KYC d'identité différé (stub), conditionne retrait/conversion.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from core import config
from core.errors import DomainError
from notifications.service import NotificationService

from .models import EmailVerificationCode, KycStatus

User = get_user_model()


# --- Erreurs CU1 ----------------------------------------------------------
class RegistrationError(DomainError):
    pass


class PhoneAlreadyUsed(RegistrationError):
    pass


class EmailAlreadyUsed(RegistrationError):
    pass


class UsernameAlreadyUsed(RegistrationError):
    pass


class VerificationError(DomainError):
    pass


class InvalidCode(VerificationError):
    pass


class CodeExpired(VerificationError):
    pass


class AlreadyVerified(VerificationError):
    pass


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_tokens(user) -> dict:
    """Paire JWT (access + refresh) pour un utilisateur (EF2)."""
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class AuthService:
    def __init__(self, notifications: NotificationService | None = None) -> None:
        self.notifications = notifications or NotificationService()

    # --- Inscription ------------------------------------------------------
    @transaction.atomic
    def register(self, *, phone: str, email: str, username: str, password: str) -> User:
        """Crée un compte **inactif** (e-mail non vérifié) et envoie le code MFA."""
        if User.objects.filter(phone_number=phone).exists():
            raise PhoneAlreadyUsed("Ce numéro de téléphone est déjà enrôlé.")
        if User.objects.filter(email__iexact=email).exists():
            raise EmailAlreadyUsed("Cette adresse e-mail est déjà utilisée.")
        if User.objects.filter(username__iexact=username).exists():
            raise UsernameAlreadyUsed("Ce pseudo est déjà pris.")
        # Applique les validateurs de mot de passe Django (longueur, trop commun,
        # purement numérique...) — sinon ils sont inertes (create_user ne valide pas).
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise RegistrationError(" ".join(exc.messages)) from exc

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                phone_number=phone,
                is_active=False,  # activé après vérification du code e-mail
                kyc_status=KycStatus.PENDING,
            )
        except IntegrityError as exc:  # garde-fou concurrence (unicité DB)
            raise PhoneAlreadyUsed("Conflit d'unicité (téléphone/pseudo).") from exc

        self._send_new_code(user)
        # NB : le wallet XAF à zéro est créé en Phase 4 (WalletService), à l'activation.
        return user

    # --- Code MFA e-mail --------------------------------------------------
    def _send_new_code(self, user) -> EmailVerificationCode:
        # Invalide les codes en attente : un seul code valide à la fois (l'anti-brute-
        # force ne peut plus être contourné en cumulant des codes).
        EmailVerificationCode.objects.filter(user=user, consumed_at__isnull=True).update(
            consumed_at=timezone.now()
        )
        ttl = config.get_int("email_code_ttl_minutes")
        code = EmailVerificationCode.objects.create(
            user=user,
            code=_generate_code(),
            expires_at=timezone.now() + timedelta(minutes=ttl),
        )
        # Envoi APRÈS commit (si rollback de l'inscription, pas d'e-mail orphelin).
        to, value = user.email, code.code
        transaction.on_commit(lambda: self.notifications.send_email_code(to, value))
        return code

    def resend_email_code(self, *, email: str) -> None:
        """Renvoie un nouveau code (cas « code invalide/expiré »)."""
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise VerificationError("Compte introuvable pour cette adresse.")
        if user.is_active:
            raise AlreadyVerified("Ce compte est déjà vérifié.")
        self._send_new_code(user)

    def verify_email_code(self, *, email: str, code: str) -> dict:
        """Vérifie le code, active le compte, renvoie l'utilisateur + JWT (CU1).

        Les effets d'échec (incrément des tentatives, invalidation du code épuisé)
        sont **committés avant** de lever l'exception : on calcule l'issue dans la
        transaction, puis on lève après le commit (sinon le rollback annulerait
        l'anti-brute-force).
        """
        outcome = ""
        with transaction.atomic():
            user = User.objects.select_for_update().filter(email__iexact=email).first()
            if user is None:
                raise InvalidCode("Code ou adresse invalide.")
            if user.is_active:
                raise AlreadyVerified("Ce compte est déjà vérifié.")

            entry = (
                EmailVerificationCode.objects.select_for_update()
                .filter(user=user, consumed_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
            if entry is None:
                raise InvalidCode("Aucun code en attente ; demandez un renvoi.")
            if entry.is_expired:
                raise CodeExpired("Code expiré ; demandez un renvoi.")

            max_attempts = config.get_int("email_code_max_attempts")
            if entry.attempts >= max_attempts:
                entry.consumed_at = timezone.now()  # invalide le code épuisé
                entry.save(update_fields=["consumed_at"])
                outcome = "locked"
            elif not secrets.compare_digest(entry.code, str(code)):
                entry.attempts += 1
                entry.save(update_fields=["attempts"])
                outcome = "mismatch"
            else:
                entry.consumed_at = timezone.now()
                entry.save(update_fields=["consumed_at"])
                user.is_active = True
                user.save(update_fields=["is_active"])
                outcome = "ok"

        # Hors transaction (effets persistés) : on lève le cas échéant.
        if outcome == "locked":
            raise InvalidCode("Trop de tentatives ; demandez un renvoi.")
        if outcome == "mismatch":
            raise InvalidCode("Code incorrect.")

        # Postcondition CU1 : wallet XAF à zéro créé à l'activation du compte.
        from wallet.services import WalletService

        WalletService().ensure_wallet(user)
        return {"user": user, "tokens": issue_tokens(user)}
