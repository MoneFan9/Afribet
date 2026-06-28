# Plan Phase 9 — bonus (CU16/CU17)

> Plan validé (avec auto-audit de conformité §16 / EF5b-5c-5d).
> Décision actée : **VirtualUsagePolicy = modèle dédié** (fidèle au diagramme de classes),
> valeurs initiales depuis la config, usage compté depuis `Match`.

## Objectif
Bonus de bienvenue **couplé au 1er dépôt** (poche virtuelle non retirable), **jeu en mode
bonus** (`stake_kind=BONUS`, escrow déjà supporté), **bridage** de l'usage virtuel, et
**conversion virtuel→réel par tranches 200:1 sous KYC**. Exposition bornée. Sûr par défaut.

## Périmètre : CU16, CU17 · EF5b, EF5c, EF5d

## A. App `bonus`
### A.1 Modèles
- **`BonusGrant`** : id, user FK, type (`BonusType=WELCOME|…`), amount, granted_at, expires_at
  (nullable). `WELCOME` **unique par utilisateur** (contrainte).
- **`VirtualUsagePolicy`** (modèle dédié, décision actée) : `max_matches_per_day`, `allowed_hours`
  (ex. "08:00-23:00"), `cooldown_seconds`, `active`. Une ligne active ; défauts depuis la config ;
  admin-éditable. Usage **compté depuis `Match`** (défis BONUS du jour, dernier défi pour cooldown).
- Wallet déjà prêt : `bonus_available`, `bonus_locked`, `bonus_pocket_closed` ; `TxType.BONUS_GRANT`
  /`BONUS_CONVERSION` et `StakeKind.BONUS` existent déjà.

### A.2 `BonusService`
- `maybe_grant_welcome(user, intent)` — idempotent (un seul octroi : aucun BonusGrant antérieur ET
  poche non close), crédite la poche bonus de `welcome_bonus_pct × montant du 1er dépôt`, écrit
  `BonusGrant(WELCOME)` + `Transaction(BONUS_GRANT, pocket=BONUS)`.
- `check_virtual_usage(user)` — applique `VirtualUsagePolicy` (matchs/jour, fenêtre horaire,
  cooldown) ; usage dérivé de `Match`.
- `convert_bonus_to_real(user)` — sous KYC + `compliance.is_allowed(user,"convert")` ;
  `n=⌊bonus_available/seuil⌋` ; vérifie le **plafond global** sous verrou ; délègue à
  `WalletService.convert_bonus` (atomique) ; reste laissé en virtuel ; ferme la poche si elle
  retombe à 0.
- Erreurs : BonusAlreadyGranted, BonusPocketClosed, ConversionBelowThreshold, GlobalCapReached,
  VirtualUsageExceeded (+ KycRequired réutilisé).

## B. Wallet — `convert_bonus(user, bonus_amount, real_amount)`
Atomique (`select_for_update`) : `bonus_available −= bonus_amount` (garde ≥ 0),
`real_available += real_amount` ; deux `Transaction(BONUS_CONVERSION)` (débit BONUS / crédit REAL)
avec balance_after. Invariant par poche conservé.

## C. Câblage
- Paiements : implémenter le hook `_maybe_grant_welcome_bonus` → `BonusService().maybe_grant_welcome`
  (déjà appelé dans `_settle` IN) ; resserrer le try/except (logguer, ne pas casser le dépôt).
- Matchmaking : `create_challenge`/`_check_joinable`, si `stake_kind==BONUS` →
  `BonusService().check_virtual_usage(user)` avant le verrou.
- Conversion : endpoint `POST /api/wallet/convert/` (route front `/wallet/convert`).
- Soldes : `GET /api/wallet/` (4 poches) — complétude EF5.

## D. Config ajoutée
À ajouter : `virtual_max_matches_per_day`, `virtual_cooldown_seconds`, `virtual_allowed_hours`,
`bonus_expiry_days` (0 = pas d'expiration). Déjà présents : welcome_bonus_pct, seuil/ratio
conversion, plafond global.

## E. Tests
Octroi 1er dépôt (% correct, une seule fois) · jeu BONUS (escrow bonus, pas de rake) · bridage
(matchs/jour, cooldown, hors fenêtre) · conversion 7 000 000 → 30 000 réel + 1 000 000 restant,
atomique · sous seuil → refus · KYC requis · plafond global → refus · clôture de poche à 0.

## F. Migrations
`bonus/0001` (BonusGrant, VirtualUsagePolicy). Aucun cycle de FK.

## Auto-audit — [AJUSTÉ] / reporté
- Usage virtuel dérivé de `Match` (pas de table d'usage) — simplification assumée.
- Elo des matchs bonus « ne comptent pas » → N/A (ranking = it. 3).
- Anti-collusion sur conversion → reporté (§12) ; matière d'audit présente.
- Provision de dette réelle (10 000/tranche) → suivie via registre + plafond global ; pas de compte
  de provision séparé au MVP.
- Risques : conversion atomique + plafond vérifié SOUS VERROU (anti-TOCTOU exposition) ; clôture de
  poche enforced après conversion et après règlement d'un match bonus vidant la poche ; hook bonus
  isolé (ne casse pas le dépôt).
