-- Who Is My Ancestor — auth hardening
-- Apply via: supabase db push   OR   paste into the Supabase SQL editor.
--
-- This migration consolidates RLS policies across user-scoped tables
-- so that every operation (SELECT / INSERT / UPDATE / DELETE) is
-- explicitly gated on `auth.uid()` matching the owner. Previously
-- some tables used `for all`, which conflates SELECT with mutating
-- policies; we split them for clarity and auditability.
--
-- All writes from the browser go through the anon-key SSR client,
-- so these policies are the security boundary. Writes performed by
-- the service role bypass RLS entirely.

-- ---------------------------------------------------------------------------
-- profiles — already gated on id = auth.uid(). No changes needed.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- universes — split the for-all policy into per-operation policies.
-- ---------------------------------------------------------------------------

drop policy if exists "universes_select_own_or_public" on public.universes;
drop policy if exists "universes_insert_own" on public.universes;
drop policy if exists "universes_update_own" on public.universes;
drop policy if exists "universes_delete_own" on public.universes;

create policy "universes_select_own_or_public"
  on public.universes
  for select
  using (owner_id = auth.uid() or is_public);

create policy "universes_insert_own"
  on public.universes
  for insert
  with check (owner_id = auth.uid());

create policy "universes_update_own"
  on public.universes
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "universes_delete_own"
  on public.universes
  for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- universe_assets — keep SELECT open to owners of public universes, but
-- restrict all mutations to owners.
-- ---------------------------------------------------------------------------

drop policy if exists "universe_assets_select_owner_or_public" on public.universe_assets;
drop policy if exists "universe_assets_modify_owner" on public.universe_assets;

create policy "universe_assets_select_owner_or_public"
  on public.universe_assets
  for select
  using (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id
        and (u.owner_id = auth.uid() or u.is_public)
    )
  );

create policy "universe_assets_insert_owner"
  on public.universe_assets
  for insert
  with check (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id and u.owner_id = auth.uid()
    )
  );

create policy "universe_assets_update_owner"
  on public.universe_assets
  for update
  using (
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

create policy "universe_assets_delete_owner"
  on public.universe_assets
  for delete
  using (
    exists (
      select 1 from public.universes u
      where u.id = universe_assets.universe_id and u.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- saved_queries — split into SELECT and mutation policies.
-- ---------------------------------------------------------------------------

drop policy if exists "saved_queries_owner_only" on public.saved_queries;

create policy "saved_queries_select_own"
  on public.saved_queries
  for select
  using (owner_id = auth.uid());

create policy "saved_queries_insert_own"
  on public.saved_queries
  for insert
  with check (owner_id = auth.uid());

create policy "saved_queries_update_own"
  on public.saved_queries
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "saved_queries_delete_own"
  on public.saved_queries
  for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ancestor_calculations + coin_story_* tables — public read, service-role
-- only writes (no client policies). No changes.
-- ---------------------------------------------------------------------------
