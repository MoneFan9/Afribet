"""
Recherche arborescente Monte-Carlo (MCTS style AlphaZero, port de `aiWorker.ts`).

Sélection UCB1, expansion, simulation (rollout borné **seedé**), rétropropagation,
évaluation des feuilles non terminales par `AdaptiveSongoNN`. Le rollout utilise un
RNG **injecté et seedé** → résultat reproductible (équité argent §7.4).
"""
from __future__ import annotations

import math

from ..engine import rules
from .nn import AdaptiveSongoNN


class MCTSNode:
    __slots__ = ("state", "parent", "move_from_parent", "children", "visits", "score", "untried_moves")

    def __init__(self, state: dict, parent: MCTSNode | None = None, move_from_parent: int | None = None):
        self.state = state  # {"plateau": [...], "greniers": [...], "joueur": int}
        self.parent = parent
        self.move_from_parent = move_from_parent
        self.children: list[MCTSNode] = []
        self.visits = 0
        self.score = 0.0
        self.untried_moves = rules.get_coups_legaux(state["plateau"], state["joueur"])

    def best_child(self, c: float = 1.414) -> MCTSNode:
        best_value = -math.inf
        best = self.children[0]
        for child in self.children:
            ucb1 = (child.score / child.visits) + c * math.sqrt(math.log(self.visits) / child.visits)
            if ucb1 > best_value:
                best_value = ucb1
                best = child
        return best


def _copy_state(state: dict) -> dict:
    return {
        "plateau": list(state["plateau"]),
        "greniers": list(state["greniers"]),
        "joueur": state["joueur"],
    }


def run_mcts(
    plateau: list[int],
    greniers: list[int],
    joueur_actuel: int,
    iterations: int,
    joueur_ia: int,
    rng,
    nn: AdaptiveSongoNN,
    rollout_depth: int = 30,
) -> int | None:
    root = MCTSNode({"plateau": list(plateau), "greniers": list(greniers), "joueur": joueur_actuel})

    for _ in range(iterations):
        node = root
        state = _copy_state(root.state)

        # Sélection
        while not node.untried_moves and node.children:
            node = node.best_child()
            rules.appliquer_coup(state["plateau"], state["greniers"], state["joueur"], node.move_from_parent)
            state["joueur"] = 1 - state["joueur"]

        # Expansion
        if node.untried_moves:
            move = node.untried_moves.pop()
            rules.appliquer_coup(state["plateau"], state["greniers"], state["joueur"], move)
            state["joueur"] = 1 - state["joueur"]
            child = MCTSNode(_copy_state(state), node, move)
            node.children.append(child)
            node = child

        # Simulation (rollout borné, seedé)
        courant = state["joueur"]
        depth = 0
        while rules.check_fin_partie(state["plateau"], state["greniers"]) == -1 and depth < rollout_depth:
            moves = rules.get_coups_legaux(state["plateau"], courant)
            if not moves:
                break
            move = rng.choice(moves)
            rules.appliquer_coup(state["plateau"], state["greniers"], courant, move)
            courant = 1 - courant
            depth += 1

        # Évaluation du résultat
        fin = rules.check_fin_partie(state["plateau"], state["greniers"])
        if fin == joueur_ia:
            result = 1.0
        elif fin == 1 - joueur_ia:
            result = 0.0
        else:
            result = nn.sigmoid(nn.evaluate(state["plateau"], state["greniers"], joueur_ia))

        # Rétropropagation
        curr: MCTSNode | None = node
        while curr is not None:
            curr.visits += 1
            if curr.parent is not None and curr.parent.state["joueur"] == joueur_ia:
                curr.score += result
            else:
                curr.score += 1.0 - result
            curr = curr.parent

    if not root.children:
        return None
    best = max(root.children, key=lambda ch: ch.visits)
    return best.move_from_parent
