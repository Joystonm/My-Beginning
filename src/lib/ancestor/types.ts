/**
 * Types for the lineage engine (v2) + retained dimension types for the
 * radar/universe-context UI components.
 *
 * Algorithm version 2.0.0 is a hard pivot from the previous similarity
 * engine (1.x). The new model answers a different question:
 *
 *   "What coins is this asset descended from — by code fork, by being
 *    a native token on another chain, by being a wrapped version, by
 *    being explicitly inspired by, or by being a spiritual descendant
 *    of the original cryptocurrency?"
 *
 * It does NOT answer "what other coins look similar to me". That's
 * a separate question handled by the Compare engine in /lab.
 *
 * The dimension types below remain because RadarProfile / UniverseContext
 * still draw the base asset's fingerprint against the universe median —
 * a single-asset view, not a peer comparison.
 */

import type { CmcCryptocurrency, CmcUsdQuote } from "@/lib/cmc/types";

export const ALGORITHM_VERSION = "2.0.0";

/**
 * How one coin descended from another.
 *
 *   - `fork`         — child's code forked parent's code
 *   - `platform`     — child is a native token on parent's chain
 *   - `wrapped`      — child is a wrapped version of parent on another chain
 *   - `inspiration`  — child was explicitly designed as a successor to parent
 *   - `conceptual`   — child is in the same broad category and came later;
 *                      the parent is the spiritual origin (BTC for most altcoins)
 */
export type RelationType =
  | "fork"
  | "platform"
  | "wrapped"
  | "inspiration"
  | "conceptual";

/** Short caption for a relation type — used in UI labels. */
export function shortRelationLabel(relation: RelationType): string {
  switch (relation) {
    case "fork":
      return "Forked from";
    case "platform":
      return "Token on";
    case "wrapped":
      return "Wrapped from";
    case "inspiration":
      return "Inspired by";
    case "conceptual":
      return "Spiritual descendant of";
  }
}

/**
 * The directional role of an asset relative to the selected base.
 *
 * This is the explicit semantic direction — never inferred from visual
 * position. The UI labels each section by direction so the relationship
 * meaning is never ambiguous.
 *
 *   - `ancestor`     — asset is upstream of the base (came before it)
 *   - `descendant`   — asset is downstream of the base (came after it)
 *   - `relative`     — asset is a peer (similar category / era / mechanism)
 *   - `similarity`   — asset is statistically similar (market-shape only)
 */
export type RelationshipDirection =
  | "ancestor"
  | "descendant"
  | "relative"
  | "similarity";

/**
 * A directed edge in the ancestor graph: `child` descends from `parent`.
 *
 * Direction is encoded explicitly by the `parent` / `child` fields — the
 * arrow always points from `child` to `parent` when traversing the
 * lineage. This is what keeps the hierarchy semantically correct: the
 * UI never has to infer direction from position.
 */
export interface AncestorEdge {
  parent: string;
  child: string;
  /** Direction of this edge from the perspective of the SELECTED base. */
  direction: RelationshipDirection;
  relation: RelationType;
  /** 0..1 — how strong is the lineage claim. */
  confidence: number;
  /** Human-readable explanation. */
  notes: string;
  /** Where the edge came from. */
  source: "curated" | "tavily";
}

/**
 * A resolved ancestor asset — the edge + the CMC universe metadata
 * needed to render it in the UI.
 */
export interface AncestorNode {
  symbol: string;
  name: string;
  cmc_rank: number | null;
  relation: RelationType;
  confidence: number;
  notes: string;
  source: "curated" | "tavily";
  /** Quote (price, etc.) if the asset is in the current top-N universe. */
  quote?: CmcUsdQuote;
  /** True if this ancestor is in the current top-N universe. */
  inUniverse: boolean;
}

/**
 * The full result for a base asset.
 */
export interface LineageResult {
  base: string;
  base_name: string;
  base_rank: number | null;
  /** Direct edges (child → parent for the base). */
  edges: AncestorEdge[];
  /** Resolved ancestor nodes, ordered by chain depth (closest first). */
  ancestors: AncestorNode[];
  /** Flat ordered list of ancestor symbols for breadcrumb display. */
  lineage_chain: string[];
  calculated_at: string;
  algorithm_version: typeof ALGORITHM_VERSION;
  meta?: {
    noAncestors?: boolean;
    noAncestorsReason?: string;
    curatedHits?: number;
    tavilyHits?: number;
  };
}

/** Compact view of the universe passed into `findLineage`. */
export interface UniverseEntry {
  symbol: string;
  name: string;
  cmc_rank?: number | null;
  quote?: CmcUsdQuote;
}

// ---------------------------------------------------------------------------
// Retained dimension types — used by RadarProfile / UniverseContext to
// render the base asset's fingerprint against the universe median. Not
// used by the engine itself.
// ---------------------------------------------------------------------------

export interface DimensionDef {
  id: string;
  label: string;
  description: string;
  weight: number; // 0..1
}

export interface RawFeatures {
  symbol: string;
  name: string;
  cmc_rank: number | null;
  market_cap: number;
  volume_24h: number;
  num_market_pairs: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  date_added_ms: number | null;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
}

export interface NormalizedFeatures {
  symbol: string;
  name: string;
  cmc_rank: number | null;
  market_cap_position: number;
  turnover_position: number;
  momentum_7d: number;
  short_volatility: number;
  market_pair_breadth: number;
  supply_scarcity: number;
  maturity: number;
  category: number;
  kind: number;
}

export interface UniverseMedian {
  market_cap_position: number;
  turnover_position: number;
  momentum_7d: number;
  short_volatility: number;
  market_pair_breadth: number;
  supply_scarcity: number;
  maturity: number;
  category: number;
  kind: number;
}

export const DEFAULT_DIMENSIONS: DimensionDef[] = [
  {
    id: "category",
    label: "Category Affinity",
    description:
      "Whether the candidate sits in the same CMC category as the base.",
    weight: 0.22,
  },
  {
    id: "kind",
    label: "Asset Kind",
    description:
      "Whether the candidate is the same *kind* of asset — store-of-value, smart-contract platform, stablecoin, meme, defi, exchange token, privacy, etc.",
    weight: 0.18,
  },
  {
    id: "market_cap_position",
    label: "Market Cap Profile",
    description:
      "How close two assets sit on the global market-cap ladder.",
    weight: 0.14,
  },
  {
    id: "turnover_position",
    label: "Volume Profile",
    description:
      "How active trading is relative to size (24h volume ÷ market cap).",
    weight: 0.12,
  },
  {
    id: "momentum_7d",
    label: "Price Performance",
    description:
      "Trailing 7-day price change, normalized across the universe.",
    weight: 0.10,
  },
  {
    id: "short_volatility",
    label: "Volatility",
    description:
      "Magnitude of short-term price swings (combination of 1h and 24h change).",
    weight: 0.10,
  },
  {
    id: "market_pair_breadth",
    label: "Market Pair Breadth",
    description:
      "How broadly an asset is integrated across markets.",
    weight: 0.06,
  },
  {
    id: "supply_scarcity",
    label: "Supply Profile",
    description:
      "Ratio of circulating supply to max supply.",
    weight: 0.04,
  },
  {
    id: "maturity",
    label: "Listing Maturity",
    description:
      "How long the asset has been tracked by CoinMarketCap.",
    weight: 0.04,
  },
];

// Re-export CmcCryptocurrency so consumers don't have to reach into cmc/types.
export type { CmcCryptocurrency };
