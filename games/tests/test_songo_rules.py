"""
Tests du moteur de règles Songo — port de `gameLogic.test.ts` (fidélité au PoC)
+ cas plateforme (SongoModule, worst_move, sérialisation). Python pur, sans Django.
"""
from __future__ import annotations

from games.songo.engine import rules
from games.songo.engine.constants import TOTAL_TROUS
from games.songo.engine.module import SongoModule


def vide() -> list[int]:
    return [0] * TOTAL_TROUS


# --- get_destination_hole -------------------------------------------------
def test_destination_zero():
    assert rules.get_destination_hole(0, 0, 0) is None


def test_destination_normal():
    assert rules.get_destination_hole(0, 5, 0) == 5
    assert rules.get_destination_hole(10, 5, 1) == 1


def test_destination_boucle():
    assert rules.get_destination_hole(0, 15, 0) == 8
    assert rules.get_destination_hole(7, 15, 1) == 1
    assert rules.get_destination_hole(0, 20, 0) == 13


# --- est_famine -----------------------------------------------------------
def test_famine_vrai():
    p = vide(); p[0] = 5
    assert rules.est_famine(p, 0) is True
    p2 = vide(); p2[7] = 5
    assert rules.est_famine(p2, 1) is True


def test_famine_faux():
    p = vide(); p[7] = 1
    assert rules.est_famine(p, 0) is False
    p2 = vide(); p2[0] = 1
    assert rules.est_famine(p2, 1) is False


# --- simuler_nourrissage --------------------------------------------------
def test_nourrissage_normal():
    p = vide(); p[5] = 3
    assert rules.simuler_nourrissage(p, 5, 0) == 2


def test_nourrissage_boucle():
    p = vide(); p[5] = 15
    assert rules.simuler_nourrissage(p, 5, 0) == 9
    p2 = vide(); p2[10] = 15
    assert rules.simuler_nourrissage(p2, 10, 1) == 9


# --- get_coups_legaux -----------------------------------------------------
def test_coups_non_vides():
    p = vide(); p[0] = 5; p[1] = 5; p[7] = 5
    assert rules.get_coups_legaux(p, 0) == [0, 1]


def test_coups_filtre_penalite_case7():
    p = vide(); p[0] = 5; p[6] = 2; p[7] = 5
    assert rules.get_coups_legaux(p, 0) == [0]
    p2 = vide(); p2[7] = 5; p2[13] = 1; p2[0] = 5
    assert rules.get_coups_legaux(p2, 1) == [7]


def test_coups_famine_sans_nourrissage():
    p = vide(); p[0] = 1
    assert rules.get_coups_legaux(p, 0) == []


def test_coups_famine_priorite_7():
    p = vide(); p[0] = 15; p[1] = 5
    assert rules.get_coups_legaux(p, 0) == [0]


def test_coups_famine_max_feed():
    p = vide(); p[5] = 3; p[6] = 1
    assert rules.get_coups_legaux(p, 0) == [5]


# --- appliquer_coup -------------------------------------------------------
def test_penalite_case7_j0():
    p = vide(); p[6] = 2; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 6)
    assert ev["type"] == "penalty_case_7"
    assert g[1] == 2 and p[6] == 0


def test_penalite_case7_j1():
    p = vide(); p[13] = 1; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 1, 13)
    assert ev["type"] == "penalty_case_7"
    assert g[0] == 1 and p[13] == 0


def test_semis_normal():
    p = vide(); p[0] = 3; g = [0, 0]
    rules.appliquer_coup(p, g, 0, 0)
    assert p[0] == 0 and p[1] == 1 and p[2] == 1 and p[3] == 1


def test_semis_boucle_avec_capture():
    p = vide(); p[0] = 15; p[9] = 5; g = [0, 0]
    rules.appliquer_coup(p, g, 0, 0)
    assert p[0] == 0 and p[1] == 1
    assert p[7] == 0 and p[8] == 0
    assert g[0] == 4


def test_capture_simple():
    p = vide(); p[5] = 3; p[8] = 1; p[9] = 5; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 5)
    assert ev["type"] == "capture" and ev["seeds"] == 2
    assert g[0] == 2 and p[8] == 0


def test_capture_cascade():
    p = vide(); p[5] = 3; p[7] = 2; p[8] = 2; p[9] = 1; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 5)
    assert ev["type"] == "capture" and ev["seeds"] == 6
    assert g[0] == 6 and p[7] == 0 and p[8] == 0


def test_solidarite():
    p = vide(); p[5] = 3; p[7] = 1; p[8] = 1; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 5)
    assert ev["type"] == "solidarity"
    assert g[0] == 0 and p[7] == 2 and p[8] == 2


def test_pas_de_capture_case1_adverse_j0():
    p = vide(); p[5] = 2; p[7] = 1; p[8] = 5; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 5)
    assert ev is None and g[0] == 0 and p[7] == 2


def test_pas_de_capture_case1_adverse_j1():
    p = vide(); p[12] = 2; p[0] = 1; p[1] = 5; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 1, 12)
    assert ev is None and g[1] == 0 and p[0] == 2


def test_capture_borne_haute():
    p = vide(); p[5] = 3; p[8] = 2; p[9] = 5; g = [0, 0]
    ev = rules.appliquer_coup(p, g, 0, 5)
    assert ev["type"] == "capture" and ev["seeds"] == 3
    p2 = vide(); p2[5] = 3; p2[8] = 4; g2 = [0, 0]
    assert rules.appliquer_coup(p2, g2, 0, 5) is None


# --- check_fin_partie -----------------------------------------------------
def test_fin_victoire():
    assert rules.check_fin_partie(vide(), [40, 0]) == 0
    assert rules.check_fin_partie(vide(), [0, 40]) == 1


def test_fin_rarete():
    p = vide(); p[0] = 5; p[7] = 3
    assert rules.check_fin_partie(p, [10, 10]) == 0
    p2 = vide(); p2[0] = 3; p2[7] = 5
    assert rules.check_fin_partie(p2, [10, 10]) == 1
    p3 = vide(); p3[0] = 4; p3[7] = 4
    assert rules.check_fin_partie(p3, [10, 10]) == 2


def test_fin_en_cours():
    assert rules.check_fin_partie([5] * TOTAL_TROUS, [0, 0]) == -1


# --- SongoModule (couche plateforme) --------------------------------------
def test_module_init_et_serialisation():
    m = SongoModule()
    s = m.init_state()
    assert s["plateau"] == [5] * 14 and s["greniers"] == [0, 0]
    assert m.current_player(s) == 0
    # Sérialisation opaque round-trip.
    data = m.serialize(s)
    assert m.deserialize(data) == s


def test_module_apply_move_ne_mute_pas_lentree():
    m = SongoModule()
    s = m.init_state()
    avant = m.serialize(s)
    res = m.apply_move(s, 0, 0)
    assert s == avant  # état d'origine intact
    assert res.state["current_player"] == 1


def test_module_coup_illegal_leve():
    m = SongoModule()
    s = m.init_state()
    import pytest

    with pytest.raises(ValueError):
        m.apply_move(s, 0, 7)  # trou adverse


def test_module_worst_move_est_legal_et_deterministe():
    m = SongoModule()
    s = m.init_state()
    wm = m.worst_move(s, 0)
    assert wm in m.legal_moves(s, 0)
    assert m.worst_move(s, 0) == wm  # déterministe


def test_module_terminal_et_winner():
    m = SongoModule()
    s = {"plateau": [0] * 14, "greniers": [40, 0], "current_player": 0}
    assert m.is_terminal(s) is True
    assert m.winner(s) == 0
    nul = {"plateau": [0] * 14, "greniers": [0, 0], "current_player": 0}
    # plateau vide => rareté, 0 vs 0 => nul => winner None
    assert m.winner(nul) is None
