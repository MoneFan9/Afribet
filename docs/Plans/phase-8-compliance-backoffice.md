# Plan Phase 8 (v2) — `compliance` + `backoffice` (hub d'exploitation)

> Plan validé après auto-audit de conformité (§13, §14, EF16/EF17, diagramme de classes,
> opérations système) et confrontation aux normes de jeu responsable.
> Décisions actées : (1) limites RG **par joueur** incluses, marquées `[AJUSTÉ]` ;
> (2) lien joueur↔juridiction **côté compliance** (pas de cycle de FK).

## Objectif global
Doter l'exploitant du **centre de pilotage** (admin Django étendu) et brancher la **couche
de conformité paramétrable** (auto-exclusion, limites jeu responsable, juridictions) **dans la
boucle existante** (dépôt + engagement de pari), sans rien réécrire — « automatisation d'abord,
humain en dernier recours » (§13). **Permissif par défaut** : sans configuration, la conformité
est neutre (les 132 tests existants restent verts).

## A. App `compliance`

### A.1 Modèles (`compliance/models.py`)
- **`Jurisdiction`** : `country_code` (PK), `currency`, `legal_age` (18), `kyc_level`
  (NONE|BASIC|FULL), `max_rake` (Decimal), `gambling_allowed`, `vs_ai_allowed`,
  `allowed_payment_methods` (JSON), `limits` (JSON défauts pays), `reporting` (JSON),
  `mentions`, `active`.
- **`ComplianceProfile`** (OneToOne `user`) : `jurisdiction` (FK nullable — côté compliance,
  pas de cycle), `data_consent_at` (RGPD ossature).
- **`SelfExclusion`** : `user` FK, `type` (TEMPORARY|PERMANENT), `until`, `reason`, `created_at`.
- **`ResponsibleGamblingLimit`** `[AJUSTÉ]` (EF16) : `user` FK, `kind`
  (DEPOSIT|BET|LOSS|SESSION_TIME), `period` (DAILY|WEEKLY|MONTHLY), `value`, `effective_at`,
  `created_at`.
- Enums : `KycLevel`, `ExclusionType`, `LimitKind`, `LimitPeriod`.

### A.2 `ComplianceService` (`compliance/services.py`)
- `is_allowed(user, action)` : auto-exclusion active → âge → `gambling_allowed` →
  `vs_ai_allowed` → `kyc_level`.
- `enforce_limits(user, action, amount)` `[AJUSTÉ]` : cumul sur fenêtre glissante (config)
  depuis le registre ; min(limite joueur, défaut juridiction).
- `self_exclude(user, type, until=None)` · `set_limit(user, kind, value, period)` `[AJUSTÉ]`
  (baisse immédiate / hausse à `now + cooldown`) · `report(jurisdiction, period)` (ossature).
- `effective_rake_rate(user)` = `min(config.rake_rate, jurisdiction.max_rake)`.
- Erreurs : `SelfExcluded`, `LimitExceeded`, `JurisdictionForbidden`, `AgeRestricted`,
  `KycLevelRequired`.

### A.3 Câblage (imports paresseux, permissif par défaut)
- `PaymentService.deposit/withdraw` → `is_allowed` + `enforce_limits` ; retrait au-dessus de
  `withdrawal_review_threshold` → `PaymentIntent.needs_review=True`.
- `MatchmakingService.create_challenge/join_*` → `is_allowed` + `enforce_limits(bet)`.
- `MatchResolutionService` → rake plafonné via `effective_rake_rate`.

## B. App `backoffice` (hub §13)
- Admin : `Transaction` **immuable** (add/change/delete interdits) ; Wallet/User/KYC/Match/Move/
  MatchEvent/PaymentIntent (lecture+filtres) ; Jurisdiction/SelfExclusion/RGLimit/PlatformConfig
  (éditables).
- `GameSetting(game_key, enabled)` consulté par `create_challenge` ; `ProviderSetting(provider_key,
  enabled)` ossature (sandbox actif).
- Actions admin : valider un retrait `needs_review` (CU10 partiel), void+rembourser un match,
  auto-exclure, seed config.
- Tableau de bord : exposition Maison, dépôts/retraits réglés, réconciliation
  (`ReconciliationService`).
- `AdminPlugin` + registry : point d'extension automates (collusion/AML/triage) — ossature
  non-bloquante.

## C. Config ajoutée (`core/config.DEFAULTS`)
`rg_limit_increase_cooldown_hours` (24), `rg_limit_window` (rolling), `default_jurisdiction`
(null), `withdrawal_review_threshold`, défauts limites (null).

## D. Migrations
`compliance/0001` + `backoffice` (GameSetting/ProviderSetting) + `payments` (`needs_review`).
Aucun cycle de FK.

## E. Tests
Juridiction (gambling/vs_ai/âge/kyc) · auto-exclusion bloque dépôt+pari · limites joueur ET
juridiction (dépôt/mise/perte ; baisse immédiate/hausse différée) · rake plafonné par max_rake ·
jeu désactivé refuse la création · retrait sensible `needs_review` · **permissif par défaut
prouvé** (132 tests restent verts) · admin `Transaction` immuable · `report()`.

## F. Traçabilité
EF16 (RG, `[AJUSTÉ]` limites joueur) · EF17 (juridiction + moyens autorisés) · §13 (hub) ·
§14 (conformité paramétrable, RGPD ossature, rake borné) · CU10 partiel.

## Explicitement reporté
CU12/CU13 disputes → it. 2 · CU15 ranking → it. 3 · automates AML/collusion réels → post-MVP ·
messages de prévention + liens d'aide → Phase 10 · reality-checks → Phase 10 ·
CU16/CU17 bonus → Phase 9.
