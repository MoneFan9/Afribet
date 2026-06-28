"""
Vues wallet (EF5, CU17) — consultation des 4 soldes et conversion virtuel→réel.
Adaptation web : délèguent aux services.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.errors import DomainError

from .services import WalletService


class BalanceView(APIView):
    """Soldes des quatre poches (réel + bonus, disponible + verrouillé)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        b = WalletService().get_balance(request.user)
        return Response({k: int(v.amount) for k, v in b.items()} | {"currency": list(b.values())[0].currency})


class ConvertView(APIView):
    """Conversion virtuel→réel par tranches entières, sous KYC (CU17)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from bonus.services import BonusService

        try:
            result = BonusService().convert_bonus_to_real(request.user)
        except DomainError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_200_OK)
