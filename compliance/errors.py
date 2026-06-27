"""Erreurs de conformité (couche métier)."""
from __future__ import annotations

from core.errors import DomainError


class ComplianceError(DomainError):
    pass


class SelfExcluded(ComplianceError):
    pass


class LimitExceeded(ComplianceError):
    pass


class JurisdictionForbidden(ComplianceError):
    pass


class AgeRestricted(ComplianceError):
    pass


class KycLevelRequired(ComplianceError):
    pass
