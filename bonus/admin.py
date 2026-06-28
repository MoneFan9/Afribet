"""Admin bonus (hub §13) : octrois et politique d'usage virtuel."""
from __future__ import annotations

from django.contrib import admin

from .models import BonusGrant, VirtualUsagePolicy


@admin.register(BonusGrant)
class BonusGrantAdmin(admin.ModelAdmin):
    list_display = ("granted_at", "user", "type", "amount", "expires_at")
    list_filter = ("type",)
    search_fields = ("user__username",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(VirtualUsagePolicy)
class VirtualUsagePolicyAdmin(admin.ModelAdmin):
    list_display = ("max_matches_per_day", "allowed_hours", "cooldown_seconds", "active", "updated_at")
