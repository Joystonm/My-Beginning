-- My Beginning — coin story persistence
-- Apply via: supabase db push   OR   paste into the Supabase SQL editor.
--
-- Stores the cached Coin Story and the underlying Tavily research so the
-- /ancestor page doesn't re-research a coin every time someone visits.
-- Writes are service-role only (no client policies); reads are public so
-- the SSR story endpoint can hydrate from cache without an auth context.

-- ---------------------------------------------------------------------------
-- coin_story_research: the raw Tavily output + extracted facts
-- ---------------------------------------------------------------------------

create table if not exists public.coin_story_research (
  id uuid primary key default gen_random_uuid(),
  asset_symbol text not null,
  facts jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  research_hash text not null default '',
  researched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_symbol)
);

create index if not exists coin_story_research_symbol_idx
  on public.coin_story_research (asset_symbol);

alter table public.coin_story_research enable row level security;

drop policy if exists "coin_story_research_read_all" on public.coin_story_research;
create policy "coin_story_research_read_all" on public.coin_story_research
  for select using (true);

drop policy if exists "coin_story_research_service_write" on public.coin_story_research;
-- Writes are restricted to service role only (no client-side policy).

-- ---------------------------------------------------------------------------
-- coin_stories: the generated first-person story
-- ---------------------------------------------------------------------------

create table if not exists public.coin_stories (
  id uuid primary key default gen_random_uuid(),
  asset_symbol text not null,
  title text not null,
  hook text not null,
  story_paragraphs jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  research_hash text not null default '',
  fallback boolean not null default false,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_symbol)
);

create index if not exists coin_stories_symbol_idx
  on public.coin_stories (asset_symbol);

alter table public.coin_stories enable row level security;

drop policy if exists "coin_stories_read_all" on public.coin_stories;
create policy "coin_stories_read_all" on public.coin_stories
  for select using (true);

drop policy if exists "coin_stories_service_write" on public.coin_stories;
-- Writes are restricted to service role only (no client-side policy).