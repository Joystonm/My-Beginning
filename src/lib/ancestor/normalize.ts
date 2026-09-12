import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type {
  NormalizedFeatures,
  RawFeatures,
} from "./types";
import {
  kindFromCategory,
  refineKindWithTags,
  type AssetKind,
} from "./category";

/**
 * Extract raw features from a CMC listing row.
 * Values that are missing or invalid are coerced to safe defaults
 * so they can still participate in similarity computation.
 */
export function extractRawFeatures(c: CmcCryptocurrency): RawFeatures {
  const quote = c.quote?.USD;
  return {
    symbol: c.symbol,
    name: c.name,
    cmc_rank: c.cmc_rank ?? null,
    market_cap: positiveNumber(quote?.market_cap) ?? 0,
    volume_24h: positiveNumber(quote?.volume_24h) ?? 0,
    num_market_pairs: c.num_market_pairs ?? 0,
    circulating_supply: c.circulating_supply ?? 0,
    total_supply: positiveNumber(c.total_supply),
    max_supply: positiveNumber(c.max_supply),
    date_added_ms: c.date_added ? Date.parse(c.date_added) : null,
    percent_change_1h: boundedNumber(quote?.percent_change_1h, 50),
    percent_change_24h: boundedNumber(quote?.percent_change_24h, 80),
    percent_change_7d: boundedNumber(quote?.percent_change_7d, 150),
    percent_change_30d: boundedNumber(quote?.percent_change_30d, 250),
  };
}

/**
 * Augment an existing `RawFeatures` record with category metadata
 * pulled from CMC's /info endpoint. Returns a new object — the
 * existing `RawFeatures` shape is unchanged (the category fields live
 * separately because /info is a separate, optional call).
 */
export function attachCategoryInfo<
  T extends Pick<RawFeatures, "symbol">,
>(
  features: T,
  category: string | null,
  tags: readonly string[] | null,
): T & { category: string | null; kind: AssetKind } {
  const fromCat = kindFromCategory(category);
  const kind = refineKindWithTags(fromCat, tags);
  return { ...features, category, kind };
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function boundedNumber(value: unknown, bound: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-bound, Math.min(bound, n));
}

/**
 * Compute the universe of normalized features.
 *
 * Normalization strategy:
 *  - log-rank for size (handles BTC dominance without domination)
 *  - rank-based percentile for breadth / activity (robust to outliers)
 *  - bounded proxies for short-term behaviour
 *  - identity for category + kind (already 0..1 in the side-channel map
 *    attached via `attachCategoryInfo`)
 *
 * Returns features in [0, 1] so they can be compared on the same scale.
 */
export function normalizeUniverse(
  raw: RawFeatures[],
  categoryMap?: Map<string, { category: string | null; kind: AssetKind }>,
): NormalizedFeatures[] {
  if (raw.length === 0) return [];

  const marketCaps = raw.map((r) => r.market_cap).filter((n) => n > 0);
  const turnovers = raw
    .map((r) => (r.market_cap > 0 ? r.volume_24h / r.market_cap : 0))
    .filter((n) => n > 0);
  const pairCounts = raw.map((r) => r.num_market_pairs).filter((n) => n > 0);
  const daysListed = raw
    .map((r) => (r.date_added_ms ? daysSince(r.date_added_ms) : 0))
    .filter((n) => n > 0);
  const mom7d = raw.map((r) => r.percent_change_7d);

  const marketCapLogMin = Math.log10(Math.min(...marketCaps));
  const marketCapLogMax = Math.log10(Math.max(...marketCaps));

  const turnoverMin = Math.log10(Math.min(...turnovers));
  const turnoverMax = Math.log10(Math.max(...turnovers));

  const pairMin = Math.log10(Math.min(...pairCounts));
  const pairMax = Math.log10(Math.max(...pairCounts));

  const maturityMin = Math.log10(Math.min(...daysListed));
  const maturityMax = Math.log10(Math.max(...daysListed));

  const momMin = Math.min(...mom7d);
  const momMax = Math.max(...mom7d);

  return raw.map((r) => {
    const turnover =
      r.market_cap > 0 ? r.volume_24h / r.market_cap : Number.NaN;
    const days = r.date_added_ms ? daysSince(r.date_added_ms) : 0;
    const cat = categoryMap?.get(r.symbol.toUpperCase());

    return {
      symbol: r.symbol,
      name: r.name,
      cmc_rank: r.cmc_rank,
      market_cap_position: logScale(
        r.market_cap > 0 ? Math.log10(r.market_cap) : marketCapLogMin,
        marketCapLogMin,
        marketCapLogMax,
      ),
      turnover_position:
        Number.isFinite(turnover) && turnover > 0
          ? logScale(Math.log10(turnover), turnoverMin, turnoverMax)
          : 0,
      momentum_7d: scale01(r.percent_change_7d, momMin, momMax),
      short_volatility:
        (Math.abs(r.percent_change_1h) + Math.abs(r.percent_change_24h)) / 2 / 20,
      market_pair_breadth:
        r.num_market_pairs > 0
          ? logScale(Math.log10(r.num_market_pairs), pairMin, pairMax)
          : 0,
      supply_scarcity:
        r.max_supply && r.max_supply > 0
          ? clamp01(1 - r.circulating_supply / r.max_supply)
          : 0,
      maturity:
        days > 0 ? logScale(Math.log10(days), maturityMin, maturityMax) : 0,
      category: cat ? 1 : 0,
      kind: cat ? 1 : 0,
    };
  });
}

function logScale(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) return 1;
  return clamp01((value - min) / (max - min));
}

function scale01(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) return 0.5;
  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function daysSince(ms: number): number {
  return Math.max(1, (Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export function toIndexedFeatures(
  features: NormalizedFeatures[],
): Map<string, NormalizedFeatures> {
  const map = new Map<string, NormalizedFeatures>();
  for (const f of features) map.set(f.symbol.toUpperCase(), f);
  return map;
}