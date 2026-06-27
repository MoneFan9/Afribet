"""
Tests de l'IA Songo : déterminisme (audit/équité §7.4), niveaux, mode argent,
partie IA vs IA complète, intégration via `GameService`/registre. Python pur.
"""
from __future__ import annotations

import games.songo  # noqa: F401  (effet de bord : enregistre le jeu dans le registre)
from games.base.registry import registry
from games.base.service import GameService
from games.songo.ai import AdaptiveSongoNN, AlphaBeta, AlphaSongoAI
from games.songo.ai.policy import ALPHASONGO, ENFANT, GRAND_MAITRE, INITIE, VIEUX_SAGE
from games.songo.engine.module import SongoModule


# --- Registre / façade ----------------------------------------------------
def test_registre_contient_songo():
    assert "songo" in registry.available()


def test_gameservice_roundtrip():
    svc = GameService()
    state = svc.init_state("songo")
    assert state["plateau"] == [5] * 14
    assert svc.is_terminal("songo", state) is False
    assert svc.current_player("songo", state) == 0
    legal = svc.legal_moves("songo", state, 0)
    out = svc.apply_move("songo", state, 0, legal[0])
    assert "state" in out and "events" in out
    assert out["state"]["current_player"] == 1


def test_gameservice_ai_move_legal():
    svc = GameService()
    state = svc.init_state("songo")
    move = svc.ai_move("songo", state, 0, VIEUX_SAGE)
    assert move in svc.legal_moves("songo", state, 0)


# --- Déterminisme ---------------------------------------------------------
def test_alphabeta_deterministe():
    m = SongoModule()
    s = m.init_state()
    ab = AlphaBeta()
    mv1 = ab.best_move(list(s["plateau"]), list(s["greniers"]), 0, 4)
    ab2 = AlphaBeta()
    mv2 = ab2.best_move(list(s["plateau"]), list(s["greniers"]), 0, 4)
    assert mv1 == mv2
    assert mv1 in m.legal_moves(s, 0)


def test_mcts_deterministe_avec_seed():
    ai = AlphaSongoAI()
    s = SongoModule().init_state()
    mv1 = ai.choose_move(s, 0, ALPHASONGO, seed=42, iterations=60)
    mv2 = ai.choose_move(s, 0, ALPHASONGO, seed=42, iterations=60)
    assert mv1 == mv2


def test_enfant_deterministe_avec_seed():
    ai = AlphaSongoAI()
    s = SongoModule().init_state()
    assert ai.choose_move(s, 0, ENFANT, seed=7) == ai.choose_move(s, 0, ENFANT, seed=7)


def test_tous_niveaux_renvoient_coup_legal():
    ai = AlphaSongoAI()
    m = SongoModule()
    s = m.init_state()
    legal = m.legal_moves(s, 0)
    for level in (ENFANT, INITIE, VIEUX_SAGE, GRAND_MAITRE, ALPHASONGO):
        mv = ai.choose_move(s, 0, level, seed=1, iterations=40)
        assert mv in legal, level


# --- Équité argent (§7.4) -------------------------------------------------
def test_money_mode_reproductible():
    ai = AlphaSongoAI()
    s = SongoModule().init_state()
    mv1 = ai.choose_move(s, 0, ALPHASONGO, money_mode=True, seed=99, iterations=60)
    mv2 = ai.choose_move(s, 0, ALPHASONGO, money_mode=True, seed=99, iterations=60)
    assert mv1 == mv2  # rejouable à l'identique (auditable)


def test_money_mode_ignore_un_profil_fourni():
    # Preuve d'audit §7.4 : même si un profil exploitable est fourni, money_mode
    # l'ignore totalement → coup identique à « sans profil ».
    ai = AlphaSongoAI()
    s = SongoModule().init_state()
    profile = {"favored_holes": [9] * 7, "vulnerability_rate": 0.95, "total_moves": 80}
    avec = ai.choose_move(s, 0, ALPHASONGO, money_mode=True, seed=5, iterations=80, profile=profile)
    sans = ai.choose_move(s, 0, ALPHASONGO, money_mode=True, seed=5, iterations=80)
    assert avec == sans


def test_nn_money_mode_ignore_le_profil():
    # En mode argent, learn() est neutre et l'évaluation n'exploite pas le profil.
    plateau = [5] * 14
    greniers = [0, 0]
    nn = AdaptiveSongoNN(adaptive=False)
    base = nn.evaluate(plateau, greniers, 0)
    for _ in range(20):
        nn.learn(0, plateau, 1)  # tentative d'apprentissage : doit être sans effet
    assert nn.player_profile["vulnerability_rate"] == 0.0
    assert nn.evaluate(plateau, greniers, 0) == base


def test_observe_opponent_move_via_service():
    # L'apprentissage du profil adverse est exposé en dict OPAQUE par la façade
    # (frontière 1 : la plateforme persiste sans comprendre).
    svc = GameService()
    state = svc.init_state("songo")
    profile = svc.observe_opponent_move("songo", state, 0, 0, None)
    assert profile["total_moves"] == 1
    profile2 = svc.observe_opponent_move("songo", state, 0, 0, profile)
    assert profile2["total_moves"] == 2


def test_choose_move_accepte_un_profil():
    ai = AlphaSongoAI()
    s = SongoModule().init_state()
    profile = {"favored_holes": [0] * 7, "vulnerability_rate": 0.5, "total_moves": 3}
    mv = ai.choose_move(s, 0, ALPHASONGO, seed=3, iterations=40, profile=profile)
    assert mv in SongoModule().legal_moves(s, 0)


def test_nn_entrainement_apprend():
    nn = AdaptiveSongoNN(adaptive=True)
    plateau = [0] * 14
    plateau[0] = 1  # vulnérabilité côté joueur 0
    nn.learn(0, plateau, 0)
    assert nn.player_profile["total_moves"] == 1
    assert nn.player_profile["vulnerability_rate"] > 0.0


# --- Partie complète IA vs IA --------------------------------------------
def test_partie_ia_vs_ia_se_termine():
    m = SongoModule()
    ai = AlphaSongoAI()
    s = m.init_state()
    plies = 0
    while not m.is_terminal(s) and plies < 1000:
        player = m.current_player(s)
        legal = m.legal_moves(s, player)
        if not legal:
            break  # joueur bloqué : la partie s'arrête
        move = ai.choose_move(s, player, VIEUX_SAGE, seed=plies)
        s = m.apply_move(s, player, move).state
        plies += 1
    assert m.is_terminal(s) or not m.legal_moves(s, m.current_player(s))
    assert plies < 1000  # la partie converge
