"""
`SongoModule` — adaptation des règles pures à l'interface `GameModule`.

L'état est un dict JSON-sérialisable `{"plateau": [14], "greniers": [2],
"current_player": 0|1}` ; c'est exactement ce que la plateforme stocke (opaque) dans
`Match.game_state`.
"""
from __future__ import annotations

import copy

from games.base.interfaces import GameModule
from games.base.types import Move, MoveResult, Player, State

from . import rules
from .constants import EN_COURS, NUL


class SongoModule(GameModule):
    key = "songo"
    nb_players = 2

    # --- Cycle de vie de l'état -------------------------------------------
    def init_state(self, config: dict | None = None) -> State:
        return {
            "plateau": rules.plateau_initial(),
            "greniers": [0, 0],
            "current_player": 0,
        }

    def current_player(self, state: State) -> Player:
        return state["current_player"]

    # --- Coups -------------------------------------------------------------
    def legal_moves(self, state: State, player: Player) -> list[Move]:
        return rules.get_coups_legaux(state["plateau"], player)

    def apply_move(self, state: State, player: Player, move: Move) -> MoveResult:
        if move not in self.legal_moves(state, player):
            raise ValueError(f"Coup illégal : {move} (joueur {player})")
        plateau = list(state["plateau"])
        greniers = list(state["greniers"])
        event = rules.appliquer_coup(plateau, greniers, player, move)
        new_state = {
            "plateau": plateau,
            "greniers": greniers,
            "current_player": 1 - player,
        }
        events = [event] if event else []
        return MoveResult(state=new_state, events=events)

    def worst_move(self, state: State, player: Player) -> Move:
        """Pire coup **légal** : minimise l'écart de greniers du joueur après coup.

        Sert au timeout (CU8) : un coup auto faible, jamais une défaite immédiate
        gratuite ni un coup illégal. Déterministe (départage : plus petit indice).
        Heuristique **à 1 pli** (gain immédiat seulement) : ne regarde pas la riposte
        adverse — choix assumé pour un coup auto simple et prévisible.
        """
        legal = self.legal_moves(state, player)
        if not legal:
            raise ValueError("Aucun coup légal disponible.")

        def eval_after(move: int) -> int:
            plateau = list(state["plateau"])
            greniers = list(state["greniers"])
            rules.appliquer_coup(plateau, greniers, player, move)
            return greniers[player] - greniers[1 - player]

        return min(legal, key=lambda m: (eval_after(m), m))

    # --- Fin de partie -----------------------------------------------------
    def is_terminal(self, state: State) -> bool:
        if rules.check_fin_partie(state["plateau"], state["greniers"]) != EN_COURS:
            return True
        # Joueur au trait bloqué (aucun coup légal) → la partie s'arrête (CU8).
        return not self.legal_moves(state, state["current_player"])

    def winner(self, state: State) -> Player | None:
        issue = rules.check_fin_partie(state["plateau"], state["greniers"])
        if issue not in (EN_COURS, NUL):
            return issue
        if issue == NUL:
            return None
        # check_fin == EN_COURS : seul un blocage peut rendre l'état terminal.
        if self.legal_moves(state, state["current_player"]):
            return None  # partie réellement en cours
        # Blocage : chaque camp encaisse ses graines restantes, on compare.
        from .constants import TAILLE_CAMP, TOTAL_TROUS

        plateau, greniers = state["plateau"], state["greniers"]
        g0 = greniers[0] + sum(plateau[0:TAILLE_CAMP])
        g1 = greniers[1] + sum(plateau[TAILLE_CAMP:TOTAL_TROUS])
        if g0 > g1:
            return 0
        if g1 > g0:
            return 1
        return None

    # --- Sérialisation (état opaque pour la plateforme) --------------------
    def serialize(self, state: State) -> dict:
        return copy.deepcopy(state)

    def deserialize(self, data: dict) -> State:
        return copy.deepcopy(data)
