"""
`AdminPlugin` — point d'extension pour automates d'exploitation (§13) : détection de
collusion, scoring AML, triage de litiges, modération… **Ossature** : optionnels,
enfichables, jamais bloquants pour le cœur. Aucun automate réel au MVP (post-MVP).
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class AdminPlugin(ABC):
    key: str

    @abstractmethod
    def on_event(self, event_type: str, payload: dict) -> None:
        """Réagit à un évènement d'exploitation (non bloquant)."""


class AdminPluginRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, AdminPlugin] = {}

    def register(self, plugin: AdminPlugin) -> None:
        self._plugins[plugin.key] = plugin

    def dispatch(self, event_type: str, payload: dict) -> None:
        for plugin in self._plugins.values():
            try:
                plugin.on_event(event_type, payload)
            except Exception:  # noqa: BLE001 - un automate ne doit jamais bloquer le cœur
                logger.exception("AdminPlugin %s a échoué sur %s", plugin.key, event_type)

    def available(self) -> list[str]:
        return sorted(self._plugins)


registry = AdminPluginRegistry()
