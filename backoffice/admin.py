"""
Hub d'exploitation (conception §13) — admin Django étendu : registre **immuable**
protégé, finances, matchs, paiements, configuration, actions humaines (le moins
possible, le reste automatisé).
"""
from __future__ import annotations

from django.contrib import admin, messages

from matchmaking.models import Match, MatchEvent, Move
from payments.models import IntentStatus, PaymentIntent
from wallet.models import Transaction, Wallet

from .models import GameSetting, PlatformConfig, ProviderSetting


class ReadOnlyAdmin(admin.ModelAdmin):
    """Base lecture seule (consultation, jamais de mutation depuis l'admin)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Transaction)
class TransactionAdmin(ReadOnlyAdmin):
    """Registre **immuable** : strictement consultable (ENF1)."""

    list_display = ("created_at", "user", "type", "pocket", "amount", "balance_after", "status")
    list_filter = ("type", "pocket", "status", "currency")
    search_fields = ("user__username", "match_id", "reference")
    date_hierarchy = "created_at"


@admin.register(Wallet)
class WalletAdmin(ReadOnlyAdmin):
    list_display = ("user", "available_balance", "locked_balance", "bonus_available", "bonus_locked", "currency")
    search_fields = ("user__username",)


@admin.register(PaymentIntent)
class PaymentIntentAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "direction", "amount", "status", "needs_review", "provider_key")
    list_filter = ("direction", "status", "needs_review", "provider_key")
    search_fields = ("user__username", "external_ref")
    actions = ["approve_review"]

    readonly_fields = ("user", "direction", "amount", "currency", "provider_key",
                       "method", "external_ref", "idempotency_key", "destination")

    @admin.action(description="Valider le retrait en revue (initie le payout)")
    def approve_review(self, request, queryset):
        from payments.services import PaymentService

        svc = PaymentService()
        n = 0
        for intent in queryset.filter(needs_review=True, status=IntentStatus.PENDING):
            svc.approve_withdrawal(intent)
            n += 1
        self.message_user(request, f"{n} retrait(s) validé(s) et initié(s).", messages.SUCCESS)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # lecture seule sauf l'action de validation


@admin.register(Match)
class MatchAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "game_key", "opponent_type", "status", "stake_kind", "bet_amount", "is_training", "winner")
    list_filter = ("status", "opponent_type", "stake_kind", "is_training", "game_key")
    search_fields = ("id", "player_1__username", "player_2__username")
    actions = ["void_and_refund"]

    @admin.action(description="Annuler + rembourser (void)")
    def void_and_refund(self, request, queryset):
        from matchmaking.lifecycle import MatchLifecycleService

        svc = MatchLifecycleService()
        done = 0
        for match in queryset:
            svc.void_match(match_id=match.id, reason="admin_void")
            done += 1
        self.message_user(request, f"{done} match(s) annulé(s) et remboursé(s).", messages.SUCCESS)

    def has_change_permission(self, request, obj=None):
        return False  # lecture seule sauf actions


@admin.register(MatchEvent)
class MatchEventAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "match", "type")
    list_filter = ("type",)


@admin.register(Move)
class MoveAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "match", "seq", "player", "is_auto")
    list_filter = ("is_auto",)


@admin.register(PlatformConfig)
class PlatformConfigAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at")
    search_fields = ("key",)


@admin.register(GameSetting)
class GameSettingAdmin(admin.ModelAdmin):
    list_display = ("game_key", "enabled")


@admin.register(ProviderSetting)
class ProviderSettingAdmin(admin.ModelAdmin):
    list_display = ("provider_key", "enabled")
