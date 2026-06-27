"""
Objet-valeur `Money` (conception §6, pattern Value Object §10).

Règle d'or : **aucun montant monétaire « nu »** ne circule dans le code métier — on
manipule toujours `Money(montant, devise)`. Immuable, arithmétique contrôlée (refus de
mélanger les devises). Devise par défaut **XAF** (sans sous-unité → 0 décimale).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .errors import CurrencyMismatch, InvalidMoney

# Nombre de décimales par devise (XAF = monnaie sans sous-unité).
_CURRENCY_DECIMALS = {"XAF": 0}
_DEFAULT_DECIMALS = 2

Numeric = "Decimal | int | str"


def _decimals_for(currency: str) -> int:
    return _CURRENCY_DECIMALS.get(currency, _DEFAULT_DECIMALS)


@dataclass(frozen=True, order=False)
class Money:
    """Couple (montant, devise) avec montant quantifié à l'échelle de la devise."""

    amount: Decimal
    currency: str = "XAF"

    def __post_init__(self) -> None:
        if not isinstance(self.currency, str) or not self.currency:
            raise InvalidMoney("Devise manquante ou invalide.")
        try:
            raw = self.amount if isinstance(self.amount, Decimal) else Decimal(str(self.amount))
        except Exception as exc:  # noqa: BLE001
            raise InvalidMoney(f"Montant invalide : {self.amount!r}") from exc
        quant = Decimal(1).scaleb(-_decimals_for(self.currency))
        # dataclass gelé : on contourne pour normaliser le montant à la construction.
        object.__setattr__(self, "amount", raw.quantize(quant, rounding=ROUND_HALF_UP))

    # --- Fabriques ---------------------------------------------------------
    @classmethod
    def zero(cls, currency: str = "XAF") -> Money:
        return cls(Decimal(0), currency)

    # --- Garde-fou devise --------------------------------------------------
    def _check(self, other: Money) -> None:
        if not isinstance(other, Money):
            raise InvalidMoney(f"Opération Money attendue, reçu {type(other).__name__}.")
        if other.currency != self.currency:
            raise CurrencyMismatch(
                f"Devises incompatibles : {self.currency} vs {other.currency}."
            )

    # --- Arithmétique (même devise uniquement) -----------------------------
    def __add__(self, other: Money) -> Money:
        self._check(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        self._check(other)
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: Decimal | int) -> Money:
        if isinstance(factor, Money):
            raise InvalidMoney("Multiplication Money × Money interdite.")
        return Money(self.amount * Decimal(str(factor)), self.currency)

    __rmul__ = __mul__

    def __neg__(self) -> Money:
        return Money(-self.amount, self.currency)

    # --- Comparaisons (même devise) ----------------------------------------
    def __lt__(self, other: Money) -> bool:
        self._check(other)
        return self.amount < other.amount

    def __le__(self, other: Money) -> bool:
        self._check(other)
        return self.amount <= other.amount

    def __gt__(self, other: Money) -> bool:
        self._check(other)
        return self.amount > other.amount

    def __ge__(self, other: Money) -> bool:
        self._check(other)
        return self.amount >= other.amount

    # --- Prédicats ---------------------------------------------------------
    @property
    def is_zero(self) -> bool:
        return self.amount == 0

    @property
    def is_negative(self) -> bool:
        return self.amount < 0

    @property
    def is_positive(self) -> bool:
        return self.amount > 0

    def __str__(self) -> str:
        return f"{self.amount} {self.currency}"
