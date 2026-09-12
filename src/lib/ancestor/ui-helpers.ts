/**
 * UI-only helpers for the /ancestor page.
 *
 * These are kept separate from `engine.ts` so client components can
 * import them without dragging in the server-only `tavily-lineage`
 * module through the engine's re-exports.
 */

import type {
  NormalizedFeatures,
  UniverseMedian,
} from "./types";

/**
 * Per-dimension median across the universe of normalized features.
 * Used to render the radar profile overlay in /ancestor.
 */
export function getUniverseMedian(
  features: NormalizedFeatures[],
): UniverseMedian {
  const empty: UniverseMedian = {
    market_cap_position: 0,
    turnover_position: 0,
    momentum_7d: 0,
    short_volatility: 0,
    market_pair_breadth: 0,
    supply_scarcity: 0,
    maturity: 0,
    category: 0,
    kind: 0,
  };
  if (features.length === 0) return empty;

  const keys: (keyof UniverseMedian)[] = [
    "market_cap_position",
    "turnover_position",
    "momentum_7d",
    "short_volatility",
    "market_pair_breadth",
    "supply_scarcity",
    "maturity",
    "category",
    "kind",
  ];
  const result = { ...empty };
  for (const key of keys) {
    const sorted = [...features]
      .map((f) => (f as unknown as Record<string, number>)[key])
      .filter((v): v is number => Number.isFinite(v))
      .sort((a, b) => a - b);
    if (sorted.length === 0) {
      result[key] = 0;
      continue;
    }
    const mid = Math.floor(sorted.length / 2);
    result[key] =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
  }
  return result;
}

/**
 * Percentile rank (0..1) of a value across the universe of normalized
 * features. Used by the universe-context strip in /ancestor.
 */
export function percentileRank(
  features: NormalizedFeatures[],
  key: keyof UniverseMedian,
  value: number,
): number {
  if (features.length === 0) return 0;
  let below = 0;
  for (const f of features) {
    const v = (f as unknown as Record<string, number>)[key];
    if (typeof v === "number" && Number.isFinite(v) && v <= value) below += 1;
  }
  return below / features.length;
}
