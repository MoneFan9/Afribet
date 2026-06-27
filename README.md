# AfriBet

Plateforme Django **unique** de paris P2P (et vs-IA) sur jeux traditionnels africains, avec
portefeuille électronique, escrow automatisé et **framework de jeux enfichable**. **Songo** est
le premier jeu.

> Référence de conception : [`docs/Cahier des chaarges/conception-afribet.md`](docs/Cahier%20des%20chaarges/conception-afribet.md).
> Résumé opérationnel : [`CLAUDE.md`](CLAUDE.md).

## Architecture (3 frontières infranchissables)
1. **Plateforme ↔ Jeu** — la plateforme ne connaît aucune règle ; les jeux sont des plugins
   (`games/`, `GameModule`/`GameAI`/`GameRegistry`). Aucun import Django dans `games/`.
2. **Wallet ↔ Prestataire de paiement** — wallet en monnaie interne ; prestataires enfichables
   (`PaymentProvider`).
3. **Logique métier ↔ Framework web** — toute la logique en **service layer** (Python pur) ;
   Django (vues/consumers/modèles) = couche d'adaptation.

## Apps (= couches + frontières)
`core` · `accounts` · `notifications` · `wallet` · `bonus` · `payments` · `matchmaking` ·
`realtime` · `disputes` · `ranking` · `compliance` · `backoffice` · package pur `games/`.

## Démarrage (développement local)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate            # SQLite par défaut si POSTGRES_DB absent
python manage.py runserver          # ou: daphne config.asgi:application
pytest                              # suite de tests
ruff check .                        # lint
```

## Démarrage (Docker — stack complète)
```bash
cp .env.example .env
docker compose up --build           # web (ASGI), worker Celery, Redis, PostgreSQL
```

## Conventions
- Langue du projet : **français** (docs, commentaires, libellés).
- Rien de « codé en dur » côté règles d'exploitation : taux, durées, plafonds passent par
  `backoffice.PlatformConfig` / `compliance.Jurisdiction`.
- Tout montant monétaire = objet-valeur `core.Money` (jamais de montant nu). Devise par défaut XAF.

## État (itération 1 — en cours)
Boucle de pari sûre de bout en bout : s'inscrire → recharger (sandbox) → créer/rejoindre
(vs humain ou IA) → jouer (équité réseau) → être réglé. Voir le plan d'exécution par phases.
