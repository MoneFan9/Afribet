"""
`MatchLifecycleService` (couche contrôle, CU5/CU8/CU11) — orchestre le jeu en
**serveur-autoritaire** : chaque coup est recalculé/validé côté serveur, journalisé
(`Move`), et la résolution est déléguée à `MatchResolutionService`.

Équité réseau (CU8, conception §8) : timeout → **pire coup légal auto** (jamais une
défaite immédiate) ; panne serveur → **void + remboursement** ; déconnexion →
`DisconnectPolicy` (`AUTO_RESOLVE` défaut / `VOID_REFUND`) ; tout est **journalisé**.
"""
from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from core import config
from core.errors import DomainError
from games.base.service import GameService

from .models import EventType, Match, MatchEvent, MatchStatus, OpponentType, TimingMode
from .resolution import MatchResolutionService


class LifecycleError(DomainError):
    pass


class MatchNotActive(LifecycleError):
    pass


class NotYourTurn(LifecycleError):
    pass


class IllegalMove(LifecycleError):
    pass


class MatchLifecycleService:
    def __init__(self, game_service: GameService | None = None, resolution: MatchResolutionService | None = None):
        self.games = game_service or GameService()
        self.resolution = resolution or MatchResolutionService(game_service=self.games)

    # --- Helpers ----------------------------------------------------------
    def _arm_deadline(self, match: Match) -> None:
        if match.timing_mode == TimingMode.REALTIME:
            secs = config.get_int("move_timer_seconds")
            match.move_deadline = timezone.now() + timedelta(seconds=secs)
        else:
            hours = config.get_int("correspondence_move_hours")
            match.move_deadline = timezone.now() + timedelta(hours=hours)

    def _next_seq(self, match: Match) -> int:
        return match.moves.count()

    def _apply(self, match: Match, idx: int, move, *, is_auto: bool) -> bool:
        """Applique un coup validé, journalise, met à jour l'état. Renvoie `terminal`."""
        out = self.games.apply_move(match.game_key, match.game_state, idx, move)
        match.moves.create(seq=self._next_seq(match), player=idx, payload={"move": move,
                                                                           "events": out["events"]},
                           server_validated=True, is_auto=is_auto)
        match.game_state = out["state"]
        match.current_player = self.games.current_player(match.game_key, out["state"])
        return self.games.is_terminal(match.game_key, out["state"])

    def _advance_ai(self, match: Match) -> None:
        """Joue les coups de l'IA (Maison) jusqu'au tour de l'humain ou la fin (CU11)."""
        money_mode = match.stake_kind == "REAL"
        while (
            match.status == MatchStatus.ACTIVE
            and match.opponent_type == OpponentType.AI
            and match.current_player == 1  # la Maison joue l'index 1
        ):
            move = self.games.ai_move(
                match.game_key, match.game_state, 1, match.ai_level,
                money_mode=money_mode, seed=self._next_seq(match),
            )
            terminal = self._apply(match, 1, move, is_auto=False)
            if terminal:
                match.save()
                self.resolution.resolve(match)
                return
            self._arm_deadline(match)
            match.save()

    # --- CU5 : jouer un coup ---------------------------------------------
    @transaction.atomic
    def play_move(self, *, match_id, user, move) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status != MatchStatus.ACTIVE:
            raise MatchNotActive("Le match n'est pas en cours.")
        idx = match.index_for_user(user)
        if match.current_player != idx:
            raise NotYourTurn("Ce n'est pas votre tour.")
        if move not in self.games.legal_moves(match.game_key, match.game_state, idx):
            raise IllegalMove("Coup illégal.")

        terminal = self._apply(match, idx, move, is_auto=False)
        if terminal:
            match.save()
            return self.resolution.resolve(match)
        self._arm_deadline(match)
        match.save()
        if match.opponent_type == OpponentType.AI:
            self._advance_ai(match)
        return match

    # --- CU8 : timeout de coup → pire coup auto ---------------------------
    @transaction.atomic
    def on_move_timeout(self, *, match_id) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status != MatchStatus.ACTIVE:
            return match
        if match.move_deadline and timezone.now() < match.move_deadline:
            return match  # pas encore expiré
        idx = match.current_player
        move = self.games.worst_move(match.game_key, match.game_state, idx)
        terminal = self._apply(match, idx, move, is_auto=True)
        MatchEvent.objects.create(match=match, type=EventType.TIMEOUT_AUTOMOVE,
                                  data={"player": idx, "move": move})
        if terminal:
            match.save()
            return self.resolution.resolve(match)
        self._arm_deadline(match)
        match.save()
        if match.opponent_type == OpponentType.AI:
            self._advance_ai(match)
        return match

    # --- CU8 : abandon volontaire ----------------------------------------
    @transaction.atomic
    def forfeit(self, *, match_id, user) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status != MatchStatus.ACTIVE:
            raise MatchNotActive("Le match n'est pas en cours.")
        match.index_for_user(user)  # valide l'appartenance
        MatchEvent.objects.create(match=match, type=EventType.FORFEIT, data={"by": str(user.id)})
        return self.resolution.forfeit_resolve(match, loser=user)

    # --- CU8 : panne serveur → void + remboursement ----------------------
    def void_match(self, *, match_id, reason: str = "server_fault") -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        return self.resolution.void(match, reason=reason)

    # --- CU8 : présence (déconnexion / reconnexion) ----------------------
    def on_disconnect(self, *, match_id, user) -> None:
        match = Match.objects.get(id=match_id)
        MatchEvent.objects.create(match=match, type=EventType.DISCONNECT, data={"user": str(user.id)})

    def on_reconnect(self, *, match_id, user) -> dict:
        match = Match.objects.get(id=match_id)
        MatchEvent.objects.create(match=match, type=EventType.RECONNECT, data={"user": str(user.id)})
        return match.game_state  # resynchro

    @transaction.atomic
    def on_disconnect_timeout(self, *, match_id, user) -> Match:
        """Fin de fenêtre de grâce, joueur non revenu → applique `DisconnectPolicy`."""
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status != MatchStatus.ACTIVE:
            return match
        policy = config.get_str("disconnect_policy")
        if policy == "VOID_REFUND":
            return self.resolution.void(match, reason="disconnect_void")
        # AUTO_RESOLVE (défaut) : la partie se poursuit en coups auto jusqu'à résolution.
        return self._auto_finish(match)

    def _auto_finish(self, match: Match) -> Match:
        """Joue le pire coup pour le joueur au trait jusqu'à terminer (anti-rage-quit)."""
        guard = 0
        while match.status == MatchStatus.ACTIVE and guard < 2000:
            if self.games.is_terminal(match.game_key, match.game_state):
                match.save()
                return self.resolution.resolve(match)
            idx = match.current_player
            move = self.games.worst_move(match.game_key, match.game_state, idx)
            terminal = self._apply(match, idx, move, is_auto=True)
            if terminal:
                match.save()
                return self.resolution.resolve(match)
            match.save()
            guard += 1
        return match
