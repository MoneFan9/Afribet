"""
Modèles abstraits partagés (couche entité). Les entités métier en héritent pour
un identifiant UUID stable et des horodatages d'audit (ENF2 : journal horodaté).
"""
from __future__ import annotations

import uuid

from django.db import models


class UUIDModel(models.Model):
    """Clé primaire UUID (identifiants non devinables, conformes à la conception)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    """Horodatage création / mise à jour."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDTimestampedModel(UUIDModel, TimestampedModel):
    class Meta:
        abstract = True
