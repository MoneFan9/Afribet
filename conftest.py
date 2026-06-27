"""Fixtures partagées pytest."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Réinitialise le cache (compteurs de throttle DRF) avant chaque test.

    Sans cela, le `ScopedRateThrottle` accumulerait les requêtes de tous les tests
    sur la même IP → faux 429.
    """
    from django.core.cache import cache

    cache.clear()
    yield
