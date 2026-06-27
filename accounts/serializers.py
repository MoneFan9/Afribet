"""Serializers DRF (couche dialogue/adaptation, CU1). Validation de forme seulement."""
from __future__ import annotations

from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    email = serializers.EmailField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True)


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=8)


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class UserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    phone_number = serializers.CharField(read_only=True)
    kyc_status = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
