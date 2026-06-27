"""
`NotificationService` — couche de contrôle des notifications (CU1 : code MFA).

Sélectionne le provider actif et compose les messages (en français). La logique
métier (génération/validation des codes) vit dans `accounts`, pas ici.
"""
from __future__ import annotations

from .providers import EmailProvider, NotificationProvider


class NotificationService:
    def __init__(self, email_provider: NotificationProvider | None = None) -> None:
        self.email = email_provider or EmailProvider()

    def send_email_code(self, to: str, code: str) -> None:
        """Envoie le code de vérification MFA par e-mail (CU1)."""
        self.email.send_email(
            to=to,
            subject="AfriBet — votre code de vérification",
            message=(
                f"Bienvenue sur AfriBet.\n\n"
                f"Votre code de vérification est : {code}\n\n"
                f"Saisissez-le pour activer votre compte. "
                f"Ce code expirera bientôt ; ne le partagez avec personne."
            ),
        )
