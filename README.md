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
