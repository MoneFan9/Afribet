"""
Application Celery (timers de coup, callbacks paiement, payouts — conception §11).
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("afribet")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
