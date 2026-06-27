"""Routes paiement (CU2/CU7). Préfixées /api/payments/ (voir config.urls)."""
from __future__ import annotations

from django.urls import path

from .views import DepositView, SandboxCallbackView, WithdrawView

app_name = "payments"

urlpatterns = [
    path("deposit/", DepositView.as_view(), name="deposit"),
    path("withdraw/", WithdrawView.as_view(), name="withdraw"),
    path("callback/sandbox/", SandboxCallbackView.as_view(), name="callback-sandbox"),
]
