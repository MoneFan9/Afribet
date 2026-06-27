"""
Vues DRF matchmaking (CU3-CU8) — adaptation web : délèguent aux services
(`MatchmakingService`, `MatchLifecycleService`). Le temps réel passe par les
consumers Channels ; ces endpoints couvrent le mode différé et les actions hors-WS.
"""
from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.errors import DomainError
from core.money import Money

from .lifecycle import MatchLifecycleService
from .models import Match
from .serializers import (
    CreateChallengeSerializer,
    JoinByCodeSerializer,
    MatchSerializer,
    PlayMoveSerializer,
)
from .services import MatchmakingService


def _match_or_403(match_id, user):
    match = get_object_or_404(Match, id=match_id)
    if user.id not in (match.player_1_id, match.player_2_id):
        return None
    return match


class ChallengeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = CreateChallengeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        bet = Money(data.pop("bet_amount"), settings.DEFAULT_CURRENCY)
        try:
            match = MatchmakingService().create_challenge(creator=request.user, bet_amount=bet, **data)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data, status=status.HTTP_201_CREATED)


class LobbyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        matches = MatchmakingService().list_open_challenges(
            game_key=request.query_params.get("game_key", ""),
            stake_kind=request.query_params.get("stake_kind", ""),
        )
        return Response(MatchSerializer(matches, many=True).data)


class JoinLobbyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        try:
            match = MatchmakingService().join_from_lobby(joiner=request.user, match_id=match_id)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data)


class JoinByCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = JoinByCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            match = MatchmakingService().join_by_code(joiner=request.user, **s.validated_data)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data)


class CancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        try:
            match = MatchmakingService().cancel_challenge(creator=request.user, match_id=match_id)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data)


class PlayView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        if _match_or_403(match_id, request.user) is None:
            return Response({"detail": "Non participant."}, status=status.HTTP_403_FORBIDDEN)
        s = PlayMoveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            match = MatchLifecycleService().play_move(
                match_id=match_id, user=request.user, move=s.validated_data["move"]
            )
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data)


class ForfeitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        if _match_or_403(match_id, request.user) is None:
            return Response({"detail": "Non participant."}, status=status.HTTP_403_FORBIDDEN)
        try:
            match = MatchLifecycleService().forfeit(match_id=match_id, user=request.user)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(MatchSerializer(match).data)


class MatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id):
        if _match_or_403(match_id, request.user) is None:
            return Response({"detail": "Non participant."}, status=status.HTTP_403_FORBIDDEN)
        return Response(MatchSerializer(get_object_or_404(Match, id=match_id)).data)
