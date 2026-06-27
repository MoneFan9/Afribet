"""
Recherche **alpha-bêta** (port de `aiWorker.ts`) : table de transposition (Zobrist),
tri de coups (coup TT en tête puis gain de capture), approfondissement itératif.

Déterministe (aucun aléa) → coups auditables (équité argent §7.4).
"""
from __future__ import annotations

import math

from ..engine import rules
from ..engine.constants import TAILLE_CAMP, TOTAL_TROUS
from .zobrist import zobrist_hash

INF = math.inf
TT_MAX_SIZE = 200_000


class AlphaBeta:
    """Recherche minimax à élagage alpha-bêta avec table de transposition."""

    def __init__(self, tt_max: int = TT_MAX_SIZE) -> None:
        self.tt: dict[str, dict] = {}
        self.tt_max = tt_max

    def _set_tt(self, key: str, entry: dict) -> None:
        if len(self.tt) >= self.tt_max:
            self.tt.clear()
        self.tt[key] = entry

    @staticmethod
    def _eval_feuille(plateau: list[int], greniers: list[int], joueur_ia: int) -> float:
        score = greniers[joueur_ia] - greniers[1 - joueur_ia]
        camp_start = 0 if joueur_ia == 0 else TAILLE_CAMP
        nyindis = sum(1 for i in range(camp_start, camp_start + TAILLE_CAMP) if 5 <= plateau[i] <= 12)
        return score + nyindis * 0.5

    def search(
        self,
        plateau: list[int],
        greniers: list[int],
        joueur_actuel: int,
        profondeur: int,
        alpha: float,
        beta: float,
        is_maximizing: bool,
        joueur_ia: int,
    ) -> tuple[float, int | None]:
        state_key = f"{zobrist_hash(plateau, joueur_actuel)}:{greniers[0] - greniers[1]}"
        tt_move = None
        entry = self.tt.get(state_key)
        if entry is not None:
            if entry["depth"] >= profondeur:
                flag = entry["flag"]
                if flag == "EXACT":
                    return entry["score"], entry["best_move"]
                if flag == "LOWER":
                    alpha = max(alpha, entry["score"])
                elif flag == "UPPER":
                    beta = min(beta, entry["score"])
                if alpha >= beta:
                    return entry["score"], entry["best_move"]
            tt_move = entry["best_move"]

        fin = rules.check_fin_partie(plateau, greniers)
        if fin != -1:
            if fin == joueur_ia:
                return 1000 + profondeur, None
            if fin == 1 - joueur_ia:
                return -1000 - profondeur, None
            return 0, None

        if profondeur == 0:
            return self._eval_feuille(plateau, greniers, joueur_ia), None

        coups = rules.get_coups_legaux(plateau, joueur_actuel)
        if not coups:
            # Joueur bloqué : on solde le plateau en faveur du calcul (port fidèle).
            g0 = greniers[0] + sum(plateau[0:TAILLE_CAMP])
            g1 = greniers[1] + sum(plateau[TAILLE_CAMP:TOTAL_TROUS])
            final_score = g0 - g1
            return (final_score if joueur_ia == 0 else -final_score), None

        # Tri des coups : coup de la TT en tête, puis gain de capture immédiat.
        def score_coup(move: int) -> int:
            if move == tt_move:
                return 10_000
            p_copy = list(plateau)
            g_copy = list(greniers)
            rules.appliquer_coup(p_copy, g_copy, joueur_actuel, move)
            return g_copy[joueur_actuel] - greniers[joueur_actuel]

        coups.sort(key=score_coup, reverse=True)
        best_move = coups[0]
        original_alpha = alpha

        if is_maximizing:
            max_eval = -INF
            for move in coups:
                p_copy = list(plateau)
                g_copy = list(greniers)
                rules.appliquer_coup(p_copy, g_copy, joueur_actuel, move)
                score, _ = self.search(
                    p_copy, g_copy, 1 - joueur_actuel, profondeur - 1, alpha, beta, False, joueur_ia
                )
                if score > max_eval:
                    max_eval = score
                    best_move = move
                alpha = max(alpha, score)
                if beta <= alpha:
                    break
            flag = "EXACT"
            if max_eval <= original_alpha:
                flag = "UPPER"
            elif max_eval >= beta:
                flag = "LOWER"
            self._set_tt(state_key, {"score": max_eval, "best_move": best_move, "depth": profondeur, "flag": flag})
            return max_eval, best_move

        min_eval = INF
        for move in coups:
            p_copy = list(plateau)
            g_copy = list(greniers)
            rules.appliquer_coup(p_copy, g_copy, joueur_actuel, move)
            score, _ = self.search(
                p_copy, g_copy, 1 - joueur_actuel, profondeur - 1, alpha, beta, True, joueur_ia
            )
            if score < min_eval:
                min_eval = score
                best_move = move
            beta = min(beta, score)
            if beta <= alpha:
                break
        flag = "EXACT"
        if min_eval <= alpha:
            flag = "UPPER"
        elif min_eval >= beta:
            flag = "LOWER"
        self._set_tt(state_key, {"score": min_eval, "best_move": best_move, "depth": profondeur, "flag": flag})
        return min_eval, best_move

    def best_move(self, plateau: list[int], greniers: list[int], joueur_ia: int, profondeur: int) -> int | None:
        _, move = self.search(plateau, greniers, joueur_ia, profondeur, -INF, INF, True, joueur_ia)
        return move

    def iterative_deepening(
        self, plateau: list[int], greniers: list[int], joueur_ia: int, max_depth: int
    ) -> int | None:
        """Approfondissement itératif 1→max_depth (réutilise la TT entre profondeurs)."""
        best = None
        for depth in range(1, max_depth + 1):
            _, best = self.search(plateau, greniers, joueur_ia, depth, -INF, INF, True, joueur_ia)
        return best
