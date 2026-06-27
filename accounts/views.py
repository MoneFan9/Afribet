"""
Vues DRF `accounts` (CU1) — adaptation web pure : elles délèguent à `AuthService`
et traduisent les erreurs domaine en réponses HTTP. Aucune règle métier ici.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.errors import DomainError

from .serializers import (
    RegisterSerializer,
    ResendCodeSerializer,
    UserSerializer,
    VerifyCodeSerializer,
)
from .services import AuthService


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user = AuthService().register(**s.validated_data)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "Compte créé. Un code de vérification a été envoyé par e-mail.",
             "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        s = VerifyCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            result = AuthService().verify_email_code(**s.validated_data)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"user": UserSerializer(result["user"]).data, "tokens": result["tokens"]},
            status=status.HTTP_200_OK,
        )


class ResendCodeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_email"

    def post(self, request):
        s = ResendCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            AuthService().resend_email_code(**s.validated_data)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Nouveau code envoyé."}, status=status.HTTP_200_OK)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login JWT avec limitation de débit (anti-brute-force mot de passe)."""

    throttle_scope = "auth_email"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
