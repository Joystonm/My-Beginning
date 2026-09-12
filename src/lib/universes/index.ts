"use client";

import {
  addAssetToLocalUniverse,
  createLocalUniverse,
  deleteLocalUniverse,
  listLocalUniverses,
  removeAssetFromLocalUniverse,
  updateLocalUniverse,
  type LocalUniverse,
} from "./local";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type Universe = LocalUniverse;

export function isServerAuthEnabled(): boolean {
  return Boolean(getSupabaseBrowserClient());
}

export async function listUniverses(): Promise<Universe[]> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("universes")
      .select("id, name, description, color, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error || !data) return listLocalUniverses();
    const detailed: Universe[] = [];
    for (const row of data) {
      const { data: assets } = await supabase
        .from("universe_assets")
        .select("cmc_id, symbol, name, added_at")
        .eq("universe_id", row.id)
        .order("position", { ascending: true });
      detailed.push({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        color: (row.color as Universe["color"]) ?? "teal",
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
  return listLocalUniverses();
}

export async function createUniverse(input: {
  name: string;
  description?: string;
  color?: Universe["color"];
}): Promise<Universe | null> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("universes")
      .insert({
        name: input.name.trim(),
        description: input.description ?? null,
        color: input.color ?? "teal",
      })
      .select()
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      description: data.description ?? undefined,
      color: (data.color as Universe["color"]) ?? "teal",
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      assets: [],
    };
  }
  return createLocalUniverse(input);
}

export async function deleteUniverse(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase.from("universes").delete().eq("id", id);
    return !error;
  }
  return deleteLocalUniverse(id);
}

export async function addAsset(
  universeId: string,
  asset: { cmcId: number; symbol: string; name: string },
): Promise<Universe | null> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase.from("universe_assets").upsert(
      {
        universe_id: universeId,
        cmc_id: asset.cmcId,
        symbol: asset.symbol,
        name: asset.name,
      },
      { onConflict: "universe_id,cmc_id" },
    );
    if (error) return null;
    // Return updated list
    return refetchUniverse(universeId);
  }
  return addAssetToLocalUniverse(universeId, asset);
}

export async function removeAsset(
  universeId: string,
  cmcId: number,
): Promise<Universe | null> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase
      .from("universe_assets")
      .delete()
      .eq("universe_id", universeId)
      .eq("cmc_id", cmcId);
    if (error) return null;
    return refetchUniverse(universeId);
  }
  return removeAssetFromLocalUniverse(universeId, cmcId);
}

export async function renameUniverse(
  id: string,
  patch: { name?: string; description?: string; color?: Universe["color"] },
): Promise<Universe | null> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { error } = await supabase
      .from("universes")
      .update({
        name: patch.name?.trim(),
        description: patch.description ?? null,
        color: patch.color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return null;
    return refetchUniverse(id);
  }
  return updateLocalUniverse(id, patch);
}

async function refetchUniverse(id: string): Promise<Universe | null> {
  const all = await listUniverses();
  return all.find((u) => u.id === id) ?? null;
}