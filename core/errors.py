"""
Exceptions du domaine AfriBet (couche métier, indépendantes du framework web).

Les services lèvent ces erreurs ; la couche d'adaptation (vues/consumers) les
traduit en réponses HTTP/WS. Aucune logique web ici.
"""
from __future__ import annotations


class DomainError(Exception):
    """Base de toutes les erreurs métier."""


# --- Money / devise -------------------------------------------------------
class InvalidMoney(DomainError):
    pass


class CurrencyMismatch(DomainError):
    pass


# --- Wallet / escrow (utilisées dès la Phase 4) ---------------------------
class InsufficientFunds(DomainError):
    pass


class WalletError(DomainError):
    pass


# --- Match / participation ------------------------------------------------
class NotParticipant(DomainError):
    pass


# --- Configuration --------------------------------------------------------
class ConfigError(DomainError):
    pass
