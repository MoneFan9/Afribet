"""
Hachage de Zobrist (port de `zobrist.ts`).

**Différence assumée vs le PoC** : la table est générée par un RNG **seedé** (constante
fixe) au lieu de `Math.random()`, pour garantir le **déterminisme et la rejouabilité**
(ENF4, équité argent §7.4 — les coups IA doivent être auditables/reproductibles).
"""
from __future__ import annotations

import random

from ..engine.constants import TOTAL_TROUS

# Graine fixe : la table est identique à chaque démarrage du processus.
_ZOBRIST_SEED = 0xA371B0C9
_MAX_SEEDS = 150

_rng = random.Random(_ZOBRIST_SEED)
ZOBRIST_BOARD = [[_rng.getrandbits(32) for _ in range(_MAX_SEEDS)] for _ in range(TOTAL_TROUS)]
ZOBRIST_PLAYER = _rng.getrandbits(32)


def zobrist_hash(plateau: list[int], joueur: int) -> int:
    h = 0
    for i in range(TOTAL_TROUS):
        if plateau[i] > 0:
            h ^= ZOBRIST_BOARD[i][min(plateau[i], _MAX_SEEDS - 1)]
    if joueur == 1:
        h ^= ZOBRIST_PLAYER
    return h
