"""Prestataires de paiement. Le sandbox s'enregistre à l'import (MVP)."""
from .base import CallbackResult, PaymentGatewayRegistry, PaymentProvider, registry
from .sandbox import SandboxProvider

if "sandbox" not in registry.available():
    registry.register(SandboxProvider())

__all__ = [
    "PaymentProvider",
    "PaymentGatewayRegistry",
    "CallbackResult",
    "SandboxProvider",
    "registry",
]
