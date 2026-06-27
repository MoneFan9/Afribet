"""Matérialise les paramètres `[DÉFAUT]` en base pour édition depuis l'admin."""
from __future__ import annotations

from django.core.management.base import BaseCommand

from backoffice.models import PlatformConfig


class Command(BaseCommand):
    help = "Crée les paramètres de plateforme par défaut manquants (idempotent)."

    def handle(self, *args, **options):
        created = PlatformConfig.seed_defaults()
        self.stdout.write(self.style.SUCCESS(f"{created} paramètre(s) créé(s)."))
