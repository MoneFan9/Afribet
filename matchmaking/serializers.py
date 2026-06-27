"""Serializers DRF matchmaking (CU3-CU8) — forme des requêtes/réponses."""
from __future__ import annotations

from rest_framework import serializers

from .models import Match, OpponentType, PairingMode, StakeKind, TimingMode


class CreateChallengeSerializer(serializers.Serializer):
    game_key = serializers.CharField(max_length=32, default="songo")
    opponent_type = serializers.ChoiceField(choices=OpponentType.choices)
    timing_mode = serializers.ChoiceField(choices=TimingMode.choices, default=TimingMode.REALTIME)
    pairing_mode = serializers.ChoiceField(choices=PairingMode.choices, default=PairingMode.AUTO)
    stake_kind = serializers.ChoiceField(choices=StakeKind.choices, default=StakeKind.REAL)
    bet_amount = serializers.IntegerField(min_value=1)
    ai_level = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")


class JoinByCodeSerializer(serializers.Serializer):
    access_code = serializers.CharField(max_length=16)


class TrainingSerializer(serializers.Serializer):
    game_key = serializers.CharField(max_length=32, default="songo")
    ai_level = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")
    timing_mode = serializers.ChoiceField(choices=TimingMode.choices, default=TimingMode.REALTIME)


class PlayMoveSerializer(serializers.Serializer):
    move = serializers.IntegerField()


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = [
            "id", "game_key", "opponent_type", "timing_mode", "pairing_mode",
            "stake_kind", "is_training", "bet_amount", "currency", "status", "current_player",
            "ai_level", "rake_amount", "end_reason", "access_code", "game_state",
            "player_1", "player_2", "winner", "created_at",
        ]
