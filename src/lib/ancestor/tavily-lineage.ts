/**
 * Tavily-backed lineage enrichment.
 *
 * For coins that aren't in the curated ancestor graph, we ask Tavily
 * what the coin was forked from / descended from and parse the response
 * for ancestor mentions.
 *
 * The result is lower-confidence than curated edges — we deliberately
 * never let a Tavily edge be the primary signal for a top-100 coin.
 */

import "server-only";

import { isTavilyConfigured, tavilySearch } from "@/lib/tavily/client";
import type { AncestorEdge, RelationType } from "./types";

// ---------------------------------------------------------------------------
// Cache — coin lineage is essentially immutable, so we cache aggressively.
// ---------------------------------------------------------------------------

interface CachedEdges {
  edges: AncestorEdge[];
  cachedAt: number;
}

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const cache = new Map<string, CachedEdges>();

/** Test/debug hook — clear the in-memory Tavily lineage cache. */
export function clearTavilyLineageCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TRUSTED_DOMAINS = [
  "en.wikipedia.org",
  "coingecko.com",
  "coinmarketcap.com",
  "github.com",
  "crypto.com",
];

// Sanity cap on confidence for Tavily-derived edges. Even when Tavily
// surfaces a clear ancestor, we don't trust it as much as curated edges.
const MAX_TAVILY_CONFIDENCE = 0.85;

/**
 * The set of "parent" symbols we'll recognise as ancestors in Tavily
 * responses. Anything outside this list is ignored — we only ever want
 * to suggest major, well-known parent chains, not random CMC listings.
 */
const KNOWN_PARENT_SYMBOLS = new Set<string>(
  [
    "BTC", "ETH", "SOL", "BNB", "AVAX", "MATIC", "DOT", "ADA", "ATOM", "NEAR",
    "APT", "SUI", "FTM", "ALGO", "XTZ", "EGLD", "TRX", "LTC", "BCH", "BSV",
    "DOGE", "XMR", "ZEC", "DASH", "ETC", "CRO", "KAVA", "CELO", "GLMR",
    "ICP", "HBAR", "EOS", "FLOW", "KAS", "XLM", "XRP", "VET",
  ].map((s) => s.toUpperCase()),
);

const KNOWN_PARENT_NAMES: Record<string, string> = {
  BITCOIN: "BTC",
  ETHEREUM: "ETH",
  SOLANA: "SOL",
  "BINANCE CHAIN": "BNB",
  "BNB CHAIN": "BNB",
  "BINANCE SMART CHAIN": "BNB",
  BSC: "BNB",
  AVALANCHE: "AVAX",
  POLYGON: "MATIC",
  POLKADOT: "DOT",
  CARDANO: "ADA",
  COSMOS: "ATOM",
  "NEAR PROTOCOL": "NEAR",
  APTOS: "APT",
  SUI: "SUI",
  FANTOM: "FTM",
  ALGORAND: "ALGO",
  TEZOS: "XTZ",
  "MULTIVERSX": "EGLD",
  TRON: "TRX",
  LITECOIN: "LTC",
  "BITCOIN CASH": "BCH",
  "BITCOIN SV": "BSV",
  DOGECOIN: "DOGE",
  MONERO: "XMR",
  ZCASH: "ZEC",
  DASH: "DASH",
  "ETHEREUM CLASSIC": "ETC",
  "CRYPTO.ORG": "CRO",
  KAVA: "KAVA",
  CELO: "CELO",
  MOONBEAM: "GLMR",
  "INTERNET COMPUTER": "ICP",
  HEDERA: "HBAR",
  EOS: "EOS",
  FLOW: "FLOW",
  KASPA: "KAS",
  STELLAR: "XLM",
  RIPPLE: "XRP",
  VECHAIN: "VET",
};

const RELATION_HINTS: Array<{
  relation: RelationType;
  patterns: readonly RegExp[];
  confidence: number;
}> = [
  {
    relation: "fork",
    patterns: [
      /\bfork(?:ed|s|ing)?\b/i,
      /\bcode fork\b/i,
      /\bbitcoin fork\b/i,
      /\bethereum fork\b/i,
      /\bclone of\b/i,
    ],
    confidence: 0.9,
  },
  {
    relation: "platform",
    patterns: [
      /\berc-?20\b/i,
      /\bbep-?20\b/i,
      /\bspl token\b/i,
      /\bpolygon token\b/i,
      /\bavax token\b/i,
      /\bnative token of\b/i,
      /\bruns on\b/i,
      /\bdeployed on\b/i,
      /\bbuilt on top of\b/i,
    ],
    confidence: 0.95,
  },
  {
    relation: "wrapped",
    patterns: [
      /\bwrapped\b/i,
      /\bwbtc\b/i,
      /\bweth\b/i,
      /\bwbnb\b/i,
    ],
    confidence: 1.0,
  },
  {
    relation: "inspiration",
    patterns: [
      /\binspired by\b/i,
      /\bethereum (?:alternative|killer|competitor)\b/i,
      /\bbetter than ethereum\b/i,
      /\bfaster than ethereum\b/i,
      /\bcheaper than ethereum\b/i,
      /\bsuccessor to\b/i,
      /\bnext-?generation\b/i,
    ],
    confidence: 0.7,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TavilyLineageInput {
  symbol: string;
  name: string;
}

/**
 * Resolve Tavily-enriched ancestor edges for a single coin. Returns
 * zero or more edges (with lower confidence than curated edges).
 */
export async function fetchTavilyLineage(
  input: TavilyLineageInput,
): Promise<AncestorEdge[]> {
  if (!isTavilyConfigured()) return [];
  const symbol = input.symbol.toUpperCase();
  // Never query Tavily for BTC — it's the spiritual root of crypto and
  // Tavily returns nonsense ("BTC is a fork of BCH"). Curated graph
  // already has the correct BTC entries.
  if (symbol === "BTC") return [];
  const cacheKey = `${symbol}::${input.name.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.edges;
  }

  const edges = await queryTavily(input);
  cache.set(cacheKey, { edges, cachedAt: Date.now() });
  return edges;
}

/**
 * Batch version — fans out in parallel.
 */
export async function fetchTavilyLineageBatch(
  inputs: TavilyLineageInput[],
): Promise<Map<string, AncestorEdge[]>> {
  const out = new Map<string, AncestorEdge[]>();
  const promises = inputs.map(async (input) => {
    const edges = await fetchTavilyLineage(input);
    return { symbol: input.symbol.toUpperCase(), edges };
  });
  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    out.set(r.value.symbol, r.value.edges);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Query + parser
// ---------------------------------------------------------------------------

async function queryTavily(input: TavilyLineageInput): Promise<AncestorEdge[]> {
  const query = `${input.name} (${input.symbol}) cryptocurrency forked from descended from predecessor ancestor history`;
  let response;
  try {
    response = await tavilySearch(query, {
      maxResults: 4,
      searchDepth: "basic",
      includeDomains: TRUSTED_DOMAINS,
    });
  } catch (err) {
    console.warn(
      `[ancestor] Tavily lineage query failed for ${input.symbol}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }

  if (response.results.length === 0) return [];

  const corpus = response.results
    .map((r) => `${r.title}\n${r.content}\n${r.url}`)
    .join("\n\n");

  const detected = detectAncestors(corpus, input.symbol);

  const edges: AncestorEdge[] = [];
  for (const hit of detected) {
    edges.push({
      parent: hit.parent,
      child: input.symbol.toUpperCase(),
      direction: "ancestor",
      relation: hit.relation,
      confidence: Math.min(hit.confidence, MAX_TAVILY_CONFIDENCE),
      notes: hit.notes,
      source: "tavily",
    });
  }
  return edges;
}

interface DetectedAncestor {
  parent: string;
  relation: RelationType;
  confidence: number;
  notes: string;
}

function detectAncestors(
  corpus: string,
  childSymbol: string,
): DetectedAncestor[] {
  const lower = corpus.toLowerCase();
  const detected: DetectedAncestor[] = [];
  const seen = new Set<string>();

  // First pass: match KNOWN_PARENT_SYMBOLS as standalone tokens.
  // We use word boundaries to avoid matching e.g. "ADA" inside "Canada".
  for (const parent of KNOWN_PARENT_SYMBOLS) {
    const re = new RegExp(`\\b${parent.toLowerCase()}\\b`, "i");
    if (!re.test(lower)) continue;
    if (seen.has(parent)) continue;
    seen.add(parent);

    // Find the best relation hint near this parent mention.
    const hint = pickRelationHint(lower, parent);
    if (!hint) continue;

    // Confidence penalty for Tavily edges — they always lose to curated.
    const confidence = Math.max(0.3, hint.confidence - 0.1);

    detected.push({
      parent,
      relation: hint.relation,
      confidence,
      notes: `Tavily: ${inputNotes(hint.relation, parent, childSymbol)}`,
    });
  }

  // Second pass: KNOWN_PARENT_NAMES (e.g. "Ethereum" → ETH).
  for (const [name, symbol] of Object.entries(KNOWN_PARENT_NAMES)) {
    if (seen.has(symbol)) continue;
    const re = new RegExp(`\\b${name.toLowerCase()}\\b`, "i");
    if (!re.test(lower)) continue;
    seen.add(symbol);
    const hint = pickRelationHint(lower, name);
    if (!hint) continue;
    detected.push({
      parent: symbol,
      relation: hint.relation,
      confidence: Math.max(0.3, hint.confidence - 0.15),
      notes: `Tavily: ${inputNotes(hint.relation, name, childSymbol)}`,
    });
  }

  // Cap at one edge — multiple Tavily ancestors are usually noise.
  return detected.slice(0, 1);
}

function pickRelationHint(
  corpus: string,
  needle: string,
): { relation: RelationType; confidence: number } | null {
  let best: { relation: RelationType; confidence: number; at: number } | null = null;
  for (const hint of RELATION_HINTS) {
    for (const pattern of hint.patterns) {
      const m = pattern.exec(corpus);
      if (!m) continue;
      const at = m.index;
      // Prefer hints close to the parent mention.
      const parentAt = corpus.toLowerCase().indexOf(needle.toLowerCase());
      if (parentAt < 0) continue;
      const distance = Math.abs(parentAt - at);
      if (distance > 200) continue;
      if (!best || distance < best.at) {
        best = { relation: hint.relation, confidence: hint.confidence, at: distance };
      }
    }
  }
  if (!best) return null;
  return { relation: best.relation, confidence: best.confidence };
}

function inputNotes(
  relation: RelationType,
  parent: string,
  child: string,
): string {
  switch (relation) {
    case "fork":
      return `${child} appears to be a fork of ${parent}.`;
    case "platform":
      return `${child} appears to be a native token on ${parent}.`;
    case "wrapped":
      return `${child} appears to be a wrapped version of ${parent}.`;
    case "inspiration":
      return `${child} appears to have been inspired by ${parent}.`;
    case "conceptual":
      return `${child} appears to descend from ${parent} in the broader crypto lineage.`;
  }
}
