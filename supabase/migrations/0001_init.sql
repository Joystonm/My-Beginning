-- My Beginning — initial schema
-- Apply via: supabase db push   OR   paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: extends Supabase auth.users with a public profile row.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- universes: user-created collections of assets.
-- ---------------------------------------------------------------------------

create table if not exists public.universes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  color text default 'teal',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists universes_owner_idx on public.universes (owner_id);

alter table public.universes enable row level security;

drop policy if exists "universes_select_own_or_public" on public.universes;
create policy "universes_select_own_or_public" on public.universes
  for select using (owner_id = auth.uid() or is_public);

drop policy if exists "universes_insert_own" on public.universes;
create policy "universes_insert_own" on public.universes
  for insert with check (owner_id = auth.uid());

drop policy if exists "universes_update_own" on public.universes;
create policy "universes_update_own" on public.universes
  for update using (owner_id = auth.uid());

drop policy if exists "universes_delete_own" on public.universes;
create policy "universes_delete_own" on public.universes
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- universe_assets: assets inside a universe.
-- ---------------------------------------------------------------------------

create table if not exists public.universe_assets (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  cmc_id integer not null,
  symbol text not null,
  name text not null,
  position integer not null default 0,
  note text,
  added_at timestamptz not null default now(),
  unique (universe_id, cmc_id)
);

create index if not exists universe_assets_universe_idx on public.universe_assets (universe_id);
create index if not exists universe_assets_symbol_idx on public.universe_assets (symbol);

alter table public.universe_assets enable row level security;

drop policy if exists "universe_assets_select_owner_or_public" on public.universe_assets;
create policy "universe_assets_select_owner_or_public" on public.universe_assets
  for select using (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id
        and (u.owner_id = auth.uid() or u.is_public)
    )
  );

drop policy if exists "universe_assets_modify_owner" on public.universe_assets;
create policy "universe_assets_modify_owner" on public.universe_assets
  for all using (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id and u.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id and u.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- saved_queries: NL→structured Market Lab queries (for AI explainer history).
-- ---------------------------------------------------------------------------

create table if not exists public.saved_queries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  structured jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.saved_queries enable row level security;

drop policy if exists "saved_queries_owner_only" on public.saved_queries;
create policy "saved_queries_owner_only" on public.saved_queries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ancestor_calculation_cache: pre-calculated ancestor relationships.
-- ---------------------------------------------------------------------------

create table if not exists public.ancestor_calculations (
  id uuid primary key default gen_random_uuid(),
  base_symbol text not null,
  base_rank integer,
  base_name text not null,
  results jsonb not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  unique (base_symbol, algorithm_version)
);

create index if not exists ancestor_calculations_base_idx
  on public.ancestor_calculations (base_symbol);

alter table public.ancestor_calculations enable row level security;

drop policy if exists "ancestor_calculations_read_all" on public.ancestor_calculations;
create policy "ancestor_calculations_read_all" on public.ancestor_calculations
  for select using (true);

drop policy if exists "ancestor_calculations_service_write" on public.ancestor_calculations;
-- Writes are restricted to service role only (no client-side policy).