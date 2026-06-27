"""Réglages de production (durcis ; prestataires réels greffés post-MVP)."""
from __future__ import annotations

from .base import *  # noqa: F401,F403

DEBUG = False

# Sécurité (ENF8). À compléter selon l'hébergement / juridiction.
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
