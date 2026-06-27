"""
`MatchResolutionService` (couche contrôle, CU6) — détermine l'issue **côté serveur**
et règle l'escrow **atomiquement** via `WalletService`. Journalise `MatchEvent`.

Issues : victoire (settle gagnant net du rake), nul (remboursement), void/faute
serveur (remboursement). Le rake n'est prélevé qu'en argent **réel**.
"""
from __future__ import annotations

from django.db import transaction

from core.money import Money
from games.base.service import GameService
from wallet.services import WalletService

from .models import EndReason, EventType, Match, MatchEvent, MatchStatus
from .services import get_house, pocket_for


class MatchResolutionService:
    def __init__(self, wallet_service: WalletService | None = None, game_service: GameService | None = None):
        self.wallet = wallet_service or WalletService()
        self.games = game_service or GameService()

    @transaction.atomic
    def resolve(self, match: Match) -> Match:
        """Résout un match terminé selon son état de jeu (victoire ou nul)."""
        # Verrou + relecture du statut : idempotence robuste même si appelé hors du
        # verrou d'un appelant (anti double-règlement concurrent).
        match = Match.objects.select_for_update().get(pk=match.pk)
        if match.status != MatchStatus.ACTIVE:
            return match
        winner_idx = self.games.winner(match.game_key, match.game_state)
        if match.is_training:
            return self._finalize_training(match, winner_idx, EndReason.WIN if winner_idx is not None else EndReason.DRAW)
        if winner_idx is None:
            return self._draw(match)
        return self._win(match, winner_idx)

    # --- Entraînement (EF12) : clôture SANS aucun mouvement financier ------
    def _finalize_training(self, match: Match, winner_idx, reason: str) -> Match:
        if winner_idx is not None:
            match.winner = match.user_for_index(winner_idx)
        match.status = MatchStatus.COMPLETED
        match.end_reason = reason
        match.save(update_fields=["winner", "status", "end_reason"])
        self._event(match, EventType.RESOLVE, {"training": True, "reason": reason})
        return match

    # --- Victoire ---------------------------------------------------------
    def _win(self, match: Match, winner_idx: int) -> Match:
        winner = match.user_for_index(winner_idx)
        loser = match.user_for_index(1 - winner_idx)
        stake = Money(match.bet_amount, match.currency)
        res = self.wallet.settle_escrow(
            match_id=match.id, winner=winner, loser=loser, stake=stake,
            pocket=pocket_for(match.stake_kind), house=get_house(),
            rake_rate=self._rake_rate(match),
        )
        match.winner = winner
        match.rake_amount = res["rake"].amount
        match.status = MatchStatus.COMPLETED
        match.end_reason = EndReason.WIN
        match.save(update_fields=["winner", "rake_amount", "status", "end_reason"])
        self._event(match, EventType.RESOLVE, {
            "winner": str(winner.id), "rake": str(res["rake"].amount), "reason": EndReason.WIN,
        })
        return match

    # --- Nul --------------------------------------------------------------
    def _draw(self, match: Match) -> Match:
        self._refund_both(match)
        match.status = MatchStatus.COMPLETED
        match.end_reason = EndReason.DRAW
        match.save(update_fields=["status", "end_reason"])
        self._event(match, EventType.RESOLVE, {"reason": EndReason.DRAW})
        return match

    # --- Void / faute serveur (CU8) --------------------------------------
    @transaction.atomic
    def void(self, match: Match, *, reason: str = "server_fault") -> Match:
        """Annule un match et **rembourse les deux** (panne serveur, ENF2)."""
        match = Match.objects.select_for_update().get(pk=match.pk)
        if match.status not in (MatchStatus.ACTIVE, MatchStatus.PENDING):
            return match
        if match.is_training:
            # Entraînement : rien à rembourser, on annule simplement.
            match.status = MatchStatus.CANCELLED
            match.end_reason = EndReason.VOID
            match.save(update_fields=["status", "end_reason"])
            self._event(match, EventType.VOID, {"reason": reason, "training": True})
            return match
        if match.player_2_id is not None:
            self._refund_both(match)
        else:
            # Défi non engagé : seul le créateur a verrouillé.
            stake = Money(match.bet_amount, match.currency)
            self.wallet.refund_escrow(
                match_id=match.id, entries=[(match.player_1, stake)], pocket=pocket_for(match.stake_kind)
            )
        match.status = MatchStatus.CANCELLED
        match.end_reason = EndReason.VOID
        match.save(update_fields=["status", "end_reason"])
        self._event(match, EventType.VOID, {"reason": reason})
        return match

    # --- Forfait (CU8) ----------------------------------------------------
    def forfeit_resolve(self, match: Match, *, loser) -> Match:
        """L'adversaire du `loser` gagne (abandon volontaire / sanction)."""
        loser_idx = match.index_for_user(loser)
        return self._win_with_reason(match, 1 - loser_idx, EndReason.FORFEIT)

    @transaction.atomic
    def _win_with_reason(self, match: Match, winner_idx: int, reason: str) -> Match:
        match = Match.objects.select_for_update().get(pk=match.pk)
        if match.status != MatchStatus.ACTIVE:
            return match
        if match.is_training:  # forfait/déco en entraînement : pas de règlement
            return self._finalize_training(match, winner_idx, reason)
        winner = match.user_for_index(winner_idx)
        loser = match.user_for_index(1 - winner_idx)
        stake = Money(match.bet_amount, match.currency)
        res = self.wallet.settle_escrow(
            match_id=match.id, winner=winner, loser=loser, stake=stake,
            pocket=pocket_for(match.stake_kind), house=get_house(),
            rake_rate=self._rake_rate(match),
        )
        match.winner = winner
        match.rake_amount = res["rake"].amount
        match.status = MatchStatus.COMPLETED
        match.end_reason = reason
        match.save(update_fields=["winner", "rake_amount", "status", "end_reason"])
        self._event(match, EventType.RESOLVE, {"winner": str(winner.id), "reason": reason})
        return match

    # --- Internes ---------------------------------------------------------
    @staticmethod
    def _rake_rate(match: Match):
        """Taux de rake borné par la juridiction du créateur (§14). Défaut : config."""
        from compliance.services import ComplianceService

        return ComplianceService().effective_rake_rate(match.player_1)

    def _refund_both(self, match: Match) -> None:
        stake = Money(match.bet_amount, match.currency)
        self.wallet.refund_escrow(
            match_id=match.id,
            entries=[(match.player_1, stake), (match.player_2, stake)],
            pocket=pocket_for(match.stake_kind),
        )

    @staticmethod
    def _event(match: Match, event_type: str, data: dict) -> None:
        MatchEvent.objects.create(match=match, type=event_type, data=data)
