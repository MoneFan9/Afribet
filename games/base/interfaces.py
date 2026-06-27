"""
Interfaces du framework de jeux (conception §Classes).

`GameModule` = règles serveur-autoritaires d'un jeu. `GameAI` = adversaire/IA.
La plateforme (matchmaking, lifecycle, realtime) n'appelle **que** ces méthodes ;
elle ignore tout des règles internes (frontière 1).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .types import Move, MoveResult, Player, State


class GameModule(ABC):
    """Règles d'un jeu, sans état partagé : toutes les méthodes sont pures."""

    #: Clé stable du jeu (= `Match.game_key`).
    key: str
    #: Nombre de joueurs.
    nb_players: int = 2

    @abstractmethod
    def init_state(self, config: dict | None = None) -> State:
        """État initial d'une partie (plateau, scores, joueur au trait)."""

    @abstractmethod
    def legal_moves(self, state: State, player: Player) -> list[Move]:
        """Coups légaux du `player` dans `state` (liste vide = aucun coup)."""

    @abstractmethod
    def apply_move(self, state: State, player: Player, move: Move) -> MoveResult:
        """Applique `move` et renvoie le nouvel état + événements. Ne mute pas `state`."""

    @abstractmethod
    def worst_move(self, state: State, player: Player) -> Move:
        """Pire coup **légal** pour `player` (équité réseau CU8 : timeout → coup auto)."""

    @abstractmethod
    def is_terminal(self, state: State) -> bool:
        """Vrai si la partie est finie."""

    @abstractmethod
    def winner(self, state: State) -> Player | None:
        """Index du gagnant, ou `None` si match nul ou partie en cours."""

    @abstractmethod
    def current_player(self, state: State) -> Player:
        """Joueur au trait."""

    @abstractmethod
    def serialize(self, state: State) -> dict:
        """État → dict JSON-sérialisable (stocké opaque dans `Match.game_state`)."""

    @abstractmethod
    def deserialize(self, data: dict) -> State:
        """Inverse de `serialize`."""


class GameAI(ABC):
    """Adversaire IA d'un jeu."""

    @abstractmethod
    def choose_move(self, state: State, player: Player, level: str, **kwargs) -> Move:
        """Choisit un coup pour `player` au niveau `level`.

        Peut accepter `profile` (dict **opaque**) pour exploiter un profil adverse
        appris en mode entraînement. En mode argent, ce profil doit être ignoré (§7.4).
        """

    def observe_opponent_move(self, state_before: State, move: Move, player: Player,
                              profile: dict | None = None) -> dict:
        """Met à jour et renvoie le profil adverse opaque (entraînement). Défaut : inerte."""
        return profile or {}

    def analyze(self, history: list) -> dict:  # pragma: no cover - post-MVP
        """Analyse pédagogique post-partie (optionnelle, sans service externe)."""
        return {}
