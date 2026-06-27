"""
`GameService` — façade du framework consommée par la couche Django (frontière 3).

Travaille en **dict opaque** (= `Match.game_state`) côté entrée/sortie : la plateforme
ne manipule jamais l'état interne d'un jeu, seulement sa forme sérialisée et un
`game_key`.
"""
from __future__ import annotations

from .registry import GameRegistry
from .registry import registry as default_registry
from .types import Move, MoveResult, Player


class GameService:
    def __init__(self, reg: GameRegistry | None = None) -> None:
        self._registry = reg or default_registry

    def available_games(self) -> list[str]:
        return self._registry.available()

    def init_state(self, game_key: str, config: dict | None = None) -> dict:
        module = self._registry.get(game_key)
        return module.serialize(module.init_state(config))

    def legal_moves(self, game_key: str, state: dict, player: Player) -> list[Move]:
        module = self._registry.get(game_key)
        return module.legal_moves(module.deserialize(state), player)

    def apply_move(self, game_key: str, state: dict, player: Player, move: Move) -> dict:
        module = self._registry.get(game_key)
        result: MoveResult = module.apply_move(module.deserialize(state), player, move)
        return {
            "state": module.serialize(result.state),
            "events": result.events,
        }

    def worst_move(self, game_key: str, state: dict, player: Player) -> Move:
        module = self._registry.get(game_key)
        return module.worst_move(module.deserialize(state), player)

    def is_terminal(self, game_key: str, state: dict) -> bool:
        module = self._registry.get(game_key)
        return module.is_terminal(module.deserialize(state))

    def winner(self, game_key: str, state: dict) -> Player | None:
        module = self._registry.get(game_key)
        return module.winner(module.deserialize(state))

    def current_player(self, game_key: str, state: dict) -> Player:
        module = self._registry.get(game_key)
        return module.current_player(module.deserialize(state))

    def ai_move(self, game_key: str, state: dict, player: Player, level: str, **kwargs) -> Move:
        module = self._registry.get(game_key)
        ai = self._registry.get_ai(game_key)
        return ai.choose_move(module.deserialize(state), player, level, **kwargs)
