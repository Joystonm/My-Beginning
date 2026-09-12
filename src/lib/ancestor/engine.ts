/**
 * Lineage engine — the public API for the /ancestor page.
 *
 * This engine answers a lineage question (who are the ancestors of this
 * coin?) by walking a curated ancestor graph + Tavily-enriched long
 * tail. It does NOT compute statistical similarity — that's a separate
 * concern handled by the Compare engine in /lab.
 *
 * Public API:
 *   - `findLineage(input)` — the main entry point.
 */

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type {
  AncestorEdge,
  LineageResult,
  UniverseEntry,
} from "./types";
import { resolveLineage } from "./lineage";
import { fetchTavilyLineageBatch } from "./tavily-lineage";

export interface FindLineageInput {
  baseSymbol: string;
  listings: CmcCryptocurrency[];
  /** When true (default), call Tavily for coins not in the curated graph. */
  enableTavilyEnrichment?: boolean;
}

/**
 * Resolve the lineage chain for a base asset.
 *
 * - Pulls universe metadata from CMC listings.
 * - Walks the curated ancestor graph (see ./lineage.ts).
 * - For coins not in the curated graph, queries Tavily for lineage hints.
 * - Returns a `LineageResult` ready to ship to the API route.
 */
export async function findLineage(
  input: FindLineageInput,
): Promise<LineageResult | null> {
  const target = input.baseSymbol.toUpperCase();
  const enableTavily = input.enableTavilyEnrichment ?? true;

  if (input.listings.length === 0) return null;

  // Build universe map keyed by uppercase symbol.
  const universe = new Map<string, UniverseEntry>();
  for (const listing of input.listings) {
    universe.set(listing.symbol.toUpperCase(), {
      symbol: listing.symbol.toUpperCase(),
      name: listing.name,
      cmc_rank: listing.cmc_rank ?? null,
      quote: listing.quote?.USD,
    });
  }

  // Confirm the base is in the universe. If not, return null — the API
  // route will surface a 404.
  if (!universe.has(target)) return null;

  // Tavily enrichment: only fetch for symbols that aren't already in the
  // curated graph AND aren't BTC (BTC is the spiritual root of crypto —
  // asking Tavily "what is BTC forked from?" produces nonsense like
  // "BTC is a fork of BCH"). This keeps Tavily credit usage bounded and
  // only fires for the long tail.
  let tavilyEdges = new Map<string, readonly AncestorEdge[]>();
  if (enableTavily && target !== "BTC") {
    const { getEdgesByChild } = await import("./lineage");
    const needTavily: { symbol: string; name: string }[] = [];
    for (const listing of input.listings) {
      const sym = listing.symbol.toUpperCase();
      if (sym === "BTC") continue;
      if (getEdgesByChild(sym).length === 0) {
        needTavily.push({ symbol: sym, name: listing.name });
      }
    }
    if (needTavily.length > 0) {
      tavilyEdges = await fetchTavilyLineageBatch(needTavily);
    }
  }

  return resolveLineage(target, universe, tavilyEdges);
}

// Re-exports for convenience
export { resolveLineage } from "./lineage";
export { fetchTavilyLineageBatch, fetchTavilyLineage } from "./tavily-lineage";
export {
  getCuratedEdges,
  getEdgesByChild,
  LINEAGE_GRAPH_VERSION,
} from "./lineage";

// UI helpers (getUniverseMedian, percentileRank) live in ./ui-helpers.ts
// so client components can import them without dragging in server-only
// modules through these re-exports.
export { getUniverseMedian, percentileRank } from "./ui-helpers";
