"""Admin conformité (§14) : juridictions, auto-exclusions, limites de jeu responsable."""
from __future__ import annotations

from django.contrib import admin

from .models import (
    ComplianceProfile,
    Jurisdiction,
    ResponsibleGamblingLimit,
    SelfExclusion,
)


@admin.register(Jurisdiction)
class JurisdictionAdmin(admin.ModelAdmin):
    list_display = ("country_code", "currency", "legal_age", "kyc_level", "gambling_allowed", "vs_ai_allowed", "active")
    list_filter = ("active", "gambling_allowed", "vs_ai_allowed")


@admin.register(SelfExclusion)
class SelfExclusionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "type", "until")
    list_filter = ("type",)
    search_fields = ("user__username",)


@admin.register(ResponsibleGamblingLimit)
class ResponsibleGamblingLimitAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "kind", "period", "value", "effective_at")
    list_filter = ("kind", "period")
    search_fields = ("user__username",)


@admin.register(ComplianceProfile)
class ComplianceProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "jurisdiction", "data_consent_at")
    search_fields = ("user__username",)
