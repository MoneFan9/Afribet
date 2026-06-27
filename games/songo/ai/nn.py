"""
`AdaptiveSongoNN` — réseau d'évaluation adaptatif (port de `aiWorker.ts`).

Évalue une position et, **en mode entraînement uniquement**, apprend un profil de
l'adversaire (taux de vulnérabilité) pour exploiter ses faiblesses.

⚠️ **Équité argent (conception §7.4, CRITIQUE)** : en mode argent (`adaptive=False`),
l'apprentissage exploitant est **désactivé** — `learn()` est neutre et l'évaluation
ignore le profil. L'IA joue alors à **force fixe, déterministe et auditable**.
"""
from __future__ import annotations

import math

from ..engine.constants import TAILLE_CAMP


class AdaptiveSongoNN:
    def __init__(self, adaptive: bool = True) -> None:
        # Features : [ScoreDiff, MyNyindis, OppNyindis, MyVuln, OppVuln]
        self.weights = [1.0, 0.5, -0.5, -0.8, 0.8]
        self.adaptive = adaptive
        self.player_profile = {
            "favored_holes": [0] * TAILLE_CAMP,
            "vulnerability_rate": 0.0,
            "total_moves": 0,
        }

    def evaluate(self, plateau: list[int], greniers: list[int], joueur_ia: int) -> float:
        diff = greniers[joueur_ia] - greniers[1 - joueur_ia]
        my_nyindis = opp_nyindis = my_vuln = opp_vuln = 0
        my_start = 0 if joueur_ia == 0 else TAILLE_CAMP
        opp_start = TAILLE_CAMP if joueur_ia == 0 else 0

        for i in range(TAILLE_CAMP):
            my_seeds = plateau[my_start + i]
            if 5 <= my_seeds <= 12:
                my_nyindis += 1
            if my_seeds in (1, 2):
                my_vuln += 1
            opp_seeds = plateau[opp_start + i]
            if 5 <= opp_seeds <= 12:
                opp_nyindis += 1
            if opp_seeds in (1, 2):
                opp_vuln += 1

        # En mode argent (non adaptatif), le profil adverse est ignoré (poids fixe).
        opp_vuln_weight = self.weights[4]
        if self.adaptive:
            opp_vuln_weight += self.player_profile["vulnerability_rate"] * 0.5

        return (
            diff * self.weights[0]
            + my_nyindis * self.weights[1]
            + opp_nyindis * self.weights[2]
            + my_vuln * self.weights[3]
            + opp_vuln * opp_vuln_weight
        )

    def learn(self, move: int, plateau_before: list[int], joueur: int) -> None:
        # Désactivé en mode argent : aucune exploitation du profil (équité §7.4).
        if not self.adaptive:
            return
        self.player_profile["total_moves"] += 1
        self.player_profile["favored_holes"][move % TAILLE_CAMP] += 1
        start = 0 if joueur == 0 else TAILLE_CAMP
        vuln = sum(1 for i in range(TAILLE_CAMP) if plateau_before[start + i] in (1, 2))
        rate = self.player_profile["vulnerability_rate"]
        self.player_profile["vulnerability_rate"] = rate * 0.9 + (0.1 if vuln > 0 else 0.0)

    @staticmethod
    def sigmoid(eval_score: float) -> float:
        return 1.0 / (1.0 + math.exp(-eval_score / 10.0))
