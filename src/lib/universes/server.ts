import "server-only";

/**
 * Server-side Universes CRUD.
 *
 * All operations require an authenticated user (the SSR client reads
 * the session cookie, so `auth.uid()` is populated for RLS). Used by
 * the /api/universes/* routes — the browser should never hit
 * Supabase REST directly for this table.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LocalUniverse, LocalUniverseAsset } from "./local";

export type Universe = LocalUniverse;

function mapColor(value: unknown): Universe["color"] {
  const allowed = ["teal", "amber", "crimson", "forest", "graphite"];
  return (allowed.includes(String(value)) ? String(value) : "teal") as Universe["color"];
}

/**
 * Build a URL-safe slug from a universe name. Appends a short random
 * suffix to satisfy the `(owner_id, slug)` uniqueness constraint — two
 * users can both have a universe called "AI" without colliding.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * List all universes owned by the current user.
 *
 * We only return universes owned by the caller — RLS makes
 * `is_public` rows accessible too, but for "My Universes" the user
 * expects their own collections.
 */
export async function listUniversesForUser(userId: string): Promise<Universe[]> {
  const client = getSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("universes")
    .select("id, name, description, color, is_public, created_at, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("[universes] listUniversesForUser failed:", {
      userId,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return [];
  }
  const detailed: Universe[] = [];
  for (const row of data) {
    const { data: assets } = await client
      .from("universe_assets")
      .select("cmc_id, symbol, name, added_at, position")
      .eq("universe_id", row.id)
      .order("position", { ascending: true });
    detailed.push({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      color: mapColor(row.color),
      isPublic: Boolean(row.is_public),
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      assets: (assets ?? []).map((a) => ({
        cmcId: a.cmc_id,
        symbol: a.symbol,
        name: a.name,
        addedAt: new Date(a.added_at).getTime(),
      })),
    });
  }
  return detailed;
}

export async function createUniverseForUser(
  userId: string,
  input: { name: string; description?: string; color?: Universe["color"] },
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("universes")
    .insert({
      owner_id: userId,
      slug: generateSlug(input.name),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? "teal",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[universes] createUniverseForUser failed:", {
      userId,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? undefined,
    color: mapColor(data.color),
    isPublic: Boolean(data.is_public),
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    assets: [],
  };
}

export async function deleteUniverseForUser(
  userId: string,
  id: string,
): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;
  const { error } = await client
    .from("universes")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  return !error;
}

export async function renameUniverseForUser(
  userId: string,
  id: string,
  patch: { name?: string; description?: string; color?: Universe["color"] },
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.description !== undefined) updates.description = patch.description ?? null;
  if (patch.color !== undefined) updates.color = patch.color;

  const { error } = await client
    .from("universes")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) {
    console.error("[universes] renameUniverseForUser failed:", {
      userId,
      id,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return refetchUniverseForUser(userId, id);
}

export async function setUniverseVisibilityForUser(
  userId: string,
  id: string,
  isPublic: boolean,
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { error } = await client
    .from("universes")
    .update({
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) {
    console.error("[universes] setUniverseVisibilityForUser failed:", {
      userId,
      id,
      isPublic,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return refetchUniverseForUser(userId, id);
}

export async function addAssetForUser(
  userId: string,
  universeId: string,
  asset: { cmcId: number; symbol: string; name: string },
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  // RLS will reject inserts to a universe the user does not own. To
  // keep the surface small we still re-check ownership here.
  const { data: owned } = await client
    .from("universes")
    .select("id")
    .eq("id", universeId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!owned) {
    console.error("[universes] addAssetForUser: universe not found or not owned", {
      userId,
      universeId,
    });
    return null;
  }

  // Determine next position.
  const { data: existing } = await client
    .from("universe_assets")
    .select("position")
    .eq("universe_id", universeId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await client.from("universe_assets").upsert(
    {
      universe_id: universeId,
      cmc_id: asset.cmcId,
      symbol: asset.symbol,
      name: asset.name,
      position: nextPos,
    },
    { onConflict: "universe_id,cmc_id" },
  );
  if (error) {
    console.error("[universes] addAssetForUser upsert failed:", {
      userId,
      universeId,
      asset,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  // Touch updated_at on the universe.
  await client
    .from("universes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", universeId);

  return refetchUniverseForUser(userId, universeId);
}

export async function removeAssetForUser(
  userId: string,
  universeId: string,
  cmcId: number,
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { error } = await client
    .from("universe_assets")
    .delete()
    .eq("universe_id", universeId)
    .eq("cmc_id", cmcId);
  if (error) {
    console.error("[universes] removeAssetForUser failed:", {
      userId,
      universeId,
      cmcId,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  await client
    .from("universes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", universeId);

  return refetchUniverseForUser(userId, universeId);
}

async function refetchUniverseForUser(
  userId: string,
  id: string,
): Promise<Universe | null> {
  const all = await listUniversesForUser(userId);
  return all.find((u) => u.id === id) ?? null;
}

/**
 * Persist a new ordering for a universe's assets. Updates
 * `universe_assets.position` in place — no need to delete and re-insert.
 *
 * Position values are assigned sequentially in the order received, so
 * the caller just needs to send the cmc_ids in the desired order.
 */
export async function reorderAssetsForUser(
  userId: string,
  universeId: string,
  orderedCmcIds: number[],
): Promise<Universe | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  // Confirm ownership before mutating.
  const { data: owned } = await client
    .from("universes")
    .select("id")
    .eq("id", universeId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!owned) {
    console.error("[universes] reorderAssetsForUser: universe not found or not owned", {
      userId,
      universeId,
    });
    return null;
  }

  // Fire position updates in parallel — each is independent.
  const updates = await Promise.all(
    orderedCmcIds.map((cmcId, position) =>
      client
        .from("universe_assets")
        .update({ position })
        .eq("universe_id", universeId)
        .eq("cmc_id", cmcId)
        .then(({ error }) => ({ cmcId, error })),
    ),
  );
  const failed = updates.filter((u) => u.error);
  if (failed.length > 0) {
    console.error("[universes] reorderAssetsForUser: some position updates failed:", {
      userId,
      universeId,
      failures: failed.map((f) => ({ cmcId: f.cmcId, message: f.error?.message })),
    });
    return null;
  }

  // Touch updated_at on the universe so the card's relative timestamp refreshes.
  await client
    .from("universes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", universeId);

  return refetchUniverseForUser(userId, universeId);
}

export type { LocalUniverseAsset };
