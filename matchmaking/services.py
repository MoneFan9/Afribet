"""
`MatchmakingService` (couche contrôle, CU3/CU3b/CU4/CU4b) — **générique**, sans
aucune dépendance au jeu (frontière 1). Orchestration des défis, de l'appariement
et de l'escrow d'engagement (via `WalletService`).
"""
from __future__ import annotations

import secrets
from collections import defaultdict
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core import config
from core.errors import DomainError
from core.money import Money
from games.base.registry import registry as game_registry
from games.base.service import GameService
from wallet.models import Pocket
from wallet.services import WalletService

from .models import (
    Match,
    MatchStatus,
    OpponentType,
    PairingMode,
    StakeKind,
    TimingMode,
)

User = get_user_model()
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sans I/O/0/1 (lisibilité)


# --- Erreurs CU3-CU4 ------------------------------------------------------
class MatchmakingError(DomainError):
    pass


class GameNotRegistered(MatchmakingError):
    pass


class BetOutOfBounds(MatchmakingError):
    pass


class MatchNotJoinable(MatchmakingError):
    pass


class CannotJoinOwnChallenge(MatchmakingError):
    pass


class InvalidAccessCode(MatchmakingError):
    pass


def pocket_for(stake_kind: str) -> str:
    return Pocket.REAL if stake_kind == StakeKind.REAL else Pocket.BONUS


def get_house():
    house = User.objects.filter(is_system=True, username="house").first()
    if house is None:
        raise MatchmakingError("Compte Maison absent (exécuter `manage.py create_house`).")
    return house


class MatchmakingService:
    def __init__(self, wallet_service: WalletService | None = None, game_service: GameService | None = None):
        self.wallet = wallet_service or WalletService()
        self.games = game_service or GameService()

    # --- Validation / utilitaires ----------------------------------------
    def _validate(self, game_key: str, bet: Money) -> None:
        if not game_registry.has(game_key):
            raise GameNotRegistered(f"Jeu non enregistré : {game_key!r}")
        # Jeu désactivé depuis le hub admin (§13) — permissif si non configuré.
        from backoffice.models import GameSetting

        if not GameSetting.is_enabled(game_key):
            raise GameNotRegistered(f"Jeu désactivé : {game_key!r}")
        bet_min = config.get_int("bet_min")
        bet_max = config.get_int("bet_max")
        if not (bet_min <= bet.amount <= bet_max):
            raise BetOutOfBounds(f"Mise hors bornes [{bet_min}, {bet_max}].")

    def _new_code(self) -> str:
        while True:
            code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
            if not Match.objects.filter(access_code=code).exists():
                return code

    def _arm_deadline(self, match: Match) -> None:
        if match.timing_mode == TimingMode.REALTIME:
            secs = config.get_int("move_timer_seconds")
            match.move_deadline = timezone.now() + timedelta(seconds=secs)
        else:
            hours = config.get_int("correspondence_move_hours")
            match.move_deadline = timezone.now() + timedelta(hours=hours)

    def _start(self, match: Match, second_player) -> None:
        """Démarre un match (état initial opaque, ACTIVE, timer armé + planifié)."""
        match.player_2 = second_player
        match.game_state = self.games.init_state(match.game_key)
        match.current_player = self.games.current_player(match.game_key, match.game_state)
        match.status = MatchStatus.ACTIVE
        self._arm_deadline(match)
        match.save()
        # Planifie le timeout du **1er coup** (sinon aucun timeout serveur au tour
        # initial — équité CU8). Après commit ; la tâche s'auto-annule si un coup
        # repousse l'échéance. Helper partagé avec le lifecycle (import paresseux :
        # évite le cycle de modules).
        if match.timing_mode == TimingMode.REALTIME:
            from .lifecycle import _schedule_move_timeout

            mid = str(match.id)
            transaction.on_commit(lambda mid=mid: _schedule_move_timeout(mid))

    # --- CU3 : créer un défi ---------------------------------------------
    @transaction.atomic
    def create_challenge(
        self,
        *,
        creator,
        game_key: str,
        opponent_type: str,
        timing_mode: str,
        pairing_mode: str,
        stake_kind: str,
        bet_amount: Money,
        ai_level: str = "",
    ) -> Match:
        self._validate(game_key, bet_amount)
        # Conformité (permissif par défaut) : auto-exclusion, juridiction, limites.
        from compliance.services import ComplianceService

        compliance = ComplianceService()
        action = "bet_vs_ai" if opponent_type == OpponentType.AI else "bet"
        compliance.is_allowed(creator, action)
        compliance.enforce_limits(creator, "bet", bet_amount)
        pocket = pocket_for(stake_kind)

        match = Match.objects.create(
            game_key=game_key,
            opponent_type=opponent_type,
            timing_mode=timing_mode,
            pairing_mode=pairing_mode if opponent_type == OpponentType.HUMAN else PairingMode.AUTO,
            stake_kind=stake_kind,
            bet_amount=bet_amount.amount,
            currency=bet_amount.currency,
            player_1=creator,
            ai_level=ai_level or config.get_str("default_ai_level"),
        )
        # Verrou de la mise du créateur (escrow d'engagement).
        self.wallet.lock_funds(creator, bet_amount, pocket, match_id=match.id)

        if opponent_type == OpponentType.AI:
            # La Maison est contrepartie : elle verrouille une mise équivalente (§7.3).
            house = get_house()
            self.wallet.lock_funds(house, bet_amount, pocket, match_id=match.id)
            self._start(match, house)
        elif pairing_mode == PairingMode.INVITE_CODE:
            match.access_code = self._new_code()
            ttl = config.get_int("access_code_ttl_minutes")
            match.access_code_expires_at = timezone.now() + timedelta(minutes=ttl)
            match.save(update_fields=["access_code", "access_code_expires_at"])
        # AUTO humain : reste PENDING, listé au lobby + file d'appariement.
        return match

    # --- CU11 / EF12 : entraînement vs IA (sans enjeu) -------------------
    @transaction.atomic
    def create_training_match(
        self, *, creator, game_key: str = "songo", ai_level: str = "",
        timing_mode: str = TimingMode.REALTIME,
    ) -> Match:
        """Match d'entraînement vs IA **sans mise** : aucun escrow, IA adaptative.

        Accessible sans solde ni KYC (cf. CU1 « accès limité → jouer en virtuel oui »).
        """
        if not game_registry.has(game_key):
            raise GameNotRegistered(f"Jeu non enregistré : {game_key!r}")
        house = get_house()  # identité système jouant l'IA (aucun mouvement financier)
        match = Match.objects.create(
            game_key=game_key,
            opponent_type=OpponentType.AI,
            timing_mode=timing_mode,
            pairing_mode=PairingMode.AUTO,
            stake_kind=StakeKind.REAL,  # ignoré (is_training) — pas d'escrow
            is_training=True,
            bet_amount=0,
            player_1=creator,
            ai_level=ai_level or config.get_str("default_ai_level"),
        )
        self._start(match, house)  # ACTIVE + état initial + timer (équité conservée)
        return match

    # --- CU4 : rejoindre depuis le lobby ---------------------------------
    @transaction.atomic
    def join_from_lobby(self, *, joiner, match_id) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        self._check_joinable(match, joiner, PairingMode.AUTO)
        bet = Money(match.bet_amount, match.currency)
        self.wallet.lock_funds(joiner, bet, pocket_for(match.stake_kind), match_id=match.id)
        self._start(match, joiner)
        return match

    # --- CU4b : rejoindre par code ---------------------------------------
    @transaction.atomic
    def join_by_code(self, *, joiner, access_code: str) -> Match:
        match = (
            Match.objects.select_for_update()
            .filter(access_code=access_code, pairing_mode=PairingMode.INVITE_CODE)
            .first()
        )
        if match is None:
            raise InvalidAccessCode("Code inconnu.")
        if match.access_code_expires_at and timezone.now() >= match.access_code_expires_at:
            raise InvalidAccessCode("Code expiré.")
        self._check_joinable(match, joiner, PairingMode.INVITE_CODE)
        bet = Money(match.bet_amount, match.currency)
        self.wallet.lock_funds(joiner, bet, pocket_for(match.stake_kind), match_id=match.id)
        match.access_code = None  # usage unique : invalidé
        match.access_code_expires_at = None
        self._start(match, joiner)
        return match

    def _check_joinable(self, match: Match, joiner, expected_pairing: str) -> None:
        if match.status != MatchStatus.PENDING or match.pairing_mode != expected_pairing:
            raise MatchNotJoinable("Défi indisponible.")
        if match.opponent_type != OpponentType.HUMAN:
            raise MatchNotJoinable("Ce défi n'attend pas d'humain.")
        if joiner.id == match.player_1_id:
            raise CannotJoinOwnChallenge("On ne rejoint pas son propre défi.")
        # Conformité du joueur qui rejoint (permissif par défaut).
        from compliance.services import ComplianceService

        compliance = ComplianceService()
        compliance.is_allowed(joiner, "bet")
        compliance.enforce_limits(joiner, "bet", Money(match.bet_amount, match.currency))

    # --- CU3b : appariement automatique (worker) -------------------------
    def auto_pair(self) -> list:
        """Relie les défis PENDING/AUTO compatibles deux à deux. Renvoie les ids actifs."""
        pendings = list(
            Match.objects.filter(
                status=MatchStatus.PENDING,
                pairing_mode=PairingMode.AUTO,
                opponent_type=OpponentType.HUMAN,
            ).order_by("created_at")
        )
        groups: dict[tuple, list[Match]] = defaultdict(list)
        for m in pendings:
            groups[(m.game_key, m.timing_mode, m.stake_kind, str(m.bet_amount))].append(m)

        paired = []
        for ms in groups.values():
            used: set = set()
            for i in range(len(ms)):
                if ms[i].id in used:
                    continue
                for j in range(i + 1, len(ms)):
                    if ms[j].id in used:
                        continue
                    # Ne jamais apparier un joueur contre lui-même (deux défis du
                    # même créateur aux mêmes paramètres).
                    if ms[i].player_1_id == ms[j].player_1_id:
                        continue
                    if self._merge(ms[i].id, ms[j].id):
                        used.add(ms[i].id)
                        used.add(ms[j].id)
                        paired.append(ms[i].id)
                        break
        return paired

    @transaction.atomic
    def _merge(self, a_id, b_id) -> bool:
        # Verrouillage dans un ordre stable (par id, via order_by) — anti-interblocage
        # si deux workers d'appariement tournent en parallèle.
        locked = {
            m.id: m
            for m in Match.objects.select_for_update().filter(id__in=[a_id, b_id]).order_by("id")
        }
        a = locked[a_id]
        b = locked[b_id]
        if a.status != MatchStatus.PENDING or b.status != MatchStatus.PENDING:
            return False
        if a.player_1_id == b.player_1_id:
            return False  # garde-fou : jamais soi-même
        pocket = pocket_for(a.stake_kind)
        bet = Money(a.bet_amount, a.currency)
        # Le créateur de b rejoint a : on libère sa mise de b puis on la verrouille dans a.
        self.wallet.refund_escrow(match_id=b.id, entries=[(b.player_1, bet)], pocket=pocket)
        b.status = MatchStatus.CANCELLED
        b.save(update_fields=["status"])
        self.wallet.lock_funds(b.player_1, bet, pocket, match_id=a.id)
        self._start(a, b.player_1)
        return True

    # --- Annulation / régénération / lobby -------------------------------
    @transaction.atomic
    def cancel_challenge(self, *, creator, match_id) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        if match.player_1_id != creator.id:
            raise MatchmakingError("Seul le créateur peut annuler.")
        if match.status != MatchStatus.PENDING:
            raise MatchmakingError("Seul un défi en attente est annulable.")
        bet = Money(match.bet_amount, match.currency)
        self.wallet.refund_escrow(match_id=match.id, entries=[(creator, bet)], pocket=pocket_for(match.stake_kind))
        match.status = MatchStatus.CANCELLED
        match.save(update_fields=["status"])
        return match

    @transaction.atomic
    def regenerate_code(self, *, creator, match_id) -> Match:
        match = Match.objects.select_for_update().get(id=match_id)
        if match.player_1_id != creator.id or match.pairing_mode != PairingMode.INVITE_CODE:
            raise MatchmakingError("Régénération impossible.")
        if match.status != MatchStatus.PENDING:
            raise MatchmakingError("Défi déjà engagé.")
        match.access_code = self._new_code()
        ttl = config.get_int("access_code_ttl_minutes")
        match.access_code_expires_at = timezone.now() + timedelta(minutes=ttl)
        match.save(update_fields=["access_code", "access_code_expires_at"])
        return match

    def list_open_challenges(self, *, game_key: str = "", stake_kind: str = "") -> list:
        qs = Match.objects.filter(
            status=MatchStatus.PENDING,
            pairing_mode=PairingMode.AUTO,
            opponent_type=OpponentType.HUMAN,
        )
        if game_key:
            qs = qs.filter(game_key=game_key)
        if stake_kind:
            qs = qs.filter(stake_kind=stake_kind)
        return list(qs)
