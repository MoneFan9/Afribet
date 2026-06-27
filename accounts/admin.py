"""Admin comptes (hub §13) — consultation joueurs & KYC, lecture seule."""
from __future__ import annotations

from django.contrib import admin
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "phone_number", "email", "kyc_status", "is_active", "is_system", "is_staff")
    list_filter = ("kyc_status", "is_active", "is_system", "is_staff")
    search_fields = ("username", "phone_number", "email")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
