"""Routes du front (couche dialogue, mobile-first — conception §Navigation)."""
from __future__ import annotations

from django.urls import path

from . import views

urlpatterns = [
    path("", views.landing, name="landing"),
    path("register/", views.register, name="register"),
    path("verify/", views.verify, name="verify"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("wallet/", views.wallet, name="wallet"),
    path("lobby/", views.lobby, name="lobby"),
    path("challenge/new/", views.challenge_create, name="challenge-create"),
    path("train/", views.train, name="train"),
    path("match/<uuid:match_id>/", views.match, name="match"),
    path("match/<uuid:match_id>/join/", views.join, name="join"),
]
