"""Erreurs du domaine bonus."""
from __future__ import annotations

from core.errors import DomainError


class BonusError(DomainError):
    pass


class BonusAlreadyGranted(BonusError):
    pass


class BonusPocketClosed(BonusError):
    pass


class ConversionBelowThreshold(BonusError):
    pass


class GlobalCapReached(BonusError):
    pass


class VirtualUsageExceeded(BonusError):
    pass


class KycRequired(BonusError):
    pass
