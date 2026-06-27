"""
Accès typé à la configuration d'exploitation (conception §13 : « tout est
paramétrable depuis l'interface, pas codé en dur »).

`PlatformConfig` (app `backoffice`) stocke les surcharges éditables par l'admin ;
ce module fournit les **valeurs `[DÉFAUT]`** de repli et des accesseurs typés. Les
chiffres marqués `# TODO confirmer` sont des `À CLARIFIER` de la conception
(rake, bornes de mise, TRJ, conversion) : valeurs proposées, à valider, jamais
codées en dur ailleurs.
"""
from __future__ import annotations

from decimal import Decimal

from django.apps import apps

# --- Valeurs par défaut [DÉFAUT] ------------------------------------------
DEFAULTS: dict[str, object] = {
    # Économie (conception §Vision, §7, À CLARIFIER §1)
    "rake_rate": "0.05",                  # 5 % du pot, parties en argent réel  # TODO confirmer
    "house_rtp": "0.90",                  # taux de retour joueur vs IA          # TODO confirmer
    "bet_min": 100,                       # borne basse de mise (XAF)            # TODO confirmer
    "bet_max": 1_000_000,                 # borne haute de mise (XAF)            # TODO confirmer
    # Temps réel & équité réseau (conception §8, [DÉFAUT])
    "move_timer_seconds": 30,             # délai de coup → pire coup auto
    "grace_seconds": 45,                  # fenêtre de reconnexion
    "correspondence_move_hours": 24,      # délai par coup en mode différé
    "disconnect_policy": "AUTO_RESOLVE",  # AUTO_RESOLVE | VOID_REFUND
    "access_code_ttl_minutes": 15,        # durée de vie d'un code d'invitation
    # Bonus & conversion virtuel → réel (conception §16, [DÉFAUT])
    "welcome_bonus_pct": "1.00",          # % du 1er dépôt crédité en virtuel    # TODO confirmer
    "bonus_conversion_threshold": 2_000_000,   # seuil d'une tranche (virtuel)
    "bonus_conversion_real_per_tranche": 10_000,  # réel crédité par tranche (ratio 200:1)
    "bonus_global_conversion_cap": 50_000_000,  # backstop d'exposition (réel)   # TODO confirmer
    # Classement (conception §15, [DÉFAUT])
    "elo_base": 1200,
    "elo_k": 32,
}


def _override(key: str):
    """Surcharge éditée en base, ou None si absente / table pas encore migrée."""
    try:
        model = apps.get_model("backoffice", "PlatformConfig")
        row = model.objects.filter(key=key).first()
        return row.value if row is not None else None
    except Exception:  # noqa: BLE001 - migrations non appliquées, etc.
        return None


def get(key: str, default=None):
    """Valeur brute : surcharge admin, sinon `[DÉFAUT]`, sinon `default`."""
    ov = _override(key)
    if ov is not None:
        return ov
    return DEFAULTS.get(key, default)


def get_decimal(key: str) -> Decimal:
    return Decimal(str(get(key)))


def get_int(key: str) -> int:
    return int(get(key))


def get_str(key: str) -> str:
    return str(get(key))
