"""
Réglages de base AfriBet — communs à tous les environnements.

Conception : §1 (apps = couches + frontières), §11 (stack Django + DRF + Channels
+ Celery + Redis + PostgreSQL). Tout réglage d'exploitation paramétrable vit en base
(`backoffice.PlatformConfig`), pas en dur ici.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Racine du dépôt (config/settings/base.py -> remonte de 3 niveaux).
BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")


def env(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    return os.environ.get(key, str(default)).lower() in {"1", "true", "yes", "on"}


SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    "dev-insecure-change-me-0123456789-abcdefghijklmnopqrstuvwxyz",
)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = [h for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

# --- Applications ---------------------------------------------------------
DJANGO_APPS = [
    "daphne",  # serveur ASGI (doit précéder staticfiles pour runserver ASGI)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "channels",
]

# Apps métier = couches + frontières (conception §1).
LOCAL_APPS = [
    "core",
    "accounts",
    "notifications",
    "wallet",
    "bonus",
    "payments",
    "matchmaking",
    "realtime",
    "disputes",
    "ranking",
    "compliance",
    "backoffice",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Django est une couche d'adaptation : ASGI uniquement (temps réel, frontière 3).
ASGI_APPLICATION = "config.asgi.application"

# --- Base de données (ACID, registre, verrous — ENF1) ---------------------
# Sélection explicite : AFRIBET_DB=postgres (Docker/prod) sinon repli SQLite
# (tests & vérif locale sans serveur). Évite qu'un .env partagé force Postgres.
if env("AFRIBET_DB", "sqlite") == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB", "afribet"),
            "USER": env("POSTGRES_USER", "afribet"),
            "PASSWORD": env("POSTGRES_PASSWORD", "afribet"),
            "HOST": env("POSTGRES_HOST", "localhost"),
            "PORT": env("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Modèle utilisateur custom (téléphone unique — conception CU1). Fixé avant
# la première migration (recommandation Django).
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- i18n / fuseau (projet en français, Gabon par défaut) -----------------
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Libreville"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF + JWT (EF2) ------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    # Anti-brute-force / anti e-mail-bombing : seules les vues portant un
    # `throttle_scope` sont limitées (ScopedRateThrottle ignore les autres).
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth": env("THROTTLE_AUTH", "10/min"),       # register/verify
        "auth_email": env("THROTTLE_AUTH_EMAIL", "5/min"),  # login/resend (sensibles)
    },
}

# --- Redis / Channels (temps réel, ENF7) ----------------------------------
REDIS_URL = env("REDIS_URL", "redis://localhost:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}

# --- Celery (timers de coup, callbacks paiement, payouts — §11) -----------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = TIME_ZONE

# Devise interne par défaut (objet-valeur Money — conception §6).
DEFAULT_CURRENCY = env("AFRIBET_DEFAULT_CURRENCY", "XAF")
