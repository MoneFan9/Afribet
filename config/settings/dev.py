"""Réglages de développement (MVP : sandbox, e-mail console, KYC stub)."""
from __future__ import annotations

from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = True
ALLOWED_HOSTS = ["*"]

# E-mail en console (code MFA lisible dans les logs — conception CU1, MVP).
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Exécution Celery synchrone possible en dev/test (pas de worker requis).
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", True)
CELERY_TASK_EAGER_PROPAGATES = True

# Channel layer en mémoire si Redis indisponible localement.
import os  # noqa: E402

if not os.environ.get("REDIS_URL"):
    CHANNEL_LAYERS = {  # noqa: F405
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
    }
