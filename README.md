# Ma Ludothèque

Application web (PWA) pour gérer ma collection de jeux de société, jeux vidéo et jeux de rôle.
Utilisable sur téléphone et sur PC, installable sur l'écran d'accueil.

## Architecture

- **Front** : React + TypeScript + Vite, publié sur GitHub Pages à chaque modification de `main`.
- **Données et connexion** : Supabase (base Postgres, région Paris), protégées par ma connexion.
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

À exécuter dans Supabase → *SQL Editor*. Les scripts d'import de la collection contiennent des
données personnelles : ils ne doivent **jamais** être déposés dans ce dépôt.

## Fonctions (lot 1)

- Collection et wishlist : grille, liste, tableau ; onglets Société / Vidéo / Rôle.
- Tri principal + secondaire (15 critères), regroupement (initiale, plateforme, constructeur, année, gamme…).
- Filtres cumulables (statut, statut de jeu, joueurs, durée, âge, notes, plateforme, format, région,
  complétude, état, dates, genre, langue, éditeur, emplacement, tags) et favoris de filtres.
- Fiche jeu, exemplaires multiples, photo de l'exemplaire (compressée, stockée dans le bucket privé).
- Ajout et modification manuels, export CSV / JSON, thème clair / sombre.
