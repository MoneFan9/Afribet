"""
Règles pures du Songo — port **fidèle** de `gameLogic.ts` (PoC validé).

Conventions (identiques au PoC) :
- `plateau` : liste de 14 entiers (graines par trou). Joueur 0 possède 0..6,
  joueur 1 possède 7..13. Le trou « case 7 » (piège) est l'indice 6 pour le
  joueur 0, l'indice 13 pour le joueur 1.
- `greniers` : liste [score_joueur0, score_joueur1].
- Les fonctions qui appliquent un coup **mutent** `plateau`/`greniers` en place
  (comme le PoC) ; l'encapsulation immuable est faite par `SongoModule`.

Règles couvertes : semis, **Ouragan** (>13 → bouclage), **captures en cascade**
(2–4 graines), **Solidarité** (capture annulée si elle viderait le camp adverse),
**pénalité case 7**, **famine** (nourrir l'adversaire affamé), rareté, victoire 40.
"""
from __future__ import annotations

from .constants import (
    EN_COURS,
    GRAINES_BOUCLE,
    GRAINES_PAR_TROU,
    NUL,
    SEUIL_RARETE,
    SEUIL_VICTOIRE,
    TAILLE_CAMP,
    TOTAL_TROUS,
)


def plateau_initial() -> list[int]:
    return [GRAINES_PAR_TROU] * TOTAL_TROUS


def get_destination_hole(move: int, graines: int, joueur: int) -> int | None:
    """Trou d'atterrissage de la dernière graine (port de `getDestinationHole`)."""
    if graines == 0:
        return None
    adv_start = TAILLE_CAMP if joueur == 0 else 0
    if graines > GRAINES_BOUCLE:
        restant = graines - GRAINES_BOUCLE
        return adv_start + ((restant - 1) % TAILLE_CAMP)
    return (move + graines) % TOTAL_TROUS


def _in_adv_camp(i: int, joueur: int) -> bool:
    """Le trou `i` appartient-il au camp adverse de `joueur` ?"""
    if joueur == 0:
        return TAILLE_CAMP <= i < TOTAL_TROUS
    return 0 <= i < TAILLE_CAMP


def est_famine(plateau: list[int], joueur: int) -> bool:
    """Vrai si le **camp adverse** de `joueur` est totalement vide (adversaire affamé)."""
    start = TAILLE_CAMP if joueur == 0 else 0
    end = TOTAL_TROUS if joueur == 0 else TAILLE_CAMP
    return sum(plateau[start:end]) == 0


def simuler_nourrissage(plateau: list[int], move: int, joueur: int) -> int:
    """Nombre de graines qui atterriraient dans le camp adverse si on jouait `move`."""
    graines = plateau[move]
    idx = move
    count = 0
    if graines > GRAINES_BOUCLE:
        for _ in range(GRAINES_BOUCLE):
            idx = (idx + 1) % TOTAL_TROUS
            if _in_adv_camp(idx, joueur):
                count += 1
        count += graines - GRAINES_BOUCLE
    else:
        for _ in range(graines):
            idx = (idx + 1) % TOTAL_TROUS
            if _in_adv_camp(idx, joueur):
                count += 1
    return count


def get_coups_legaux(plateau: list[int], joueur: int) -> list[int]:
    """Coups légaux de `joueur` (gère la règle de famine et le piège case 7)."""
    start = 0 if joueur == 0 else TAILLE_CAMP
    end = TAILLE_CAMP if joueur == 0 else TOTAL_TROUS
    coups_de_base = [i for i in range(start, end) if plateau[i] > 0]

    if est_famine(plateau, joueur):
        # Obligation de nourrir l'adversaire affamé.
        nourrissants = [
            (m, simuler_nourrissage(plateau, m, joueur)) for m in coups_de_base
        ]
        nourrissants = [(m, c) for (m, c) in nourrissants if c > 0]
        if not nourrissants:
            return []
        priorite7 = [m for (m, c) in nourrissants if c >= TAILLE_CAMP]
        if priorite7:
            return priorite7
        max_feed = max(c for (_, c) in nourrissants)
        return [m for (m, c) in nourrissants if c == max_feed]

    # Pas de famine : la case 7 avec 1 ou 2 graines est interdite (piège pénalité).
    case7 = 6 if joueur == 0 else 13
    return [m for m in coups_de_base if not (m == case7 and plateau[m] in (1, 2))]


def appliquer_coup(plateau: list[int], greniers: list[int], joueur: int, move: int) -> dict | None:
    """Applique `move` en mutant `plateau`/`greniers`. Renvoie un événement ou None."""
    graines = plateau[move]
    case7 = 6 if joueur == 0 else 13

    # Pénalité case 7 : jouer 1 ou 2 graines depuis sa case 7 les donne à l'adversaire.
    if move == case7 and graines in (1, 2):
        greniers[1 - joueur] += graines
        plateau[move] = 0
        return {"type": "penalty_case_7", "seeds": graines, "to": 1 - joueur}

    plateau[move] = 0
    idx = move
    adv_start = TAILLE_CAMP if joueur == 0 else 0

    if graines > GRAINES_BOUCLE:
        # Ouragan : un tour complet (13 trous) puis surplus déversé dans le camp adverse.
        for _ in range(GRAINES_BOUCLE):
            idx = (idx + 1) % TOTAL_TROUS
            plateau[idx] += 1
        restant = graines - GRAINES_BOUCLE
        adv_idx = 0
        while restant > 0:
            cible = adv_start + (adv_idx % TAILLE_CAMP)
            plateau[cible] += 1
            restant -= 1
            idx = cible
            adv_idx += 1
    else:
        for _ in range(graines):
            idx = (idx + 1) % TOTAL_TROUS
            plateau[idx] += 1

    # Capture : dernière graine dans le camp adverse (hors 1re case adverse), trou à 2–4.
    case1_adv = TAILLE_CAMP if joueur == 0 else 0
    if _in_adv_camp(idx, joueur) and idx != case1_adv and 2 <= plateau[idx] <= 4:
        temp_idx = idx
        captures: list[int] = []
        while _in_adv_camp(temp_idx, joueur):
            if 2 <= plateau[temp_idx] <= 4:
                captures.append(temp_idx)
                temp_idx = (temp_idx - 1 + TOTAL_TROUS) % TOTAL_TROUS
            else:
                break
        total_adv = sum(plateau[adv_start:adv_start + TAILLE_CAMP])
        total_capture = sum(plateau[c] for c in captures)
        # Solidarité : ne pas vider entièrement le camp adverse.
        if total_adv == total_capture:
            return {"type": "solidarity"}
        for c in captures:
            greniers[joueur] += plateau[c]
            plateau[c] = 0
        return {"type": "capture", "seeds": total_capture, "holes": captures}

    return None


def check_fin_partie(plateau: list[int], greniers: list[int]) -> int:
    """-1 si la partie continue, 0/1 = gagnant, 2 = nul (port de `checkFinPartie`)."""
    if greniers[0] >= SEUIL_VICTOIRE:
        return 0
    if greniers[1] >= SEUIL_VICTOIRE:
        return 1
    total_plateau = sum(plateau)
    if total_plateau < SEUIL_RARETE:
        g0 = greniers[0] + sum(plateau[0:TAILLE_CAMP])
        g1 = greniers[1] + sum(plateau[TAILLE_CAMP:TOTAL_TROUS])
        if g0 > g1:
            return 0
        if g1 > g0:
            return 1
        return NUL
    return EN_COURS
