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

from .models import (
    EventType,
    Match,
    MatchEvent,
    MatchStatus,
    OpponentType,
    StakeKind,
    TimingMode,
)
from .resolution import MatchResolutionService


class LifecycleError(DomainError):
    pass


class MatchNotActive(LifecycleError):
    pass


class NotYourTurn(LifecycleError):
    pass


class IllegalMove(LifecycleError):
    pass


def _schedule_move_timeout(match_id: str) -> None:
    """Planifie la tâche de timeout de coup (import paresseux : évite le cycle realtime)."""
    from realtime.services import MoveTimerService

    MoveTimerService().schedule(match_id)


class MatchLifecycleService:
    def __init__(self, game_service: GameService | None = None, resolution: MatchResolutionService | None = None):
        self.games = game_service or GameService()
        self.resolution = resolution or MatchResolutionService(game_service=self.games)

    # --- Helpers ----------------------------------------------------------
    def _arm_deadline(self, match: Match) -> None:
        """Arme l'échéance du coup et, en temps réel, planifie le timeout (CU8)."""
        if match.timing_mode == TimingMode.REALTIME:
            secs = config.get_int("move_timer_seconds")
            match.move_deadline = timezone.now() + timedelta(seconds=secs)
            # Planifie le pire-coup-auto à l'expiration, APRÈS commit (la tâche, en
            # se déclenchant, vérifie l'échéance courante → s'auto-annule si un coup
            # a entre-temps repoussé le délai). Sans cela, CU8 timeout est inopérant.
            mid = str(match.id)
            transaction.on_commit(lambda mid=mid: _schedule_move_timeout(mid))
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

    def _advance_ai(self, match: Match, *, human_move=None, pre_state=None, human_idx=None) -> None:
        """Joue les coups de l'IA (Maison) jusqu'au tour de l'humain ou la fin (CU11).

        En mode **entraînement sans enjeu** (`is_training`, EF12), l'IA apprend le
        profil adverse et l'exploite (§7.1). Dès qu'il y a un **enjeu** (réel OU bonus
        — le bonus a une valeur réelle latente, convertible 200:1), l'adaptation est
        **désactivée** (§7.4).
        """
        # Enjeu (réel OU bonus) ⇒ pas d'adaptation (§7.4). Entraînement sans enjeu
        # (EF12) ⇒ adaptation autorisée : c'est le point d'entrée du NN adaptatif.
        money_mode = (not match.is_training) and match.stake_kind in (StakeKind.REAL, StakeKind.BONUS)
        training = not money_mode
        if training and human_move is not None and pre_state is not None and human_idx is not None:
            match.ai_profile = self.games.observe_opponent_move(
                match.game_key, pre_state, human_move, human_idx, match.ai_profile
            )
        profile = match.ai_profile if training else None

        while (
            match.status == MatchStatus.ACTIVE
            and match.opponent_type == OpponentType.AI
            and match.current_player == 1  # la Maison joue l'index 1
        ):
            move = self.games.ai_move(
                match.game_key, match.game_state, 1, match.ai_level,
                money_mode=money_mode, seed=self._next_seq(match), profile=profile,
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

        pre_state = match.game_state  # état avant le coup (pour l'apprentissage IA)
        terminal = self._apply(match, idx, move, is_auto=False)
        if terminal:
            match.save()
            return self.resolution.resolve(match)
        self._arm_deadline(match)
        match.save()
        if match.opponent_type == OpponentType.AI:
            self._advance_ai(match, human_move=move, pre_state=pre_state, human_idx=idx)
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
    @transaction.atomic
    def void_match(self, *, match_id, reason: str = "server_fault") -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        return self.resolution.void(match, reason=reason)

    # --- CU8 : présence (déconnexion / reconnexion) ----------------------
    _PRESENCE_TYPES = (EventType.CONNECT, EventType.DISCONNECT, EventType.RECONNECT)

    def _latest_presence_event(self, match: Match, user):
        return (
            match.events.filter(type__in=self._PRESENCE_TYPES, data__user=str(user.id))
            .order_by("-created_at")
            .first()
        )

    def _latest_presence(self, match: Match, user) -> str | None:
        ev = self._latest_presence_event(match, user)
        return ev.type if ev else None

    def on_connect(self, *, match_id, user) -> dict:
        """Connexion au plateau : journalise CONNECT/RECONNECT et resynchronise (ENF2)."""
        match = Match.objects.get(id=match_id)
        # Si une déconnexion précède sans reconnexion, c'est une reconnexion.
        kind = (
            EventType.RECONNECT
            if self._latest_presence(match, user) == EventType.DISCONNECT
            else EventType.CONNECT
        )
        MatchEvent.objects.create(match=match, type=kind, data={"user": str(user.id)})
        return match.game_state

    def on_reconnect(self, *, match_id, user) -> dict:
        match = Match.objects.get(id=match_id)
        MatchEvent.objects.create(match=match, type=EventType.RECONNECT, data={"user": str(user.id)})
        return match.game_state  # resynchro

    def on_disconnect(self, *, match_id, user) -> MatchEvent:
        match = Match.objects.get(id=match_id)
        return MatchEvent.objects.create(
            match=match, type=EventType.DISCONNECT, data={"user": str(user.id)}
        )

    @transaction.atomic
    def on_disconnect_timeout(self, *, match_id, user, disconnect_event_id=None) -> Match:
        """Fin de fenêtre de grâce → applique `DisconnectPolicy` SI le joueur est absent.

        `disconnect_event_id` époche le timer : si une déconnexion **plus récente** a eu
        lieu (id différent), c'est son propre timer qui décidera — on s'efface pour ne
        pas raccourcir la grâce de la déconnexion courante.
        """
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status != MatchStatus.ACTIVE:
            return match
        latest = self._latest_presence_event(match, user)
        # Équité (CRITIQUE) : joueur revenu (dernier évènement ≠ DISCONNECT) → on n'agit pas.
        if latest is None or latest.type != EventType.DISCONNECT:
            return match
        # Timer périmé : une déconnexion plus récente le supersède.
        if disconnect_event_id is not None and str(latest.id) != str(disconnect_event_id):
            return match
        policy = config.get_str("disconnect_policy")
        if policy == "VOID_REFUND":
            return self.resolution.void(match, reason="disconnect_void")
        # AUTO_RESOLVE (défaut) : on auto-joue UNIQUEMENT pour l'absent ; le joueur
        # resté connecté n'est jamais forcé (les coups auto de l'absent sont ensuite
        # assurés par le timer de coup à chaque tour).
        return self._auto_finish(match, absent_idx=match.index_for_user(user))

    def _auto_finish(self, match: Match, *, absent_idx: int) -> Match:
        """Joue le pire coup pour l'absent tant que c'est son tour (anti-rage-quit, équité)."""
        guard = 0
        while match.status == MatchStatus.ACTIVE and guard < 2000:
            if self.games.is_terminal(match.game_key, match.game_state):
                match.save()
                return self.resolution.resolve(match)
            if match.current_player != absent_idx:
                # Tour du joueur présent : on le laisse jouer, on ne force rien.
                match.save()
                return match
            move = self.games.worst_move(match.game_key, match.game_state, absent_idx)
            terminal = self._apply(match, absent_idx, move, is_auto=True)
            # Audit (ENF2) : tracer chaque coup forcé pour cause de déconnexion.
            MatchEvent.objects.create(
                match=match, type=EventType.TIMEOUT_AUTOMOVE,
                data={"player": absent_idx, "move": move, "cause": "disconnect"},
            )
            if terminal:
                match.save()
                return self.resolution.resolve(match)
            self._arm_deadline(match)
            match.save()
            guard += 1
        return match
