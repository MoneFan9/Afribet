"""
Module de jeu **Songo** (premier jeu). S'enregistre dans le registre global à
l'import (frontière 1 : la plateforme ne voit que `game_key="songo"`).
"""
from games.base.registry import registry

from .ai import AlphaSongoAI
from .engine import SongoModule

_module = SongoModule()
_ai = AlphaSongoAI()
if not registry.has(_module.key):
    registry.register(_module, _ai)

__all__ = ["SongoModule", "AlphaSongoAI"]
