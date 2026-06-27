"""
`KycProvider` — abstraction enfichable de la vérification d'identité (conception
§Classes, CU1). Différée au MVP : `StubKycProvider` (aucun prestataire réel encore).

Un prestataire tiers (Smile ID, Onfido, Veriff…) se branche plus tard en
implémentant l'interface, sans toucher au cœur (EF15). Le KYC complet conditionne
**retrait** (CU7) et **conversion** (CU17).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from .models import KycStatus


@dataclass
class KycResult:
    status: str  # valeur de KycStatus
    reference: str = ""
    reason: str = ""


class KycProvider(ABC):
    key: str

    @abstractmethod
    def verify_identity(self, user, doc, selfie) -> KycResult: ...

    @abstractmethod
    def status(self, reference: str) -> str: ...


class StubKycProvider(KycProvider):
    """KYC différé : laisse le compte en `PENDING` (aucune vérification au MVP)."""

    key = "stub"

    def verify_identity(self, user, doc=None, selfie=None) -> KycResult:
        # Aucune vérification réelle : le dossier reste à instruire ultérieurement.
        return KycResult(status=KycStatus.PENDING, reference="", reason="KYC différé (MVP)")

    def status(self, reference: str) -> str:
        return KycStatus.PENDING
