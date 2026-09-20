/**
 * Pure helpers for the /explore filter pipeline.
 *
 * - `parseFilters(searchParams)`    — URL → typed filter object.
 * - `buildSearchParams(filters)`    — filter object → URLSearchParams.
 * - `applyFilters(listings, family, filters)` — listings → filtered rows.
 * - `computeInsights(rows)`         — filtered rows → 4-tile headline stats.
 *
 * Keeping these pure (no React) makes them trivially testable and lets
 * the orchestrator stay small.
 */

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { formatPercent } from "@/lib/utils";
import type { Family } from "./families";
import { symbolsInFamily } from "./families";

// ---------------------------------------------------------------------------
// Filter contract — single source of truth for the URL and for React state.
// ---------------------------------------------------------------------------

export type SortKey =
  | "cmc_rank"
  | "market_cap"
  | "volume_24h"
  | "percent_change_24h"
  | "percent_change_7d"
  | "percent_change_30d"
  | "num_market_pairs";

export type Direction = "asc" | "desc";
export type Window = "24h" | "7d" | "30d";
export type Density = "comfortable" | "compact";

export const SORT_KEYS: readonly SortKey[] = [
  "cmc_rank",
  "market_cap",
  "volume_24h",
  "percent_change_24h",
  "percent_change_7d",
  "percent_change_30d",
  "num_market_pairs",
];

export interface ExploreFilters {
  q: string;
  sort: SortKey;
  direction: Direction;
  minCap: number | null;
  category: string;
  window: Window;
  density: Density;
}

export const DEFAULT_FILTERS: ExploreFilters = {
  q: "",
  sort: "cmc_rank",
  direction: "asc",
  minCap: null,
  category: "",
  window: "24h",
  density: "comfortable",
};

/** Numeric metrics read better descending; rank reads better ascending. */
const DEFAULT_DIRECTION_FOR: Record<SortKey, Direction> = {
  cmc_rank: "asc",
  market_cap: "desc",
  volume_24h: "desc",
  percent_change_24h: "desc",
  percent_change_7d: "desc",
  percent_change_30d: "desc",
  num_market_pairs: "desc",
};

// ---------------------------------------------------------------------------
// Parsing — tolerate garbage URLs without throwing.
// ---------------------------------------------------------------------------

/** Cap search-string length to keep the URL bar readable. */
const Q_MAX = 64;

function parseString(v: string | null | undefined, max = Q_MAX): string {
  if (!v) return "";
  return v.slice(0, max);
}

function parseSort(v: string | null | undefined): SortKey {
  if (!v) return DEFAULT_FILTERS.sort;
  return (SORT_KEYS as readonly string[]).includes(v)
    ? (v as SortKey)
    : DEFAULT_FILTERS.sort;
}

function parseDirection(v: string | null | undefined): Direction {
  return v === "asc" || v === "desc" ? v : DEFAULT_FILTERS.direction;
}

function parseMinCap(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseWindow(v: string | null | undefined): Window {
  return v === "7d" || v === "30d" || v === "24h" ? v : DEFAULT_FILTERS.window;
}

function parseDensity(v: string | null | undefined): Density {
  return v === "compact" || v === "comfortable"
    ? v
    : DEFAULT_FILTERS.density;
}

export function parseFilters(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike | null | undefined,
): ExploreFilters {
  // Accept either Next's ReadonlyURLSearchParams (which has .get) or a
  // plain URLSearchParams. We never call mutation methods so the loose
  // contract is fine.
  const get = (k: string): string | null =>
    searchParams && typeof searchParams.get === "function"
      ? searchParams.get(k)
      : null;
  return {
    q: parseString(get("q")).trim(),
    sort: parseSort(get("sort")),
    direction: parseDirection(get("direction")),
    minCap: parseMinCap(get("minCap")),
    category: parseString(get("cat"), 32),
    window: parseWindow(get("window")),
    density: parseDensity(get("density")),
  };
}

/** Minimal contract — Next's ReadonlyURLSearchParams satisfies this. */
export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

// ---------------------------------------------------------------------------
// Building — turn filter state back into URLSearchParams for router.replace.
// Empty / default values are dropped so the URL stays clean.
// ---------------------------------------------------------------------------

function shouldKeep(key: keyof ExploreFilters, value: unknown): boolean {
  switch (key) {
    case "q":
      return typeof value === "string" && value.length > 0;
    case "minCap":
      return typeof value === "number" && value > 0 && Number.isFinite(value);
    case "category":
      return typeof value === "string" && value.length > 0;
    default: {
      const def = DEFAULT_FILTERS[key];
      return value !== def;
    }
  }
}

export function buildSearchParams(filters: ExploreFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.q) out.set("q", filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) out.set("sort", filters.sort);
  if (filters.direction !== DEFAULT_FILTERS.direction)
    out.set("direction", filters.direction);
  if (filters.minCap !== null && filters.minCap > 0)
    out.set("minCap", String(filters.minCap));
  if (filters.category) out.set("cat", filters.category);
  if (filters.window !== DEFAULT_FILTERS.window)
    out.set("window", filters.window);
  if (filters.density !== DEFAULT_FILTERS.density)
    out.set("density", filters.density);
  return out;
}

// ---------------------------------------------------------------------------
// Applying — listings + family + filters → filtered rows.
// ---------------------------------------------------------------------------

export function sortValue(c: CmcCryptocurrency, k: SortKey): number {
  switch (k) {
    case "cmc_rank":
      return c.cmc_rank ?? Number.MAX_SAFE_INTEGER;
    case "market_cap":
      return c.quote?.USD?.market_cap ?? 0;
    case "volume_24h":
      return c.quote?.USD?.volume_24h ?? 0;
    case "percent_change_24h":
      return c.quote?.USD?.percent_change_24h ?? 0;
    case "percent_change_7d":
      return c.quote?.USD?.percent_change_7d ?? 0;
    case "percent_change_30d":
      return c.quote?.USD?.percent_change_30d ?? 0;
    case "num_market_pairs":
      return c.num_market_pairs ?? 0;
  }
}

export interface ApplyFiltersResult {
  rows: CmcCryptocurrency[];
  familySize: number; // how many listings the family itself matched
  totalSize: number; // total listings loaded
}

export function applyFilters(
  listings: readonly CmcCryptocurrency[],
  family: Family,
  filters: ExploreFilters,
): ApplyFiltersResult {
  const familySyms = symbolsInFamily(family, listings);
  const up = filters.q.toUpperCase();
  const minCap = filters.minCap ?? 0;

  let rows = listings.filter((c) => {
    if (family.id !== "" && !familySyms.has(c.symbol.toUpperCase())) {
      return false;
    }
    if (up) {
      const matches =
        c.symbol.toUpperCase().includes(up) ||
        c.name.toUpperCase().includes(up);
      if (!matches) return false;
    }
    const cap = c.quote?.USD?.market_cap ?? 0;
    if (cap < minCap) return false;
    return true;
  });

  rows = [...rows].sort((a, b) => {
    const av = sortValue(a, filters.sort);
    const bv = sortValue(b, filters.sort);
    if (av === bv) return (a.cmc_rank ?? 0) - (b.cmc_rank ?? 0);
    return filters.direction === "asc" ? av - bv : bv - av;
  });

  return {
    rows,
    familySize: familySyms.size,
    totalSize: listings.length,
  };
}

// ---------------------------------------------------------------------------
// Click-to-sort direction picker.
// ---------------------------------------------------------------------------

export function nextSort(
  prev: { key: SortKey; direction: Direction },
  clicked: SortKey,
): { key: SortKey; direction: Direction } {
  if (prev.key !== clicked) {
    return { key: clicked, direction: DEFAULT_DIRECTION_FOR[clicked] };
  }
  // Same key — toggle direction.
  return {
    key: clicked,
    direction: prev.direction === "asc" ? "desc" : "asc",
  };
}

// ---------------------------------------------------------------------------
// Insight strip — 4 stat tiles computed from filtered rows.
// ---------------------------------------------------------------------------

export interface Insights {
  count: number;
  median24h: number | null;
  topGainer: { symbol: string; name: string; pct: number } | null;
  topLoser: { symbol: string; name: string; pct: number } | null;
  gainers: number; // count with pct_change_24h > 0
  losers: number; // count with pct_change_24h < 0
}

export function computeInsights(rows: readonly CmcCryptocurrency[]): Insights {
  const count = rows.length;
  if (count === 0) {
    return {
      count: 0,
      median24h: null,
      topGainer: null,
      topLoser: null,
      gainers: 0,
      losers: 0,
    };
  }
  const pcts: number[] = [];
  let gainers = 0;
  let losers = 0;
  let topGainer: { symbol: string; name: string; pct: number } | null = null;
  let topLoser: { symbol: string; name: string; pct: number } | null = null;

  for (const c of rows) {
    const pct = c.quote?.USD?.percent_change_24h;
    if (pct === undefined || pct === null || !Number.isFinite(pct)) continue;
    pcts.push(pct);
    if (pct > 0) gainers += 1;
    else if (pct < 0) losers += 1;
    if (!topGainer || pct > topGainer.pct) {
      topGainer = { symbol: c.symbol, name: c.name, pct };
    }
    if (!topLoser || pct < topLoser.pct) {
      topLoser = { symbol: c.symbol, name: c.name, pct };
    }
  }

  return {
    count,
    median24h: median(pcts),
    topGainer,
    topLoser,
    gainers,
    losers,
  };
}

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

// ---------------------------------------------------------------------------
// Display helpers — keep formatting out of the components.
// ---------------------------------------------------------------------------

export function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return formatPercent(v);
}
