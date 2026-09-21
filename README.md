# Ma Ludothèque

Application web (PWA) pour gérer ma collection de jeux de société, jeux vidéo et jeux de rôle.
Utilisable sur téléphone et sur PC, installable sur l'écran d'accueil.

## Architecture

- **Front** : React + TypeScript + Vite, publié sur GitHub Pages à chaque modification de `main`.
- **Données et connexion** : Supabase (base Postgres, région Paris), protégées par ma connexion.
- **Recherche en ligne** : fonction serveur Supabase `recherche` (dossier `supabase/functions/recherche`),
  seule à connaître les jetons BGG et IGDB, et réservée au compte connecté.
- **Aucune donnée ni clé secrète dans ce dépôt.** Seules l'URL Supabase et la clé *publishable*
  sont fournies à la publication, via les variables GitHub Actions.

## Variables de publication

Dans *Settings → Secrets and variables → Actions → Variables* :

| Nom | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`) |

## Développement local (facultatif)

```bash
npm install
npm run dev
```

## Base de données

Les scripts SQL du dossier `supabase/` créent les tables (sans aucune donnée) :

| Fichier | Contenu |
| --- | --- |
| `001_lot1_collection.sql` | Tables `games` (fiche jeu) et `copies` (exemplaire), Row Level Security, bucket privé `photos` |
| `002_lot2_recherche.sql` | Colonnes `cover_thumb` (vignette) et `ext_ids` (identifiants BGG / IGDB / Open Library), codes-barres nettoyés |

## Fonction serveur « recherche » (lot 2)

Fichier unique `supabase/functions/recherche/index.ts`, sans dépendance, à coller dans
Supabase → *Edge Functions* → *Deploy a new function* → *Via Editor* (nom : `recherche`).
Réglage de la fonction : *Verify JWT with legacy secret* **désactivé** (la fonction vérifie elle-même la connexion).

Secrets (Supabase → *Edge Functions* → *Secrets*), jamais dans ce dépôt :

| Secret | Source | Obligatoire |
| --- | --- | --- |
| `BGG_TOKEN` | Jeton d'application BoardGameGeek (boardgamegeek.com/applications) | pour les JdS et JdR |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Application Twitch (dev.twitch.tv/console), donne accès à IGDB | pour les JV |
| `UPCITEMDB_KEY` | Clé payante UPCitemdb | non (palier gratuit : 100 codes / jour) |
| `GAMEUPC_KEY` | Clé GameUPC de production | non (clé de test publique par défaut) |
| `ALLOWED_ORIGINS` | Origines autorisées, séparées par des virgules | non (GitHub Pages + localhost) |

Sans jeton, la source correspondante est simplement ignorée ; Open Library, GameUPC et UPCitemdb fonctionnent sans clé.

À exécuter dans Supabase → *SQL Editor*. Les scripts d'import de la collection contiennent des
données personnelles : ils ne doivent **jamais** être déposés dans ce dépôt.

## Fonctions (lot 1)

- Collection et wishlist : grille, liste, tableau ; onglets Société / Vidéo / Rôle.
- Tri principal + secondaire (15 critères), regroupement (initiale, plateforme, constructeur, année, gamme…).
- Filtres cumulables (statut, statut de jeu, joueurs, durée, âge, notes, plateforme, format, région,
  complétude, état, dates, genre, langue, éditeur, emplacement, tags) et favoris de filtres.
- Fiche jeu, exemplaires multiples, photo de l'exemplaire (compressée, stockée dans le bucket privé).
- Ajout et modification manuels, export CSV / JSON, thème clair / sombre.

## Fonctions (lot 2)

- Recherche mixte : ma collection instantanément, puis BoardGameGeek, RPGGeek, IGDB et Open Library.
  Titre, code-barre ou ISBN dans le même champ.
- Scan du code-barre à la caméra (détecteur natif du navigateur, sinon ZXing), saisie du code en secours.
  Code déjà connu → le jeu s'affiche ; sinon GameUPC (JdS), Open Library (ISBN), UPCitemdb + IGDB (JV).
- Mémorisation des codes : à l'ajout, ou en associant un code scanné à un jeu déjà dans la collection.
- Formulaire pré-rempli depuis la source choisie (jaquette, éditeurs, auteurs, joueurs, durée, note…).
- « Compléter » une fiche existante champ par champ, et jaquettes automatiques par lot avec validation.
- Jaquettes gardées en cache sur l'appareil (PWA).
