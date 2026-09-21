-- ============================================================================
-- Ma Ludothèque – Lot 2 : recherche en ligne, scan, jaquettes
-- À exécuter UNE fois dans Supabase > SQL Editor > New query > Run,
-- AVANT de publier le code du lot 2. Rejouable sans risque. Aucune donnée perso.
-- ============================================================================

-- Vignette légère de la jaquette (listes), la jaquette pleine taille reste dans cover_url
alter table public.games add column if not exists cover_thumb text;

-- Identifiants dans les sources en ligne, sans toucher à source / external_id
-- (qui gardent l'origine de l'import : myludo, gamekult…).
-- Exemple : {"bgg": "432"} ou {"igdb": "1234"} ou {"openlibrary": "9782914440003"}
alter table public.games add column if not exists ext_ids jsonb not null default '{}'::jsonb;

-- Codes-barres : on ne garde que des chiffres (et X final d'un ISBN-10)
update public.games
set barcodes = coalesce(
  (select array_agg(distinct c) from (
     select upper(regexp_replace(b, '[^0-9Xx]', '', 'g')) as c from unnest(barcodes) as b
   ) t where c <> ''),
  '{}')
where exists (select 1 from unnest(barcodes) b where b ~ '[^0-9Xx]');

-- Vérification : doit afficher les deux nouvelles colonnes
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'games' and column_name in ('cover_thumb', 'ext_ids');
