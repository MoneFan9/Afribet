"""Tests de l'objet-valeur `Money` (conception §6). Python pur, sans base."""
from __future__ import annotations

from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from core.errors import CurrencyMismatch, InvalidMoney
from core.money import Money


def test_construction_et_quantification_xaf():
    # XAF = 0 décimale : arrondi au franc entier.
    assert Money(10).amount == Decimal("10")
    assert Money("2000000").currency == "XAF"
    assert Money(Decimal("10.4")).amount == Decimal("10")
    assert Money(Decimal("10.5")).amount == Decimal("11")


def test_egalite_valeur():
    assert Money(100, "XAF") == Money(Decimal("100"), "XAF")
    assert Money(100, "XAF") != Money(100, "EUR")


def test_zero():
    assert Money.zero().is_zero
    assert Money.zero("XAF") == Money(0)


def test_addition_soustraction_meme_devise():
    assert Money(100) + Money(50) == Money(150)
    assert Money(100) - Money(150) == Money(-50)
    assert (Money(100) - Money(150)).is_negative


def test_refus_melange_devises():
    with pytest.raises(CurrencyMismatch):
        Money(100, "XAF") + Money(100, "EUR")
    with pytest.raises(CurrencyMismatch):
        _ = Money(100, "XAF") < Money(100, "EUR")


def test_multiplication_scalaire():
    # Pot * 2, puis rake 5 % (le flooring fin sera géré côté wallet).
    assert Money(500) * 2 == Money(1000)
    assert (Money(1000) * Decimal("0.05")) == Money(50)
    assert 2 * Money(500) == Money(1000)


def test_multiplication_money_money_interdite():
    with pytest.raises(InvalidMoney):
        _ = Money(100) * Money(2)


def test_comparaisons():
    assert Money(100) > Money(50)
    assert Money(50) <= Money(50)
    assert Money(50).is_positive


def test_immuabilite():
    m = Money(100)
    with pytest.raises(FrozenInstanceError):
        m.amount = Decimal("200")  # type: ignore[misc]


def test_devise_invalide():
    with pytest.raises(InvalidMoney):
        Money(100, "")
