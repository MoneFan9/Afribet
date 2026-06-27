"""Serializers DRF paiement (CU2/CU7) — validation de forme."""
from __future__ import annotations

from rest_framework import serializers


class DepositSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1)
    method = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")


class WithdrawSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1)
    destination = serializers.CharField(max_length=128)


class SandboxCallbackSerializer(serializers.Serializer):
    external_ref = serializers.CharField(max_length=128)
    status = serializers.CharField(max_length=16)
