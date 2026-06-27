"""Routes matchmaking (CU3-CU8). Préfixées /api/matches/ (voir config.urls)."""
from __future__ import annotations

from django.urls import path

from .views import (
    CancelView,
    ChallengeView,
    ForfeitView,
    JoinByCodeView,
    JoinLobbyView,
    LobbyView,
    MatchDetailView,
    PlayView,
)

app_name = "matchmaking"

urlpatterns = [
    path("challenges/", ChallengeView.as_view(), name="challenge-create"),
    path("lobby/", LobbyView.as_view(), name="lobby"),
    path("join-by-code/", JoinByCodeView.as_view(), name="join-by-code"),
    path("<uuid:match_id>/", MatchDetailView.as_view(), name="detail"),
    path("<uuid:match_id>/join/", JoinLobbyView.as_view(), name="join"),
    path("<uuid:match_id>/cancel/", CancelView.as_view(), name="cancel"),
    path("<uuid:match_id>/play/", PlayView.as_view(), name="play"),
    path("<uuid:match_id>/forfeit/", ForfeitView.as_view(), name="forfeit"),
]
