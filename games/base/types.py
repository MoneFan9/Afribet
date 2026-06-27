"""Types partagés du framework de jeux (structures simples, sérialisables)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Un joueur est identifié par un index (0, 1, ...). Un coup est opaque au niveau
# plateforme ; chaque module en définit le format concret (entier pour Songo).
Player = int
Move = Any
State = Any


@dataclass
class MoveResult:
    """Résultat de l'application d'un coup : nouvel état + événements de jeu.

    `events` est une liste de faits structurés (capture, pénalité, solidarité, ...)
    que la couche temps réel peut diffuser ; ils restent **spécifiques au jeu** et
    opaques pour la plateforme.
    """

    state: State
    events: list[dict[str, Any]] = field(default_factory=list)
