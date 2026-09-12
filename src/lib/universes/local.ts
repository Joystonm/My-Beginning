"use client";

/**
 * Local-storage fallback for Universes when Supabase is not configured.
 * Lets users create and edit universes during a demo without auth setup.
 */

export interface LocalUniverse {
  id: string;
  name: string;
  description?: string;
  color: "teal" | "amber" | "crimson" | "forest" | "graphite";
  assets: LocalUniverseAsset[];
  createdAt: number;
  updatedAt: number;
}

export interface LocalUniverseAsset {
  cmcId: number;
  symbol: string;
  name: string;
  addedAt: number;
}

const KEY = "wima.universes.v1";

function readAll(): LocalUniverse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalUniverse[];
  } catch {
    return [];
  }
}

function writeAll(universes: LocalUniverse[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(universes));
}

export function listLocalUniverses(): LocalUniverse[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createLocalUniverse(input: {
  name: string;
  description?: string;
  color?: LocalUniverse["color"];
}): LocalUniverse {
  const now = Date.now();
  const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const universe: LocalUniverse = {
    id,
    name: input.name.trim() || "Untitled universe",
    description: input.description?.trim() || undefined,
    color: input.color ?? "teal",
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.unshift(universe);
  writeAll(all);
  return universe;
}

export function updateLocalUniverse(
  id: string,
  patch: Partial<Pick<LocalUniverse, "name" | "description" | "color">>,
): LocalUniverse | null {
  const all = readAll();
  const idx = all.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  const next: LocalUniverse = {
    ...existing,
    ...patch,
    name: patch.name?.trim() || existing.name,
    updatedAt: Date.now(),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export function deleteLocalUniverse(id: string): boolean {
  const all = readAll();
  const next = all.filter((u) => u.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function addAssetToLocalUniverse(
  id: string,
  asset: Omit<LocalUniverseAsset, "addedAt">,
): LocalUniverse | null {
  const all = readAll();
  const idx = all.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  if (existing.assets.some((a) => a.cmcId === asset.cmcId)) return existing;
  const next: LocalUniverse = {
    ...existing,
    assets: [
      ...existing.assets,
      { ...asset, addedAt: Date.now() },
    ],
    updatedAt: Date.now(),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export function removeAssetFromLocalUniverse(
  id: string,
  cmcId: number,
): LocalUniverse | null {
  const all = readAll();
  const idx = all.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const existing = all[idx];
  if (!existing) return null;
  const next: LocalUniverse = {
    ...existing,
    assets: existing.assets.filter((a) => a.cmcId !== cmcId),
    updatedAt: Date.now(),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}