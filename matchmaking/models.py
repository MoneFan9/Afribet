"""
Matchmaking (conception §Classes, CU3-CU4) — couche entité, **sans aucune règle de
jeu** (frontière 1). Un `Match` porte un `game_key`, un `game_state` **opaque** (JSON),
une mise et une poche ; les règles vivent dans `games/`.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class OpponentType(models.TextChoices):
    HUMAN = "HUMAN", "Humain"
    AI = "AI", "IA / Maison"


class TimingMode(models.TextChoices):
    REALTIME = "REALTIME", "Temps réel"
    CORRESPONDENCE = "CORRESPONDENCE", "Différé"


class PairingMode(models.TextChoices):
    AUTO = "AUTO", "Automatique (lobby)"
    INVITE_CODE = "INVITE_CODE", "Code d'accès"


class StakeKind(models.TextChoices):
    REAL = "REAL", "Réelle"
    BONUS = "BONUS", "Bonus/virtuelle"


class MatchStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    ACTIVE = "ACTIVE", "En cours"
    COMPLETED = "COMPLETED", "Terminé"
    CANCELLED = "CANCELLED", "Annulé"


class EndReason(models.TextChoices):
    WIN = "WIN", "Victoire"
    DRAW = "DRAW", "Nul"
    FORFEIT = "FORFEIT", "Forfait"
    TIMEOUT = "TIMEOUT", "Temps écoulé"
    DISCONNECT = "DISCONNECT", "Déconnexion"
    VOID = "VOID", "Annulé/remboursé"


class EventType(models.TextChoices):
    CONNECT = "CONNECT", "Connexion"
    DISCONNECT = "DISCONNECT", "Déconnexion"
    RECONNECT = "RECONNECT", "Reconnexion"
    TIMEOUT_AUTOMOVE = "TIMEOUT_AUTOMOVE", "Coup auto (timeout)"
    FORFEIT = "FORFEIT", "Forfait"
    RESOLVE = "RESOLVE", "Résolution"
    VOID = "VOID", "Annulation"


class Match(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game_key = models.CharField(max_length=32)  # opaque pour la plateforme
    opponent_type = models.CharField(max_length=8, choices=OpponentType.choices)
    timing_mode = models.CharField(max_length=16, choices=TimingMode.choices)
    pairing_mode = models.CharField(max_length=16, choices=PairingMode.choices)
    access_code = models.CharField(max_length=16, null=True, blank=True, unique=True)
    access_code_expires_at = models.DateTimeField(null=True, blank=True)
    stake_kind = models.CharField(max_length=8, choices=StakeKind.choices)
    # Match d'entraînement (EF12 « sans enjeu ») : aucun escrow, aucune Transaction,
    # ni rake ni Elo ; l'IA y est **adaptative** (mode non-argent, §7.4).
    is_training = models.BooleanField(default=False)
    bet_amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=8, default="XAF")
    game_state = models.JSONField(null=True, blank=True)  # état opaque du jeu
    status = models.CharField(max_length=10, choices=MatchStatus.choices, default=MatchStatus.PENDING)
    current_player = models.PositiveSmallIntegerField(default=0)
    ai_level = models.CharField(max_length=16, blank=True, default="")
    # Profil adverse appris par l'IA (mode entraînement uniquement ; jamais en argent
    # — équité §7.4). Persisté entre les coups d'un même match. Opaque côté jeu.
    ai_profile = models.JSONField(null=True, blank=True)
    rake_amount = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    end_reason = models.CharField(max_length=10, choices=EndReason.choices, blank=True, default="")
    move_deadline = models.DateTimeField(null=True, blank=True)

    player_1 = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="matches_as_p1"
    )
    player_2 = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="matches_as_p2",
        null=True, blank=True,
    )
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="matches_won",
        null=True, blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "matchmaking_match"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "pairing_mode"]),
            models.Index(fields=["game_key", "status"]),
        ]

    # Index (0/1) → joueur. player_1 joue 0, player_2 joue 1.
    def user_for_index(self, index: int):
        return self.player_1 if index == 0 else self.player_2

    def index_for_user(self, user) -> int:
        if user.id == self.player_1_id:
            return 0
        if user.id == self.player_2_id:
            return 1
        # Défense en profondeur : ne jamais traiter un tiers comme player_2.
        from core.errors import NotParticipant

        raise NotParticipant("Cet utilisateur ne participe pas à ce match.")

    def __str__(self) -> str:  # pragma: no cover
        return f"Match {self.id} {self.game_key} [{self.status}]"


class Move(models.Model):
    """Journal des coups (Command/event sourcing léger — rejouabilité, audit)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="moves")
    seq = models.PositiveIntegerField()
    player = models.PositiveSmallIntegerField()
    payload = models.JSONField()
    server_validated = models.BooleanField(default=True)
    is_auto = models.BooleanField(default=False)  # coup forcé (timeout) — équité CU8
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "matchmaking_move"
        ordering = ["seq"]
        unique_together = [("match", "seq")]


class MatchEvent(models.Model):
    """Journal d'audit horodaté (ENF2) : connexions, timeouts, résolutions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="events")
    type = models.CharField(max_length=20, choices=EventType.choices)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "matchmaking_event"
        ordering = ["created_at"]
