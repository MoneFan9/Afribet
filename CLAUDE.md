# CLAUDE.md — AfriBet

> Mémo de cadrage pour toute session de travail sur ce dépôt.
> **La référence complète est [`docs/CONCEPTION.md`](docs/CONCEPTION.md)** (document de
> conception v1.0). Ce fichier n'en est qu'un résumé opérationnel : en cas de doute, la
> conception fait foi.

## En une phrase
**AfriBet** : une **plateforme Django unique** de paris P2P (et vs-IA) sur des jeux
traditionnels africains, avec portefeuille électronique, escrow automatisé et un **framework
de jeux enfichable**. **Songo** est le premier jeu ; d'autres suivront.

## Les 3 frontières infranchissables (architecture directrice)
1. **Plateforme ↔ Jeu** — la plateforme ne connaît **aucune** règle de jeu. Un match a un
   `game_key`, un état **opaque** (JSON), une mise, un gagnant. Les jeux sont des plugins
   (`GameModule` / `GameAI`, via `GameRegistry`).
2. **Wallet ↔ Prestataire de paiement** — le wallet raisonne en **monnaie interne** ; les
   prestataires (mobile money, carte, crypto) sont des plugins (`PaymentProvider`, via
   `PaymentGatewayRegistry`). Même patron pour `KycProvider` et `NotificationProvider`.
3. **Logique métier ↔ Framework web** — moteur, IA et services métier sont du **Python pur**
   (testables, déterministes). Django (vues, consumers, modèles) n'est qu'une **couche
   d'adaptation**. Toute la logique vit dans une **service layer**, jamais dans les vues.

## Invariants financiers (CRITIQUE — ne jamais violer)
- **Serveur-autoritaire** : tout coup/résultat recalculé côté serveur ; le client n'est jamais cru.
- **Escrow & règlements atomiques** (transaction DB ACID + `select_for_update` sur les wallets) ;
  **pas de double dépense**.
- **Registre immuable** : chaque mouvement = une `Transaction` (avec sa **poche** et
  `balance_after`). C'est la vérité financière.
- **Quatre soldes par wallet** : poche **réelle** (`available` + `locked`) et poche
  **bonus/virtuelle** (`bonus_available` + `bonus_locked`).
- **Un match = une seule poche** (`stake_kind = REAL | BONUS`). Jamais de mélange réel/virtuel.
- **Argent réel centralisé** chez AfriBet ; **aucun crédit avant confirmation réelle** d'un dépôt
  (callback vérifié + `verify`). Ségrégation fonds joueurs / revenus.
- **Bonus** : couplé au **1er dépôt**, % paramétrable, **une seule fois**, en poche **virtuelle** ;
  poche virtuelle **close à vie une fois épuisée**.
- **Conversion virtuel → réel** : par **tranches entières** uniquement —
  `n = ⌊bonus_available / 2 000 000⌋`, chaque tranche `2 000 000 → 10 000` réels (ratio 200:1),
  reste laissé en virtuel ; **atomique**, **sous KYC**. Seuil/taux/plafonds paramétrables.
- **Money** : objet-valeur `(montant: Decimal, devise)`. **Jamais** de montant monétaire « nu ».
  Devise par défaut **XAF**.

## Équité réseau (CRITIQUE — protection juridique)
Personne ne perd d'argent à cause d'une défaillance qui n'est pas la sienne.
- Timeout de coup (30 s `[DÉFAUT]`, temps réel) → **pire coup légal auto** (`Move.is_auto`),
  jamais de défaite immédiate.
- Déconnexion → fenêtre de grâce (45 s `[DÉFAUT]`) + reconnexion/resynchro.
- **Panne de notre côté** → match **void + remboursement** des deux.
- **Coupure côté joueur** non récupérée → `DisconnectPolicy` (`AUTO_RESOLVE` par défaut, ou
  `VOID_REFUND`), avec anti-abus.
- Abandon volontaire → forfait. **Tout est journalisé** (`MatchEvent`) et **paramétrable**.

## Stack (décidée)
- **Back** : Django + DRF · **Temps réel** : Django Channels + Redis · **DB** : PostgreSQL
  (ACID) · **Async** : Celery + Redis (timers, callbacks, payouts).
- **Moteur & IA jeu** : Python pur (NumPy ok), déterministe, **0 dépendance Django**, testé.
- **Front** : **HTML (templates Django) + Tailwind CSS + HTMX + TypeScript**. Plateau de jeu en
  TypeScript sur Canvas/SVG via WebSocket.
  - **Contrainte ferme** : **aucune lib JS hormis HTMX** (pas d'Alpine, pas de SPA, pas de
    vanilla JS — TypeScript uniquement). **Composants maison** via tags Django natifs (pas de
    dépendance ; Django Cotton écarté).
- **Déploiement** : Docker + docker-compose (web, Channels, Celery, Redis, PostgreSQL).
- **Pas de dépendance LLM externe** (Gemini/coaching tiers retirés du périmètre).

## Découpage en apps Django (= couches + frontières)
`core` (Money, base, utils) · `accounts` (User tél. unique + e-mail, JWT, MFA e-mail, KYC) ·
`notifications` (Email actif / SMS inactif) · `wallet` (4 soldes, Transaction, escrow) ·
`bonus` (BonusGrant, VirtualUsagePolicy, conversion) · `payments` (PaymentIntent, providers/,
réconciliation) · `matchmaking` (Match, Move, MatchEvent, lobby — **sans règle de jeu**) ·
`games/` (framework + `games/songo/{engine,ai,board}`) · `realtime` (Channels, présence, timers) ·
`disputes` · `ranking` (Elo, K=32, base 1200) · `compliance` (Jurisdiction, jeu responsable) ·
`backoffice` (PlatformConfig, hub admin, automates).

## MVP / Itération 1 = boucle de pari sûre de bout en bout
S'inscrire → recharger (sandbox) → créer/rejoindre (vs humain ou IA) → jouer (avec gestion
réseau **équitable**) → être réglé. L'équité réseau (CU8) est **P0**, pas une option.

Au MVP : paiement **Sandbox** uniquement · vérif **e-mail** (tél. unique obligatoire) · KYC
différé (stub) · SMS inactif.

## Conventions
- Langue du projet : **français** (docs, commentaires, libellés UI).
- Rien n'est « codé en dur » côté règles d'exploitation : taux, durées, plafonds, conformité
  par pays passent par la **configuration** (`PlatformConfig` / `Jurisdiction`).
- Marqueurs dans la conception : `[DÉFAUT]` = valeur paramétrable · `[AJUSTÉ]` = écart assumé
  vs spec d'origine · `À CLARIFIER` = décision (chiffre/juridique) en attente, non bloquante.
