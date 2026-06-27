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
            self.stdout.write(self.style.SUCCESS("Compte Maison créé."))
        else:
            self.stdout.write("Compte Maison déjà présent.")
