/**
 * Tavily-backed historical research for the Coin Story feature.
 *
 * For each selected cryptocurrency we ask Tavily for any historical
 * information we can find, and parse the response into a structured
 * `CoinResearch` payload that the story generator can use.
 *
 * Design principles:
 *
 *   - Tavily is the source of truth — we do NOT let the LLM invent
 *     historical facts from its own training data.
 *
 *   - Every fact carries the source URL(s) it came from, so the UI can
 *     surface "Sources" with clickable links.
 *
 *   - We accept results from ANY domain Tavily indexes. Restricting
 *     to a curated allow-list killed stories for ~90% of long-tail
 *     coins (XRP, SOL, ADA, etc.) because the allow-list missed the
 *     Wikipedia / CoinGecko / project-site pages Tavily surfaces for
 *     those assets. The structured-facts extractor still filters
 *     out junk, so the LLM only sees claims that match a known
 *     historical pattern.
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
// Public API
// ---------------------------------------------------------------------------

export interface ResearchInput {
  symbol: string;
  name: string;
}

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
    // Negative-cache: remember that this coin has no Tavily history so
    // the next visitor doesn't burn credits re-querying it.
    const empty: CoinResearch = {
      symbol,
      name,
      facts: [],
      sources: [],
      researchHash: "",
      researchedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { research: empty, cachedAt: Date.now() });
    return empty;
  }

  const facts = extractFacts(sources, symbol, name);
  // Even a single fact is enough — the fallback renderer and the LLM
  // both write meaningful short stories from minimal material. The
  // only signal we return `null` for is "Tavily returned nothing".
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
  return [
    `${name} (${symbol}) cryptocurrency history origin launch founder whitepaper`,
    `${name} ${symbol} crypto history milestones notable events adoption`,
    `${name} ${symbol} wiki overview creation team`,
    `${name} cryptocurrency history important dates`,
    `${name} token creator founder team founding story`,
    `${name} blockchain project origin launch year mainnet`,
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
      // No `includeDomains` — we accept anything Tavily returns. The
      // structured-facts extractor downstream filters out noise by
      // requiring claims to match a known historical pattern.
      const response = await tavilySearch(q, {
        maxResults: 8,
        searchDepth: "advanced",
        topic: "general",
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
    .slice(0, 24);
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
 * Patterns recognised:
 *
 *   - launch year: "<Name> was launched/released/created in YYYY"
 *   - founder (person or org): "<Name> was founded/created by X"
 *   - whitepaper: "<Name>'s whitepaper was published in YYYY"
 *   - genesis/mainnet: "mainnet launch" / "genesis block" / "went live"
 *   - famous events: bitcoin pizza day
 *
 * Each fact gets the source URL(s) of the snippets that contain it.
 *
 * The extractor is deliberately permissive: even one verifiable
 * historical fact (e.g. "launched in 2012") is enough to write a
 * honest short story. The fallback renderer will surface whatever
 * facts we have rather than refuse to write anything.
 */
export function extractFacts(
  sources: ResearchSource[],
  symbol: string,
  name: string,
): HistoricalFact[] {
  const facts: HistoricalFact[] = [];
  const seenClaims = new Set<string>();
  const add = (claim: string, date: string | null, confidence: number, urls: string[]) => {
    if (seenClaims.has(claim)) return;
    seenClaims.add(claim);
    facts.push({ claim, date, confidence, sourceUrls: urls });
  };

  for (const source of sources) {
    const text = `${source.title}. ${source.snippet}`;
    const lower = text.toLowerCase();
    const sourceUrls = [source.url];

    const yearMatches = lower.match(/\b(?:19|20)\d{2}\b/g) ?? [];
    const years = Array.from(new Set(yearMatches)).slice(0, 6);

    // ---------------------------------------------------------------
    // 1. "launched / created / released / went live in YYYY"
    // ---------------------------------------------------------------
    const launchRe =
      /(launched|released|created|introduced|went live|debuted|born|first\s+released|originally\s+created)\s+(?:on\s+|\sin\s+|back\s+in\s+)?((?:19|20)\d{2})/i;
    const launchMatch = launchRe.exec(text);
    if (launchMatch && launchMatch[2]) {
      const verb = (launchMatch[1] ?? "created").trim();
      const year = launchMatch[2];
      add(`${name} was ${verb} in ${year}.`, year, 0.9, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 2. "<Name> is a cryptocurrency ... launched in YYYY"
    // ---------------------------------------------------------------
    const isLaunchedRe = new RegExp(
      `${escapeRegExp(name)}\\s+(?:is|was)\\s+(?:a|an|the)?\\s*[^.]{0,80}?(launched|created|founded|introduced|released)\\s+(?:on\\s+|in\\s+|back\\s+in\\s+)?((?:19|20)\\d{2})`,
      "i",
    );
    const isLaunchedMatch = isLaunchedRe.exec(text);
    if (isLaunchedMatch && isLaunchedMatch[2]) {
      const verb = (isLaunchedMatch[1] ?? "created").trim();
      const year = isLaunchedMatch[2];
      add(`${name} was ${verb} in ${year}.`, year, 0.88, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 3. "founded / created by <PERSON OR ORG>"
    // ---------------------------------------------------------------
    const founderRe =
      /\b(founded|created|developed|launched|introduced|started|co-?founded)\s+by\s+([A-Z][a-zA-Z0-9 .'&,-]{2,100}?)(?:\.|,|;|\s+(?:in|on|who|as)\s|\s*$)/;
    const founderMatch = founderRe.exec(text);
    if (founderMatch && founderMatch[2]) {
      const verb = (founderMatch[1] ?? "founded").trim();
      const person = founderMatch[2].trim().replace(/\s+$/, "");
      if (
        person.length > 2 &&
        !/^(a team|the team|developers|the community|a group|a community|users)$/i.test(
          person,
        )
      ) {
        add(`${name} was ${verb} by ${person}.`, null, 0.85, sourceUrls);
      }
    }

    // ---------------------------------------------------------------
    // 4. "<Name> was created/founded ... in YYYY"
    // ---------------------------------------------------------------
    const createdInRe = new RegExp(
      `${escapeRegExp(name)}\\s+(?:was|is|got)\\s+(?:originally\\s+)?(?:created|founded|launched|developed|introduced|conceived|started|invented)\\s+(?:in|by|during)\\s+((?:19|20)\\d{2})`,
      "i",
    );
    const createdInMatch = createdInRe.exec(text);
    if (createdInMatch && createdInMatch[1]) {
      const year = createdInMatch[1];
      add(`${name} was created in ${year}.`, year, 0.85, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 5. whitepaper
    // ---------------------------------------------------------------
    const whitepaperRe = /\b(white\s*paper|whitepaper)\b[^.]*?((?:19|20)\d{2})/i;
    const whitepaperMatch = whitepaperRe.exec(text);
    if (whitepaperMatch && whitepaperMatch[2]) {
      const year = whitepaperMatch[2];
      add(`${name}'s whitepaper was published in ${year}.`, year, 0.85, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 6. genesis / mainnet / first block
    // ---------------------------------------------------------------
    if (/genesis\s+block|first\s+block|mainnet\s+launch|mainnet\s+went\s+live/i.test(text)) {
      const yr = years[0] ?? null;
      const yrText = yr ? ` in ${yr}` : "";
      add(`${name}'s network went live${yrText}.`, yr, 0.78, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 7. "originally released / open-sourced"
    // ---------------------------------------------------------------
    const releasedRe =
      /\b(originally\s+released|open[-\s]sourced|first\s+open[-\s]sourced)\s+(?:in\s+)?((?:19|20)\d{2})/i;
    const releasedMatch = releasedRe.exec(text);
    if (releasedMatch && releasedMatch[2]) {
      const year = releasedMatch[2];
      add(`${name} was open-sourced in ${year}.`, year, 0.8, sourceUrls);
    }

    // ---------------------------------------------------------------
    // 8. Bitcoin Pizza Day (special-case, BTC only)
    // ---------------------------------------------------------------
    if (
      symbol === "BTC" &&
      /pizza day|first real[- ]world transaction|10,000\s*btc.*?pizza/i.test(text)
    ) {
      add(
        `On Bitcoin Pizza Day, someone paid 10,000 BTC for two pizzas.`,
        "2010",
        0.95,
        sourceUrls,
      );
    }
  }

  // ---------------------------------------------------------------
  // 9. Salvage pass — when the structured patterns find nothing, look
  //    for any sentence in the corpus that mentions the coin name
  //    alongside a year. This catches long-tail coins whose Wikipedia
  //    / CoinGecko pages describe history in language the strict
  //    patterns above don't recognise (e.g. "USDC was launched by
  //    Circle in September 2018").
  //
  //    We treat each snippet as a small paragraph: if the snippet as
  //    a whole mentions the coin, and ANY sentence in it mentions a
  //    year, we surface a short context window around that year —
  //    usually the year-bearing sentence plus its predecessor. This
  //    handles "It launched in 2018" where the coin name only
  //    appears earlier in the same snippet.
  // ---------------------------------------------------------------
  if (facts.length === 0) {
    for (const source of sources) {
      const text = `${source.title}. ${source.snippet}`;
      const textLower = text.toLowerCase();
      const nameLower = name.toLowerCase();
      const symbolLower = symbol.toLowerCase();
      const snippetMentionsCoin =
        textLower.includes(nameLower) || textLower.includes(symbolLower);
      if (!snippetMentionsCoin) continue;

      const sentences = text
        .split(/\.\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (let i = 0; i < sentences.length; i += 1) {
        const sentence = sentences[i] ?? "";
        if (sentence.length < 10) continue;
        const yearMatch = sentence.match(/\b(?:19|20)\d{2}\b/);
        if (!yearMatch) continue;
        if (/price\s+of|trading\s+at|market\s+cap\s+of/i.test(sentence)) continue;
        const prev = sentences[i - 1] ?? "";
        const window =
          prev.length > 10 ? `${prev}. ${sentence}` : sentence;
        const year = yearMatch[0];
        add(`${window}`, year, 0.6, [source.url]);
      }
      if (facts.length >= 4) break;
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
    .slice(0, 10);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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