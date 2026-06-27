"""
Crée le compte **Maison** (`is_system`) — contrepartie des parties vs IA et
bénéficiaire du rake (conception §7.3). Idempotent.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import KycStatus

User = get_user_model()
HOUSE_USERNAME = "house"


class Command(BaseCommand):
    help = "Crée (si absent) le compte système Maison."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username=HOUSE_USERNAME,
            defaults={
                "is_system": True,
                "is_active": True,
                "kyc_status": KycStatus.VERIFIED,
                "email": "house@afribet.local",
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        # Wallet + bankroll de la Maison (contrepartie vs IA, §7.3).
        from decimal import Decimal

        from core import config
        from wallet.models import Pocket, TxType
        from wallet.services import WalletService

        wallet = WalletService().ensure_wallet(user)
        bankroll = Decimal(str(config.get_int("house_initial_bankroll")))
        if wallet.available_balance < bankroll:
            from core.money import Money

            top_up = Money(bankroll - wallet.available_balance, wallet.currency)
            WalletService().credit(user, top_up, TxType.HOUSE_SETTLEMENT, Pocket.REAL,
                                   reference="house-bankroll")

        if created:
            self.stdout.write(self.style.SUCCESS("Compte Maison créé et financé."))
        else:
            self.stdout.write("Compte Maison déjà présent (bankroll vérifiée).")
