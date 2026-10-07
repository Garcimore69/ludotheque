# Keep-alive Supabase

Le plan gratuit Supabase met un projet en pause après 7 jours sans activité en base.
Le workflow `.github/workflows/keepalive.yml` écrit dans la base un jour sur deux pour l'éviter.

## Mise en place (une fois)
1. Supabase > SQL Editor > New query : coller `supabase/003_keepalive.sql` > Run.
2. GitHub : Add file > Upload files à la racine du dépôt (dossiers `.github` et `supabase` du zip).
3. GitHub > Actions > « Keep-alive Supabase » > Run workflow : le run doit passer au vert.

## Fonctionnement
- Utilise les variables Actions déjà en place (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), aucun nouveau secret.
- La clé publique ne peut qu'appeler `keepalive_ping()` : aucune lecture de la table ni de ta collection.
- Échec (base en pause ou injoignable) : GitHub envoie un e-mail. Relancer alors le projet depuis le tableau de bord Supabase (Restore project).
- Chaque run réactive le workflow pour contrer la désactivation GitHub après 60 jours sans commit.
- Vérification : Supabase > Table Editor > `keepalive` (date du dernier ping et compteur).
