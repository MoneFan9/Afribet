"""
`GameRegistry` — enregistrement des jeux (pattern Plugin/Registry, conception §10).

Ajouter un jeu = implémenter `GameModule`/`GameAI` et `register()` — sans toucher au
cœur plateforme (EF14).
"""
from __future__ import annotations

from .interfaces import GameAI, GameModule


class GameRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, GameModule] = {}
        self._ais: dict[str, GameAI] = {}

    def register(self, module: GameModule, ai: GameAI | None = None) -> None:
        if module.key in self._modules:
            raise ValueError(f"Jeu déjà enregistré : {module.key!r}")
        self._modules[module.key] = module
        if ai is not None:
            self._ais[module.key] = ai

    def get(self, key: str) -> GameModule:
        try:
            return self._modules[key]
        except KeyError as exc:
            raise KeyError(f"Jeu inconnu : {key!r}") from exc

    def get_ai(self, key: str) -> GameAI:
        try:
            return self._ais[key]
        except KeyError as exc:
            raise KeyError(f"Pas d'IA pour le jeu : {key!r}") from exc

    def has(self, key: str) -> bool:
        return key in self._modules

    def available(self) -> list[str]:
        return sorted(self._modules)


# Registre global du processus. Les modules s'y enregistrent à l'import (voir
# `games/songo/__init__.py`).
registry = GameRegistry()
