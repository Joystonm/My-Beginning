/**
 * Tavily-backed historical research for the Coin Story feature.
 *
 * For each selected cryptocurrency we ask Tavily for reliable historical
 * information, restrict to reputable domains, and parse the response into
 * a structured `CoinResearch` payload that the story generator can use.
 *
 * Design principles:
 *
 *   - Tavily is the source of truth — we do NOT let the LLM invent
 *     historical facts from its own training data.
 *
 *   - Every fact carries the source URL(s) it came from, so the UI can
 *     surface "Sources" with clickable links.
 *
 *   - When Tavily is unavailable or returns nothing, we surface a clean
 *     empty result — the story UI handles the fallback gracefully.
 *
 *   - Results are cached in-memory for 24h. Coins don't change history
 *     between page loads.
 */

import "server-only";

import {
  isTavilyConfigured,
  tavilySearch,
  type TavilySearchResult,
} from "@/lib/tavily/client";
import type { CoinResearch, HistoricalFact, ResearchSource } from "./types";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedResearch {
  research: CoinResearch;
  cachedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const cache = new Map<string, CachedResearch>();

/** Test/debug hook — clear the in-memory research cache. */
export function clearStoryResearchCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Trusted domains — sources we consider reliable for crypto history
// ---------------------------------------------------------------------------

const TRUSTED_HISTORY_DOMAINS = [
  "en.wikipedia.org",
  "bitcoin.org",
  "ethereum.org",
  "coingecko.com",
  "coinmarketcap.com",
  "crypto.com",
  "binance.org",
  "solana.com",
  "cardano.org",
  "ripple.com",
  "dogecoin.com",
  "litecoin.com",
  "messari.io",
  "cointelegraph.com",
  "coindesk.com",
  "decrypt.co",
  "theblock.co",
  "github.com",
  "whitepaper.com",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ResearchInput {
  symbol: string;
  name: string;
}

const RESEARCH_FACTS_NEEDED = 4; // minimum number of facts to call the result useful

/**
 * Fetch structured historical research for a coin via Tavily.
 *
 * Returns a `CoinResearch` with the facts we could verify from reliable
 * sources. The result is cached for 24h. Returns null if Tavily is not
 * configured OR if Tavily returned no usable facts.
 */
export async function researchCoinHistory(
  input: ResearchInput,
): Promise<CoinResearch | null> {
  const symbol = input.symbol.toUpperCase();
  const name = input.name;
  const cacheKey = `${symbol}::${name.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.research;
  }

  if (!isTavilyConfigured()) {
    return null;
  }

  const sources = await fetchHistoricalSources(symbol, name);
  if (sources.length === 0) {
    return null;
  }

  const facts = extractFacts(sources, symbol, name);
  if (facts.length < RESEARCH_FACTS_NEEDED) {
    // Not enough material to write a grounded story.
    return {
      symbol,
      name,
      facts,
      sources,
      researchHash: hashInputs(symbol, name, sources),
      researchedAt: new Date().toISOString(),
    };
  }

  const research: CoinResearch = {
    symbol,
    name,
    facts,
    sources,
    researchHash: hashInputs(symbol, name, sources),
    researchedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, { research, cachedAt: Date.now() });
  return research;
}

// ---------------------------------------------------------------------------
// Tavily queries
// ---------------------------------------------------------------------------

/**
 * Build the historical research query for a coin. Adapted per asset so
 * the model gets the most useful results.
 */
function buildQueries(symbol: string, name: string): string[] {
  const lowerName = name.toLowerCase();
  return [
    `${name} (${symbol}) cryptocurrency history creation launch important events whitepaper founder`,
    `${name} ${symbol} history milestones notable events early adoption`,
    `${name} ${symbol} famous stories historical moments notable incidents`,
  ];
}

async function fetchHistoricalSources(
  symbol: string,
  name: string,
): Promise<ResearchSource[]> {
  const queries = buildQueries(symbol, name);
  const all: ResearchSource[] = [];
  const seenUrls = new Set<string>();

  for (const q of queries) {
    try {
      const response = await tavilySearch(q, {
        maxResults: 5,
        searchDepth: "advanced",
        topic: "general",
        includeDomains: TRUSTED_HISTORY_DOMAINS,
      });
      for (const r of response.results ?? []) {
        const url = (r.url ?? "").trim();
        if (!url) continue;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        all.push(toResearchSource(r));
      }
    } catch (err) {
      console.warn(
        `[story-research] Tavily query failed for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
      // Continue with what we have.
    }
  }

  // Stable order by relevance desc, then URL.
  return all
    .sort((a, b) => (b.relevance - a.relevance) || a.url.localeCompare(b.url))
    .slice(0, 12);
}

function toResearchSource(r: TavilySearchResult): ResearchSource {
  const url = (r.url ?? "").trim();
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "";
  }
  return {
    title: (r.title ?? "").trim(),
    url,
    domain,
    snippet: (r.content ?? "").trim().slice(0, 400),
    relevance: typeof r.score === "number" ? r.score : 0.5,
    publishedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Fact extraction
// ---------------------------------------------------------------------------

/**
 * Extract a small set of structured historical facts from the corpus of
 * Tavily results.
 *
 * This is a deliberately conservative regex/heuristic extractor — the LLM
 * receives the structured facts and writes a story around them, never the
 * raw corpus. We avoid LLMs in this layer to keep the source-of-truth on
 * Tavily alone.
 *
 * Exported so the orchestrator's tests (and any future tooling) can
 * verify the extractor without spinning up Tavily.
 *
 * Patterns recognised:
 *
 *   - creation year: "<Name> was launched/released/created in YYYY"
 *   - founder: "<Name> was founded/created by X"
 *   - launch date: "<Name> launched on DATE / went live in YYYY"
 *   - early milestone: "first transaction / first block / genesis block"
 *   - famous events: "pizza day / hack / fork / upgrade"
 *
 * Each fact gets the source URL(s) of the snippets that contain it.
 */
export function extractFacts(
  sources: ResearchSource[],
  symbol: string,
  name: string,
): HistoricalFact[] {
  const facts: HistoricalFact[] = [];
  const seenClaims = new Set<string>();

  for (const source of sources) {
    const text = `${source.title} ${source.snippet}`;
    const lower = text.toLowerCase();
    const sourceUrls = [source.url];

    // Pattern 1: "<Name> was ... in <YYYY>"
    const yearMatch = lower.match(/\b(19|20)\d{2}\b/g);
    const years = Array.from(new Set(yearMatch ?? [])).slice(0, 3);

    // Pattern: "launched/released/created in YYYY"
    const launchRe =
      /(launched|released|created|introduced|went live|debuted)\s+(?:on\s+|\sin\s+)((?:19|20)\d{2})/i;
    const launchMatch = launchRe.exec(text);
    if (launchMatch && launchMatch[2]) {
      const year = launchMatch[2];
      const claim = `${name} was ${launchMatch[1]} in ${year}.`;
      if (!seenClaims.has(claim)) {
        seenClaims.add(claim);
        facts.push({
          claim,
          date: year,
          confidence: 0.9,
          sourceUrls,
        });
      }
    }

    // Pattern: "founded/created by <PERSON(S)>"
    const founderRe =
      /\b(founded|created|developed|launched|introduced|started)\s+by\s+([A-Z][a-zA-Z .'-]{2,80})(?:\.|,|;|\s+(?:in|on)\s)/;
    const founderMatch = founderRe.exec(text);
    if (founderMatch && founderMatch[2]) {
      const person = founderMatch[2].trim().replace(/\s+$/, "");
      // Filter out generic words that are unlikely to be names.
      if (
        person.length > 3 &&
        !/^(a team|the team|developers|the community|a group|a community)$/i.test(
          person,
        )
      ) {
        const claim = `${name} was ${founderMatch[1]} by ${person}.`;
        if (!seenClaims.has(claim)) {
          seenClaims.add(claim);
          facts.push({
            claim,
            date: null,
            confidence: 0.85,
            sourceUrls,
          });
        }
      }
    }

    // Pattern: "whitepaper"
    const whitepaperRe =
      /\b(white\s*paper|whitepaper)\b.*?((?:19|20)\d{2})/i;
    const whitepaperMatch = whitepaperRe.exec(text);
    if (whitepaperMatch && whitepaperMatch[2]) {
      const year = whitepaperMatch[2];
      const claim = `${name}'s whitepaper was published in ${year}.`;
      if (!seenClaims.has(claim)) {
        seenClaims.add(claim);
        facts.push({
          claim,
          date: year,
          confidence: 0.85,
          sourceUrls,
        });
      }
    }

    // Pattern: "genesis block" / "first block" / "mainnet"
    if (/genesis block|first block|mainnet\s+launch/i.test(text)) {
      const yearsList = years.length > 0 ? ` in ${years[0]}` : "";
      const claim = `${name}'s network went live${yearsList}.`;
      if (!seenClaims.has(claim)) {
        seenClaims.add(claim);
        facts.push({
          claim,
          date: years[0] ?? null,
          confidence: 0.75,
          sourceUrls,
        });
      }
    }

    // Pattern: notable events
    if (
      /pizza day|first real[- ]world transaction|10,000\s*btc.*?pizza/i.test(
        text,
      ) &&
      symbol === "BTC"
    ) {
      const claim = `On Bitcoin Pizza Day, someone paid 10,000 BTC for two pizzas.`;
      if (!seenClaims.has(claim)) {
        seenClaims.add(claim);
        facts.push({
          claim,
          date: "2010",
          confidence: 0.95,
          sourceUrls,
        });
      }
    }
  }

  // Sort facts by confidence desc, then by date ascending (oldest first).
  return facts
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    })
    .slice(0, 8);
}

function hashInputs(
  symbol: string,
  name: string,
  sources: ResearchSource[],
): string {
  // Lightweight deterministic hash of the research inputs.
  const input = JSON.stringify({
    s: symbol,
    n: name,
    src: sources.map((s) => s.url).slice(0, 8),
  });
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}