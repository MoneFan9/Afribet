"""
`PaymentProvider` — abstraction enfichable des prestataires de paiement
(conception §Classes, §5, frontière 2). Le wallet ignore tout du prestataire ;
on branche MTN/Airtel/carte/crypto plus tard en implémentant cette interface (EF15),
sans toucher au cœur.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CallbackResult:
    external_ref: str
    success: bool
    raw: dict | None = None


class PaymentProvider(ABC):
    key: str

    @abstractmethod
    def initiate_deposit(self, intent) -> dict:
        """Démarre un dépôt ; renvoie une instruction (USSD/redirection) + external_ref."""

    @abstractmethod
    def initiate_payout(self, intent) -> dict:
        """Démarre un retrait vers la destination du joueur."""

    @abstractmethod
    def parse_callback(self, payload: dict) -> CallbackResult:
        """Normalise un callback prestataire (idempotent côté service)."""

    @abstractmethod
    def verify(self, external_ref: str) -> bool:
        """Vérification active (secours si le callback manque)."""


class PaymentGatewayRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, PaymentProvider] = {}

    def register(self, provider: PaymentProvider) -> None:
        self._providers[provider.key] = provider

    def get(self, key: str) -> PaymentProvider:
        try:
            return self._providers[key]
        except KeyError as exc:
            raise KeyError(f"Prestataire inconnu : {key!r}") from exc

    def available(self) -> list[str]:
        return sorted(self._providers)


registry = PaymentGatewayRegistry()
