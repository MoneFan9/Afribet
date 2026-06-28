# Plan Phase 10 — Front mobile-first (HTML + Tailwind + HTMX + TypeScript)

> Référence : conception §6b (front), §Navigation, ENF5 (perf/faible bande passante),
> ENF6 (ergonomie/accessibilité/i18n), ENF7 (cohérence temps réel).
> Contrainte ferme : **aucune lib JS hormis HTMX** ; logique cliente en **TypeScript**
> uniquement ; **composants maison** via tags Django (Cotton écarté).

---

## 0. État actuel (incrément déjà livré et testé — 10 tests)
- App `frontend` (couche dialogue) ; routing racine ; **auth par session web** (register →
  verify → login → logout) réutilisant `AuthService` (frontière 3 respectée).
- Base layout mobile-first (Tailwind via CDN, HTMX via CDN), **design tokens** (terres cuites,
  or, vert profond), CSS d'accessibilité (focus visible, touch-action, haptique).
- **Composants maison** via tags d'inclusion (`balance_pocket`, `stat`, `money`, `form_fields`).
- Écrans : landing, register, verify, login, dashboard, wallet (4 poches + dépôt sandbox +
  conversion), lobby (+ rejoindre par code), création de défi, entraînement.
- **Plateau Songo** en **TypeScript** (`static/src/board.ts` → compilé `static/dist/board.js`)
  connecté au **WebSocket** (JWT émis pour la session), rendu serveur-autoritaire, coups + forfait.
- **Build TS** : `tsconfig.json` + `package.json` (`npm run build:ts`). Artefact versionné.

---

## 1. Pipeline de build front (à industrialiser)
- **TypeScript** : `tsc` strict (déjà en place). Ajouter `npm run watch:ts` en dev ; **build CI**
  (GitHub Actions) régénérant `static/dist/` à chaque push, au lieu de versionner l'artefact.
- **Tailwind** : passer du **CDN** (MVP) à un **build** (`tailwindcss` CLI standalone ou via npm)
  avec purge des classes → CSS minimal en prod (ENF5). `tailwind.config.js` portant les design
  tokens (aujourd'hui inline dans `base.html`).
- **collectstatic** + cache-busting (ManifestStaticFilesStorage) + compression (gzip/brotli).
- Servir les statiques via WhiteNoise (ou CDN) en prod.

## 2. Système de composants maison (à étoffer)
Tags d'inclusion + `{% with %}` (pas de dépendance). Bibliothèque cible :
`button`, `card`, `modal` (HTMX), `toast`, `field` (avec erreurs), `pocket`, `match_card`,
`avatar`, `badge/chip`, `bottom-nav` (navigation mobile fixe), `stepper`, `empty-state`,
`skeleton` (chargement). Documenter chaque composant (storybook léger en page `/ui-kit/` dev-only).

## 3. Écrans restants & parcours (conception §Navigation)
- **KYC** (`/kyc`) : upload pièce + selfie → `KycProvider` (stub) ; gating retrait/conversion.
- **Recherche d'adversaire** (`/challenge/:id/search`) : écran d'attente AUTO + annulation +
  bascule code (polling HTMX ou WS).
- **Code d'invitation** (`/challenge/:id/code`) : code + **partage natif** (Web Share API en TS) +
  copier.
- **Retrait** (`/wallet/withdraw`) : formulaire + KYC + statut (incl. `needs_review`).
- **Historique** (`/history`) : registre `Transaction` paginé (HTMX infinite scroll) — **CU9**.
- **Résultat de match** (`/match/:id` état terminal) : gain/perte, rake, rejouer, **contester**.
- **Litige** (`/match/:id/dispute`) : ouverture (CU13) — dépend de l'app `disputes` (it. 2).
- **Classement** (`/ranking`) : arène mondiale Elo — dépend de `ranking` (it. 3).
- **Profil / jeu responsable** : limites (EF5d/EF16), auto-exclusion, liens d'aide.
- **Admin** : Django admin déjà en place (hub §13) ; éventuel front d'exploitation léger plus tard.

## 4. Plateau Songo — montée en gamme (board.ts)
- Rendu **SVG/Canvas** animé (semis graine par graine, captures, Ouragan) — actuellement DOM
  simple. Reprendre les animations du PoC (`gameAnimation.ts`) en TS pur.
- **Compte à rebours du coup** (30 s) visible, synchronisé sur `move_deadline` ; indicateur
  « coup auto » (timeout) et **bandeau de reconnexion** (fenêtre de grâce 45 s).
- **Resynchro** à la reconnexion (le consumer renvoie l'état au `connect`).
- Sons optionnels (audio.ts du PoC), retours haptiques (`navigator.vibrate`).
- Affichage des **events** (capture/solidarité/pénalité) reçus du serveur.
- Rendu spécifique fourni **par le module de jeu** (frontière 1 côté front : un futur jeu
  apporte son propre `board.ts`).

## 5. Temps réel & robustesse (ENF7)
- WebSocket avec **reconnexion automatique** (backoff), file d'envoi, idempotence des coups.
- Indicateurs d'état (connecté / tour adverse / à vous / déconnecté / terminé).
- Dégradation gracieuse en **mode différé** (correspondance) : pas de WS, polling/refresh.

## 6. Accessibilité, i18n, perf (ENF5/ENF6)
- **i18n** : `gettext` Django (fr par défaut, en/autres) ; `LocaleMiddleware` ; sélecteur de langue.
- A11y : rôles ARIA sur le plateau, navigation clavier, contraste AA, tailles tactiles ≥ 44px,
  usage à une main (actions en bas d'écran via bottom-nav).
- Perf : payloads légers, lazy-loading, CSS purgé, pas de JS hors HTMX + board compilé minifié.
- **PWA** (post-MVP) : manifest + service worker (offline léger, ajout à l'écran d'accueil).

## 7. Sécurité front
- CSRF sur tous les POST (déjà). Le JWT du board est émis **par session** et **court** ; envisager
  un token WS dédié à durée de vie réduite plutôt que l'access token complet.
- Pas de secret côté client ; messages d'erreur génériques pour le non-métier.
- `AllowedHostsOriginValidator` sur le WebSocket (durcissement, cf. audit accounts/realtime).

## 8. Tests
- **Vues** (test client) : statut + contenu clé + flux (déjà : 10 tests). Étendre à tous les écrans.
- **E2E navigateur** : **Playwright** (déjà utilisé dans le PoC) — parcours complet inscription →
  dépôt → défi vs IA → jouer quelques coups (WS) → règlement. Lancé en CI headless.
- **TS** : tests unitaires du board (logique d'affichage/contrôle) via vitest (le moteur reste
  côté serveur ; le front ne fait que rendre).
- Accessibilité automatisée (axe-core via Playwright).

## 9. Découpage en sous-phases
1. **10a (fait)** : fondation + auth web + écrans cœur + plateau WS minimal + tests.
2. **10b** : build Tailwind/TS industrialisé (CI), bottom-nav, KYC, retrait, historique (CU9),
   écran de résultat + recherche d'adversaire + code (partage natif).
3. **10c** : plateau SVG/Canvas animé + compte à rebours + reconnexion + sons/haptique.
4. **10d** : i18n, a11y AA, perf (purge, manifest PWA), E2E Playwright + axe en CI.
5. **10e** (post-MVP) : profil/jeu responsable UI, ranking/dispute (dépend it. 2/3), PWA offline.

## 10. Dépendances inter-phases
- `/history` (CU9) → registre `Transaction` (déjà là).
- `/match/:id/dispute` (CU13) → app `disputes` (itération 2).
- `/ranking` (CU15) → app `ranking` + Elo branché à la résolution (itération 3).
- Messages de prévention + reality-checks (§14) → écrans profil + middleware de session.

---

### Notes d'exécution importantes
- Le front **server-rendered** utilise l'**auth session** ; l'**API DRF (JWT)** reste pour le
  mobile/programmable et le WebSocket. Garder les deux cohérents (mêmes services).
- Le **dépôt sandbox** est auto-confirmé côté front pour la démo ; en prod, c'est le **callback
  prestataire signé** qui crédite (jamais le front).
- Respecter la frontière 1 côté front : le plateau d'un futur jeu apporte son propre rendu.
