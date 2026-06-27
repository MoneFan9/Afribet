"""
Framework de jeux enfichable (conception §Classes « Framework de jeux », frontière 1).

**Aucun import Django ici ni dans les sous-modules** : le cœur jeu est du Python pur,
déterministe et testable (ENF4). La plateforme ne dialogue avec un jeu qu'à travers
`GameModule`/`GameAI` via `GameRegistry`/`GameService`, en ne voyant qu'un `game_key`
et un état **opaque** (JSON).
"""
