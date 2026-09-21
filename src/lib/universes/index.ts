"use client";

/**
 * Browser-side Universes CRUD.
 *
 * All operations go through /api/universes/* so the user's session
 * cookie is forwarded by Next.js and RLS sees `auth.uid()` correctly.
 * We never hit Supabase REST directly from the browser.
 *
 * The previous version used `getSupabaseBrowserClient()` and queried
 * PostgREST directly with the anon key — but the browser was sending
 * `Authorization: Bearer <anon-key>` rather than the user's JWT,
 * which caused RLS to evaluate `auth.uid() = null` and return 403.
 */

import {
  addAssetToLocalUniverse,
  createLocalUniverse,
  deleteLocalUniverse,
  listLocalUniverses,
  removeAssetFromLocalUniverse,
  reorderAssetsInLocalUniverse,
  updateLocalUniverse,
  type LocalUniverse,
} from "./local";

export type Universe = LocalUniverse;
export type { LocalUniverseAsset } from "./local";

export function isServerAuthEnabled(): boolean {
  // We now always require server-side auth. The check exists so
  // existing UI strings keep working; if Supabase is not configured
  // the API routes will return errors and the UI falls back gracefully.
  return true;
}

async function jsonRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    body = {} as T;
  }
  return { ok: res.ok, status: res.status, body };
}

export async function listUniverses(): Promise<Universe[]> {
  try {
    const { ok, status, body } = await jsonRequest<{
      universes?: Universe[];
      error?: string;
    }>("/api/universes");
    if (ok && body.universes) return body.universes;
    // Fall through to local on auth/perm failures so the UI doesn't crash.
    if (status === 401 || status === 403) return listLocalUniverses();
    return listLocalUniverses();
  } catch {
    return listLocalUniverses();
  }
}

export async function createUniverse(input: {
  name: string;
  description?: string;
  color?: Universe["color"];
}): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>("/api/universes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return createLocalUniverse(input);
}

export async function deleteUniverse(id: string): Promise<boolean> {
  try {
    const { ok } = await jsonRequest<{ ok?: boolean }>(
      `/api/universes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (ok) return true;
  } catch {
    /* fall through */
  }
  return deleteLocalUniverse(id);
}

export async function addAsset(
  universeId: string,
  asset: { cmcId: number; symbol: string; name: string },
): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>(`/api/universes/${encodeURIComponent(universeId)}/assets`, {
      method: "POST",
      body: JSON.stringify(asset),
    });
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return addAssetToLocalUniverse(universeId, asset);
}

export async function removeAsset(
  universeId: string,
  cmcId: number,
): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>(
      `/api/universes/${encodeURIComponent(universeId)}/assets?cmcId=${encodeURIComponent(String(cmcId))}`,
      { method: "DELETE" },
    );
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return removeAssetFromLocalUniverse(universeId, cmcId);
}

export async function renameUniverse(
  id: string,
  patch: { name?: string; description?: string; color?: Universe["color"] },
): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>(`/api/universes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return updateLocalUniverse(id, patch);
}

export async function setUniverseVisibility(
  id: string,
  isPublic: boolean,
): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>(`/api/universes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic }),
    });
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return updateLocalUniverse(id, { isPublic });
}

export async function reorderAssets(
  universeId: string,
  orderedCmcIds: number[],
): Promise<Universe | null> {
  try {
    const { ok, body } = await jsonRequest<{
      universe?: Universe;
      error?: string;
    }>(
      `/api/universes/${encodeURIComponent(universeId)}/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ order: orderedCmcIds }),
      },
    );
    if (ok && body.universe) return body.universe;
  } catch {
    /* fall through */
  }
  return reorderAssetsInLocalUniverse(universeId, orderedCmcIds);
}
