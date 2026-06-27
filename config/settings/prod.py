"""Réglages de production (durcis ; prestataires réels greffés post-MVP)."""
from __future__ import annotations

import os

from .base import *  # noqa: F401,F403

DEBUG = False

# En production, la clé secrète DOIT venir de l'environnement (jamais le repli dev).
if not os.environ.get("DJANGO_SECRET_KEY"):
    raise RuntimeError(
        "DJANGO_SECRET_KEY est obligatoire en production (aucune clé de repli autorisée)."
    )
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

# Sécurité (ENF8). À compléter selon l'hébergement / juridiction.
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
