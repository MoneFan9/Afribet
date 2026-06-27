"""
Consumers Channels (conception §9, CU5/CU8) — couche d'adaptation temps réel.

Le consumer **ne contient aucune règle** : il authentifie, route les messages vers
`MatchLifecycleService` (serveur-autoritaire) et diffuse l'état à jour au groupe du
match. Toute la logique reste dans la service layer (frontière 3).
"""
from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class MatchConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        match = await self._get_match(self.match_id)
        if match is None or not await self._is_participant(match, user):
            await self.close(code=4403)
            return
        self.group = f"match_{self.match_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        # Journalise CONNECT/RECONNECT (audit ENF2) et resynchronise l'état (CU8).
        await self._on_connect(user)
        await self.send_json({"type": "state", **await self._serialize(match)})

    async def disconnect(self, code):
        if hasattr(self, "group"):
            user = self.scope.get("user")
            if user and user.is_authenticated:
                await self._on_disconnect(user)
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        from core.errors import DomainError

        action = content.get("action")
        user = self.scope["user"]
        try:
            if action == "play":
                match = await self._play(user, content.get("move"))
            elif action == "forfeit":
                match = await self._forfeit(user)
            else:
                await self.send_json({"type": "error", "detail": "Action inconnue."})
                return
        except DomainError as exc:
            # Seules les erreurs métier sont détaillées au client.
            await self.send_json({"type": "error", "detail": str(exc)})
            return
        except Exception:  # noqa: BLE001 - erreur interne : message générique (pas de fuite)
            await self.send_json({"type": "error", "detail": "Erreur interne du serveur."})
            return
        # Diffuse le nouvel état à tout le groupe (les deux joueurs).
        await self.channel_layer.group_send(
            self.group, {"type": "match.state", "payload": await self._serialize(match)}
        )

    async def match_state(self, event):
        await self.send_json({"type": "state", **event["payload"]})

    # --- Accès base (sync → async) ---------------------------------------
    @database_sync_to_async
    def _get_match(self, match_id):
        from matchmaking.models import Match

        return Match.objects.filter(id=match_id).first()

    @database_sync_to_async
    def _is_participant(self, match, user):
        return user.id in (match.player_1_id, match.player_2_id)

    @database_sync_to_async
    def _serialize(self, match):
        match.refresh_from_db()
        return {
            "match_id": str(match.id),
            "status": match.status,
            "current_player": match.current_player,
            "game_state": match.game_state,
            "winner": str(match.winner_id) if match.winner_id else None,
            "end_reason": match.end_reason,
        }

    @database_sync_to_async
    def _play(self, user, move):
        from matchmaking.lifecycle import MatchLifecycleService

        return MatchLifecycleService().play_move(match_id=self.match_id, user=user, move=move)

    @database_sync_to_async
    def _forfeit(self, user):
        from matchmaking.lifecycle import MatchLifecycleService

        return MatchLifecycleService().forfeit(match_id=self.match_id, user=user)

    @database_sync_to_async
    def _on_disconnect(self, user):
        from matchmaking.lifecycle import MatchLifecycleService
        from realtime.services import PresenceService

        event = MatchLifecycleService().on_disconnect(match_id=self.match_id, user=user)
        PresenceService().schedule_disconnect_timeout(self.match_id, user.id, event.id)

    @database_sync_to_async
    def _on_connect(self, user):
        from matchmaking.lifecycle import MatchLifecycleService

        MatchLifecycleService().on_connect(match_id=self.match_id, user=user)
