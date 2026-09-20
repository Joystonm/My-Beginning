/**
 * Lineage drift detector.
 *
 * The headline insight of "Who Is My Ancestor": not just *who* is in the
 * family tree, but *which* members of the family are moving.
 *
 * For a base asset, we walk its descendants in the curated ancestor
 * graph, fetch each descendant's 30-day price history from CMC
 * (/v1/cryptocurrency/quotes/historical), and compute the simple return
 * over that window. We then surface:
 *
 *   - the strongest and weakest member over the window,
 *   - the median family return,
 *   - how the family median compares to the base asset's own return.
 *
 * The result is the kind of stat that's shareable on X and quotable in a
 * pitch: "BTC's strongest descendant in the last 30 days is SOL (+12%).
 * The weakest is BSV (-8%). The family median beat BTC itself by 1.4
 * points."
 *
 * Implementation notes:
 *
 *   - We deliberately use a simple price-return metric, not a risk-
 *     adjusted one. The point is *who moved*, not who moved best.
 *   - We filter descendants to those currently in the top 100 by market
 *     cap rank — anything below the top 100 has noisy, thin liquidity
 *     and would dominate the "biggest mover" headline incorrectly.
 *   - We always include BTC's own price over the window so the UI can
 *     render the family-vs-base comparison without an extra request.
 *   - All API calls go through the batched historical client so a 30+
 *     descendant family comes back in one round-trip.
 */

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import {
  getHistoricalGlobalMetrics,
  getHistoricalQuotesForSymbols,
} from "@/lib/cmc/client";
import { descendantsOf, getEdgesByParent } from "./lineage";
import type { AncestorEdge, RelationType } from "./types";

export interface DriftEntry {
  symbol: string;
  name: string;
  /** How this descendant relates to the base. */
  relation: RelationType;
  /** Confidence of the lineage edge (0..1). */
  confidence: number;
  /** Current CoinMarketCap rank, if available. */
  cmc_rank: number | null;
  /** Price at the start of the window. */
  price_then: number | null;
  /** Price at the end of the window. */
  price_now: number | null;
  /** Percent return over the window. `null` if price data is missing. */
  return_pct: number | null;
}

export interface LineageDrift {
  base: string;
  base_name: string;
  /** Window length in days. */
  window_days: number;
  /** ISO timestamp at which the drift was computed. */
  calculated_at: string;
  /** How many descendants the curated graph reports for `base`. */
  family_size: number;
  /** How many of those descendants we successfully evaluated. */
  evaluated_size: number;
  /** Median percent return across evaluated descendants, or null if none. */
  family_median_return_pct: number | null;
  /** Base asset's own percent return over the same window. */
  base_return_pct: number | null;
  /**
   * family_median - base. Positive means the family outperformed the
   * base; negative means it underperformed.
   */
  family_vs_base_delta_pct: number | null;
  /** Total crypto market cap return over the same window. */
  market_return_pct: number | null;
  /**
   * family_median - market. Positive means the family outperformed the
   * overall crypto market; negative means it underperformed.
   */
  family_vs_market_delta_pct: number | null;
  /** Entries sorted by absolute return (largest movers first). */
  entries: DriftEntry[];
  biggest_gainer: DriftEntry | null;
  biggest_loser: DriftEntry | null;
}

interface ComputeDriftInput {
  baseSymbol: string;
  /** Current universe snapshot — used to resolve names + ranks for descendants. */
  listings: CmcCryptocurrency[];
  /** Window length in days. Defaults to 30. */
  windowDays?: number;
  /** Cap on how many descendants to fetch history for. Defaults to 30. */
  descendantLimit?: number;
}

/**
 * Resolve the descendant list for the base asset, joining the curated
 * graph's edges with the live universe so we have names, ranks, and
 * relations.
 *
 * Exported so tests and other surfaces can preview the candidate set
 * without paying the API cost.
 */
export function candidateDescendants(
  baseSymbol: string,
  listings: readonly CmcCryptocurrency[],
): Array<{
  symbol: string;
  name: string;
  cmc_rank: number | null;
  relation: RelationType;
  confidence: number;
}> {
  const target = baseSymbol.toUpperCase();
  const out: Array<{
    symbol: string;
    name: string;
    cmc_rank: number | null;
    relation: RelationType;
    confidence: number;
  }> = [];

  // Walk 1st-degree descendants via the curated graph.
  const directEdges: AncestorEdge[] = [
    ...((getEdgesByParent(target) as readonly AncestorEdge[]) ?? []),
  ];

  const universe = new Map<string, CmcCryptocurrency>();
  for (const listing of listings) {
    universe.set(listing.symbol.toUpperCase(), listing);
  }

  for (const edge of directEdges) {
    const sym = edge.child.toUpperCase();
    const listing = universe.get(sym);
    if (!listing) continue; // unknown to current universe — skip
    out.push({
      symbol: sym,
      name: listing.name,
      cmc_rank: listing.cmc_rank ?? null,
      relation: edge.relation,
      confidence: edge.confidence,
    });
  }

  // De-dupe (a coin can be reachable through multiple relations).
  const seen = new Set<string>();
  return out.filter((d) => {
    if (seen.has(d.symbol)) return false;
    seen.add(d.symbol);
    return true;
  });
}

/**
 * Compute lineage drift for a base asset.
 *
 * Returns null if the base has no descendants in the universe or if all
 * candidates lack price history. The UI degrades gracefully — an empty
 * result is still a valid "nothing notable moved this week" story.
 */
export async function computeLineageDrift(
  input: ComputeDriftInput,
): Promise<LineageDrift | null> {
  const target = input.baseSymbol.toUpperCase();
  const windowDays = Math.max(7, Math.min(90, input.windowDays ?? 30));
  const descendantLimit = Math.max(
    1,
    Math.min(60, input.descendantLimit ?? 30),
  );

  // 1. Resolve descendants from the curated graph.
  const descendants = candidateDescendants(target, input.listings);
  if (descendants.length === 0) return null;

  // 2. Filter to top 100 by rank, cap to descendantLimit, and make sure
  //    the base itself is in the fetch set (so we can compute its return).
  const universeBySymbol = new Map<string, CmcCryptocurrency>();
  for (const listing of input.listings) {
    universeBySymbol.set(listing.symbol.toUpperCase(), listing);
  }
  const baseListing = universeBySymbol.get(target);
  const rankedDescendants = descendants
    .filter((d) => (d.cmc_rank ?? Infinity) <= 100)
    .sort((a, b) => (a.cmc_rank ?? Infinity) - (b.cmc_rank ?? Infinity))
    .slice(0, descendantLimit);

  const symbolsToFetch = [target, ...rankedDescendants.map((d) => d.symbol)];

  // 3. Fetch 30-day price history in parallel + the overall market.
  const [histories, globalHistory] = await Promise.all([
    getHistoricalQuotesForSymbols(symbolsToFetch, {
      interval: "1d",
      count: windowDays + 1,
    }),
    getHistoricalGlobalMetrics({
      interval: "1d",
      count: windowDays + 1,
    }).catch(() => null),
  ]);

  // 4. Compute return for each entry.
  const entries: DriftEntry[] = [];
  const baseReturn = computeReturnPct(histories.get(target));

  for (const d of rankedDescendants) {
    const history = histories.get(d.symbol);
    if (!history) continue;
    const points = history.quotes ?? [];
    if (points.length < 2) continue;
    const first = points[0]!.quote.USD.price;
    const last = points[points.length - 1]!.quote.USD.price;
    if (!Number.isFinite(first) || first <= 0) continue;
    if (!Number.isFinite(last) || last <= 0) continue;
    const ret = ((last - first) / first) * 100;
    entries.push({
      symbol: d.symbol,
      name: d.name,
      relation: d.relation,
      confidence: d.confidence,
      cmc_rank: d.cmc_rank,
      price_then: first,
      price_now: last,
      return_pct: Number.isFinite(ret) ? Math.round(ret * 100) / 100 : null,
    });
  }

  // 5. Sort by absolute return desc — the "biggest mover" framing.
  entries.sort(
    (a, b) =>
      Math.abs(b.return_pct ?? 0) - Math.abs(a.return_pct ?? 0) ||
      (b.return_pct ?? 0) - (a.return_pct ?? 0),
  );

  const familyMedian =
    entries.length === 0
      ? null
      : Math.round(median(entries.map((e) => e.return_pct ?? 0)) * 100) / 100;
  const familyVsBase =
    familyMedian !== null && baseReturn !== null
      ? Math.round((familyMedian - baseReturn) * 100) / 100
      : null;

  // Market context: total crypto market cap return over the same window.
  const marketReturn = computeMarketReturnPct(globalHistory);
  const familyVsMarket =
    familyMedian !== null && marketReturn !== null
      ? Math.round((familyMedian - marketReturn) * 100) / 100
      : null;

  return {
    base: target,
    base_name: baseListing?.name ?? target,
    window_days: windowDays,
    calculated_at: new Date().toISOString(),
    family_size: descendants.length,
    evaluated_size: entries.length,
    family_median_return_pct: familyMedian,
    base_return_pct:
      baseReturn !== null ? Math.round(baseReturn * 100) / 100 : null,
    family_vs_base_delta_pct: familyVsBase,
    market_return_pct:
      marketReturn !== null ? Math.round(marketReturn * 100) / 100 : null,
    family_vs_market_delta_pct: familyVsMarket,
    entries,
    biggest_gainer:
      entries.find((e) => (e.return_pct ?? -Infinity) > 0) ?? null,
    biggest_loser:
      entries.find((e) => (e.return_pct ?? Infinity) < 0) ?? null,
  };
}

function computeReturnPct(history: unknown): number | null {
  if (!history) return null;
  const points =
    (history as { quotes?: { quote: { USD: { price: number } } }[] }).quotes ?? [];
  if (points.length < 2) return null;
  const first = points[0]!.quote.USD.price;
  const last = points[points.length - 1]!.quote.USD.price;
  if (!Number.isFinite(first) || first <= 0) return null;
  if (!Number.isFinite(last) || last <= 0) return null;
  return ((last - first) / first) * 100;
}

function computeMarketReturnPct(history: unknown): number | null {
  if (!history) return null;
  const points =
    (history as {
      quotes?: { quote: { USD: { total_market_cap: number } } }[];
    }).quotes ?? [];
  if (points.length < 2) return null;
  const first = points[0]!.quote.USD.total_market_cap;
  const last = points[points.length - 1]!.quote.USD.total_market_cap;
  if (!Number.isFinite(first) || first <= 0) return null;
  if (!Number.isFinite(last) || last <= 0) return null;
  return ((last - first) / first) * 100;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

// Re-export the descendant walker for callers that already import from
// the engine module.
export { descendantsOf };
