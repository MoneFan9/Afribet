"""
Système de composants **maison** via tags Django natifs (conception §6b : zéro
dépendance, pas de Django Cotton, pas de lib JS).
"""
from __future__ import annotations

from django import template

register = template.Library()


@register.inclusion_tag("components/balance_pocket.html")
def balance_pocket(label, amount, currency="XAF", accent="vert", hint=""):
    """Carte de solde (une poche du portefeuille)."""
    return {"label": label, "amount": amount, "currency": currency, "accent": accent, "hint": hint}


@register.inclusion_tag("components/stat.html")
def stat(label, value):
    return {"label": label, "value": value}


@register.simple_tag
def money(amount, currency="XAF"):
    """Formate un montant (séparateur de milliers)."""
    try:
        return f"{int(amount):,}".replace(",", " ") + f" {currency}"
    except (TypeError, ValueError):
        return f"{amount} {currency}"
