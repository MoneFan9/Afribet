"""Tests de l'accès configuration (repli [DÉFAUT] + surcharge PlatformConfig)."""
from __future__ import annotations

from decimal import Decimal

import pytest

from core import config


def test_defaut_sans_base():
    # Sans surcharge, on lit la valeur [DÉFAUT].
    assert config.get_int("move_timer_seconds") == 30
    assert config.get_int("grace_seconds") == 45
    assert config.get_decimal("rake_rate") == Decimal("0.05")
    assert config.get_str("disconnect_policy") == "AUTO_RESOLVE"


def test_cle_inconnue():
    assert config.get("cle_inexistante", default="x") == "x"


@pytest.mark.django_db
def test_surcharge_depuis_platformconfig():
    from backoffice.models import PlatformConfig

    PlatformConfig.objects.create(key="move_timer_seconds", value=20)
    assert config.get_int("move_timer_seconds") == 20  # la surcharge prime


@pytest.mark.django_db
def test_seed_defaults_idempotent():
    from backoffice.models import PlatformConfig

    n1 = PlatformConfig.seed_defaults()
    n2 = PlatformConfig.seed_defaults()
    assert n1 == len(config.DEFAULTS)
    assert n2 == 0  # rien de neuf au second passage
