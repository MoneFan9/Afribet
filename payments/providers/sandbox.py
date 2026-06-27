"""
`SandboxProvider` — prestataire simulé (**seul moyen actif au MVP**, conception §5).

Permet de démontrer la boucle dépôt → crédit → jeu → retrait **sans** prestataire
réel. Les vrais prestataires (MTN, Airtel, carte…) se greffent ensuite sans toucher
au wallet.
"""
from __future__ import annotations

from .base import CallbackResult, PaymentProvider


class SandboxProvider(PaymentProvider):
    key = "sandbox"

    def _ref(self, intent) -> str:
        return f"SBX-{intent.id}"

    def initiate_deposit(self, intent) -> dict:
        return {
            "external_ref": self._ref(intent),
            "instruction": "Sandbox : confirmez le dépôt via le callback simulé.",
        }

    def initiate_payout(self, intent) -> dict:
        return {
            "external_ref": self._ref(intent),
            "instruction": "Sandbox : retrait simulé en attente de confirmation.",
        }

    def parse_callback(self, payload: dict) -> CallbackResult:
        return CallbackResult(
            external_ref=payload.get("external_ref", ""),
            success=str(payload.get("status", "")).upper() in {"SUCCESS", "SETTLED", "OK"},
            raw=payload,
        )

    def verify(self, external_ref: str) -> bool:
        # Sandbox optimiste : un dépôt référencé est considéré confirmé.
        return bool(external_ref)
