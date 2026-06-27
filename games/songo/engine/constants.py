"""Constantes du Songo (port de `constants.ts`, validées par le PoC).

Plateau de 2×7 trous (14), 70 graines (5 par trou au départ), deux greniers.
Victoire à 40 graines ; fin par rareté si moins de 10 graines restent en jeu.
"""

TAILLE_CAMP = 7
TOTAL_TROUS = TAILLE_CAMP * 2  # 14
SEUIL_VICTOIRE = 40
SEUIL_RARETE = 10
GRAINES_BOUCLE = TOTAL_TROUS - 1  # 13 : au-delà, le semis « boucle » (Ouragan)
GRAINES_PAR_TROU = 5

# Résultats de fin de partie (cf. check_fin_partie).
EN_COURS = -1
NUL = 2
