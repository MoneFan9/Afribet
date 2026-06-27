"""
`PlatformConfig` — clé/valeur JSON éditable depuis le back-office (conception §13).

Permet d'« ouvrir un nouveau pays » / d'ajuster rake, durées, plafonds **sans
redéploiement**. Les valeurs `[DÉFAUT]` de repli vivent dans `core.config.DEFAULTS` ;
cette table ne contient que les **surcharges**. Le hub admin complet est étoffé en
Phase 8.
"""
from __future__ import annotations

from django.db import models

from core.config import DEFAULTS


class PlatformConfig(models.Model):
    """Une ligne = un paramètre d'exploitation surchargé."""

    key = models.CharField(max_length=64, primary_key=True)
    value = models.JSONField()
    description = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "backoffice_platform_config"
        verbose_name = "paramètre de plateforme"
        verbose_name_plural = "paramètres de plateforme"

    def __str__(self) -> str:  # pragma: no cover - repr trivial
        return f"{self.key} = {self.value!r}"

    @classmethod
    def seed_defaults(cls) -> int:
        """Matérialise en base les `[DÉFAUT]` manquants (idempotent). Renvoie le nb créés."""
        created = 0
        for key, value in DEFAULTS.items():
            _, was_created = cls.objects.get_or_create(key=key, defaults={"value": value})
            created += int(was_created)
        return created
