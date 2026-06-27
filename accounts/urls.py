"""Routes d'authentification (CU1, EF2). Préfixées par /api/auth/ (voir config.urls)."""
from __future__ import annotations

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import MeView, RegisterView, ResendCodeView, VerifyEmailView

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify/", VerifyEmailView.as_view(), name="verify"),
    path("resend/", ResendCodeView.as_view(), name="resend"),
    path("token/", TokenObtainPairView.as_view(), name="token"),  # login JWT
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
]
