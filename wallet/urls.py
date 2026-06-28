"""Routes wallet (EF5, CU17). Préfixées /api/wallet/ (voir config.urls)."""
from __future__ import annotations

from django.urls import path

from .views import BalanceView, ConvertView

app_name = "wallet"

urlpatterns = [
    path("", BalanceView.as_view(), name="balance"),
    path("convert/", ConvertView.as_view(), name="convert"),
]
