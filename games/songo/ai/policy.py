"""
`AlphaSongoAI` — politique de choix de coup (port de l'échelle de difficulté du PoC).

Niveaux (conception §7.1) :
- `ENFANT`       : coup aléatoire (profondeur 0)
- `INITIE`       : alpha-bêta profondeur 1
- `VIEUX_SAGE`   : alpha-bêta profondeur 4
- `GRAND_MAITRE` : approfondissement itératif 1→6
- `ALPHASONGO`   : MCTS + réseau adaptatif (niveau le plus fort)

**Équité argent (§7.4)** : `money_mode=True` ⇒ réseau adaptatif **désactivé** (force
fixe). Le RNG est **seedé** (paramètre `seed`) ⇒ tout coup IA est reproductible et
auditable, quel que soit le niveau.
"""
from __future__ import annotations

import random

from games.base.interfaces import GameAI
from games.base.types import Move, Player, State

from ..engine import rules
from .mcts import run_mcts
from .nn import AdaptiveSongoNN
from .search import AlphaBeta

ENFANT = "ENFANT"
INITIE = "INITIE"
VIEUX_SAGE = "VIEUX_SAGE"
GRAND_MAITRE = "GRAND_MAITRE"
ALPHASONGO = "ALPHASONGO"

NIVEAUX = (ENFANT, INITIE, VIEUX_SAGE, GRAND_MAITRE, ALPHASONGO)

# Profondeur alpha-bêta par niveau.
_DEPTHS = {INITIE: 1, VIEUX_SAGE: 4}
# Itérations MCTS par défaut (le runtime fort ~5000 tourne dans un worker Celery
# borné ; valeur modérée par défaut pour rester réactif et testable).
DEFAULT_MCTS_ITERATIONS = 400


class AlphaSongoAI(GameAI):
    def choose_move(
        self,
        state: State,
        player: Player,
        level: str = ALPHASONGO,
        *,
        money_mode: bool = False,
        seed: int = 0,
        iterations: int | None = None,
        max_depth: int = 6,
        profile: dict | None = None,
    ) -> Move:
        plateau = list(state["plateau"])
        greniers = list(state["greniers"])
        legal = rules.get_coups_legaux(plateau, player)
        if not legal:
            raise ValueError("Aucun coup légal pour l'IA.")
        if len(legal) == 1:
            return legal[0]

        rng = random.Random(seed)

        if level == ENFANT:
            return rng.choice(legal)

        if level in _DEPTHS:
            move = AlphaBeta().best_move(plateau, greniers, player, _DEPTHS[level])
            return move if move is not None else legal[0]

        if level == GRAND_MAITRE:
            move = AlphaBeta().iterative_deepening(plateau, greniers, player, max_depth)
            return move if move is not None else legal[0]

        # ALPHASONGO (et défaut) : MCTS + NN. En mode argent, force fixe (adaptation
        # désactivée, §7.4). En entraînement, un profil adverse opaque persistant peut
        # être fourni (l'IA exploite alors les faiblesses apprises).
        if money_mode:
            nn = AdaptiveSongoNN(adaptive=False)  # jamais d'exploitation en argent
        else:
            nn = AdaptiveSongoNN(adaptive=True)
            if profile:
                nn.player_profile = dict(profile)
        iters = iterations if iterations is not None else DEFAULT_MCTS_ITERATIONS
        move = run_mcts(plateau, greniers, player, iters, player, rng, nn)
        return move if move is not None else legal[0]

    def observe_opponent_move(self, state_before: State, move: Move, player: Player,
                              profile: dict | None = None, *, money_mode: bool = False) -> dict:
        """Met à jour le profil adverse (entraînement) à partir d'un coup humain.

        Renvoie un profil **opaque** (dict sérialisable) que la plateforme persiste
        sans le comprendre (frontière 1). **Garde §7.4** : en mode argent, aucun
        apprentissage (défense en profondeur, symétrique de `choose_move`).
        """
        if money_mode:
            return profile or {}
        nn = AdaptiveSongoNN(adaptive=True)
        if profile:
            nn.player_profile = dict(profile)
        nn.learn(move, list(state_before["plateau"]), player)
        return nn.player_profile
