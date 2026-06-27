"""
`NotificationProvider` — abstraction enfichable des notifications (conception
§Classes « Abstractions enfichables »). Même patron que les paiements/KYC.

MVP : `EmailProvider` **actif** (backend console en dev, SMTP en prod) ; `SmsProvider`
**présent mais inactif** (OTP SMS activable quand un prestataire existe).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from django.core.mail import send_mail


class NotificationProvider(ABC):
    key: str

    @abstractmethod
    def send_email(self, to: str, subject: str, message: str) -> None: ...

    @abstractmethod
    def send_sms(self, to: str, message: str) -> None: ...


class EmailProvider(NotificationProvider):
    """Envoi d'e-mails via Django (console en dev → code MFA lisible dans les logs)."""

    key = "email"

    def send_email(self, to: str, subject: str, message: str) -> None:
        send_mail(
            subject=subject,
            message=message,
            from_email=None,  # DEFAULT_FROM_EMAIL
            recipient_list=[to],
            fail_silently=False,
        )

    def send_sms(self, to: str, message: str) -> None:  # pragma: no cover
        raise NotImplementedError("EmailProvider ne gère pas le SMS.")


class SmsProvider(NotificationProvider):
    """Inactif au MVP (aucun prestataire SMS branché). Présent pour l'extensibilité."""

    key = "sms"
    active = False

    def send_email(self, to: str, subject: str, message: str) -> None:  # pragma: no cover
        raise NotImplementedError("SmsProvider ne gère pas l'e-mail.")

    def send_sms(self, to: str, message: str) -> None:  # pragma: no cover
        raise NotImplementedError("SMS inactif au MVP (aucun prestataire branché).")
