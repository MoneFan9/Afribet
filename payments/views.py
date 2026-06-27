"""
Vues DRF paiement (CU2/CU7) — adaptation web : délèguent à `PaymentService`.
Le callback sandbox est public (webhook) mais **idempotent** côté service (ENF8).
"""
from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.errors import DomainError
from core.money import Money

from .serializers import DepositSerializer, SandboxCallbackSerializer, WithdrawSerializer
from .services import PaymentService
from .tasks import process_callback


class DepositView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = DepositSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        amount = Money(s.validated_data["amount"], settings.DEFAULT_CURRENCY)
        idem = request.headers.get("Idempotency-Key") or None
        try:
            out = PaymentService().deposit(
                request.user, amount, method=s.validated_data["method"], idempotency_key=idem
            )
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        intent = out["intent"]
        return Response(
            {"intent_id": str(intent.id), "status": intent.status,
             "external_ref": intent.external_ref, "instruction": out["instruction"]},
            status=status.HTTP_201_CREATED,
        )


class WithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = WithdrawSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        amount = Money(s.validated_data["amount"], settings.DEFAULT_CURRENCY)
        try:
            intent = PaymentService().withdraw(
                request.user, amount, destination=s.validated_data["destination"]
            )
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"intent_id": str(intent.id), "status": intent.status}, status=201)


class SandboxCallbackView(APIView):
    """Webhook simulé. Public mais idempotent ; en prod, signature à vérifier (ENF8)."""

    permission_classes = [AllowAny]

    def post(self, request):
        s = SandboxCallbackSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        process_callback.delay("sandbox", dict(s.validated_data))
        return Response({"detail": "Callback reçu."}, status=status.HTTP_202_ACCEPTED)
