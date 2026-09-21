-- ============================================================================
-- Ma Ludothèque – Lot 1 : tables de la collection
-- À exécuter UNE fois dans Supabase > SQL Editor > New query > Run.
-- Ce fichier ne contient aucune donnée personnelle : il peut vivre dans le dépôt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fiche jeu (catalogue) : ce que le jeu EST
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  family           text not null check (family in ('jds', 'jv', 'jdr')),
  kind             text not null default 'base' check (kind in ('base', 'extension', 'standalone')),
  title            text not null check (length(trim(title)) > 0),
  subtitle         text,
  original_title   text,
  year             int check (year between 1900 and 2100),
  series           text,            -- gamme / univers (ex. « Vampire La Mascarade », « 7 Wonders »)
  publishers       text[] not null default '{}',
  authors          text[] not null default '{}',
  illustrators     text[] not null default '{}',
  developers       text[] not null default '{}',
  genres           text[] not null default '{}',   -- catégories JdS / genres JV
  mechanics        text[] not null default '{}',
  themes           text[] not null default '{}',
  languages        text[] not null default '{}',
  description      text,
  cover_url        text,            -- jaquette générique (rempli au lot 2)
  barcodes         text[] not null default '{}',   -- EAN / UPC / ISBN connus
  -- Jeux de société
  players_min      int check (players_min >= 0),
  players_max      int check (players_max >= 0),
  duration_min     int check (duration_min >= 0),
  duration_max     int check (duration_max >= 0),
  age_min          int check (age_min >= 0),
  weight           numeric(3, 2),   -- complexité BGG (1 à 5)
  -- Jeux de rôle
  rpg_system       text,            -- système / édition (ex. « 1re édition », « 3D6 System »)
  rpg_book_type    text,            -- livre de base, supplément, scénario, écran…
  isbn             text,
  -- Commun
  community_rating numeric(4, 2) check (community_rating between 0 and 10),
  base_game_id     uuid references public.games (id) on delete set null,
  source           text not null default 'manuel',  -- manuel, myludo, gamekult, bgg, igdb…
  external_id      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Exemplaire : ce que TU possèdes (une ligne par boîte / cartouche / livre)
-- ---------------------------------------------------------------------------
create table if not exists public.copies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id         uuid not null references public.games (id) on delete cascade,
  status          text not null default 'owned' check (status in ('owned', 'wishlist', 'loaned', 'sold')),
  image_path      text,             -- photo / jaquette de l'exemplaire (bucket privé « photos »)
  added_at        timestamptz not null default now(),   -- date d'ajout à la collection
  acquired_on     date,             -- date d'achat réelle
  price_paid      numeric(10, 2) check (price_paid >= 0),
  purchase_place  text,
  value_estimate  numeric(10, 2) check (value_estimate >= 0),  -- valeur indicative / cote manuelle
  value_date      date,
  rating          numeric(3, 1) check (rating between 0 and 10),  -- note perso /10
  comment         text,
  tags            text[] not null default '{}',
  language        text,
  edition         text,
  location        text,             -- étagère, case Kallax…
  last_played     date,
  -- Jeux de société
  dimensions      text,             -- L x l x h en cm
  weight_g        int check (weight_g >= 0),
  sleeved         boolean,
  complete        boolean,
  -- Jeux vidéo
  platform        text,
  store           text,             -- boutique démat d'origine (PSN, Xbox Live Arcade…)
  format          text check (format in ('physique', 'demat', 'papier', 'pdf')),
  region          text check (region in ('PAL', 'NTSC', 'NTSC-J', 'Autre')),
  has_box         boolean,
  has_manual      boolean,
  has_media       boolean,
  condition       text check (condition in ('neuf', 'tres_bon', 'bon', 'moyen', 'mauvais')),
  play_status     text check (play_status in ('a_faire', 'en_cours', 'fini', 'cent')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists games_user_idx       on public.games (user_id);
create index if not exists games_base_idx       on public.games (base_game_id);
create index if not exists games_barcodes_idx   on public.games using gin (barcodes);
create index if not exists copies_user_idx      on public.copies (user_id);
create index if not exists copies_game_idx      on public.copies (game_id);

-- Date de mise à jour automatique
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists games_touch on public.games;
create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();
drop trigger if exists copies_touch on public.copies;
create trigger copies_touch before update on public.copies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security : chaque ligne n'est visible que par son propriétaire
-- ---------------------------------------------------------------------------
alter table public.games  enable row level security;
alter table public.copies enable row level security;

drop policy if exists "games: propriétaire" on public.games;
create policy "games: propriétaire" on public.games
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "copies: propriétaire" on public.copies;
create policy "copies: propriétaire" on public.copies
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Aucun accès pour les visiteurs non connectés ; accès explicite pour le compte connecté.
revoke all on public.games, public.copies from anon;
grant select, insert, update, delete on public.games, public.copies to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Photos des exemplaires : bucket PRIVÉ, un dossier par compte
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos: lecture propriétaire" on storage.objects;
create policy "photos: lecture propriétaire" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: ajout propriétaire" on storage.objects;
create policy "photos: ajout propriétaire" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: modification propriétaire" on storage.objects;
create policy "photos: modification propriétaire" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: suppression propriétaire" on storage.objects;
create policy "photos: suppression propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
