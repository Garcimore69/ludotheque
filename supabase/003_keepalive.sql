-- 003_keepalive.sql : empêche la mise en pause du projet Supabase (plan gratuit)
-- Une table d'une seule ligne, mise à jour par le workflow GitHub "keepalive".
-- Seule action ouverte à la clé publique : appeler keepalive_ping(). Rejouable.

create table if not exists public.keepalive (
  id         int primary key default 1 check (id = 1),
  last_ping  timestamptz not null default now(),
  pings      bigint not null default 0
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

-- RLS active, aucune politique : la table n'est lisible ni modifiable directement par personne
alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;

-- Écriture réelle en base (compte comme activité), sans exposer aucune donnée
create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive
     set last_ping = now(), pings = pings + 1
   where id = 1
  returning last_ping;
$$;

revoke all on function public.keepalive_ping() from public, anon, authenticated;
grant execute on function public.keepalive_ping() to anon;
