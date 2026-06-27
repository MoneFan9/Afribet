"""Contrat du framework de jeux : interfaces, registre, façade."""
from .interfaces import GameAI, GameModule
from .registry import GameRegistry, registry
from .service import GameService
from .types import MoveResult, Player

__all__ = [
    "GameModule",
    "GameAI",
    "GameRegistry",
    "registry",
    "GameService",
    "MoveResult",
    "Player",
]
