from django.apps import AppConfig


class MatchmakingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "matchmaking"

    def ready(self):
        # Enregistre les modules de jeu dans le registre global (frontière 1).
        import games.songo  # noqa: F401
