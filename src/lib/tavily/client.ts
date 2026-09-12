/**
 * Server-only Tavily client wrapper.
 *
 * Used by the ancestor engine to classify cryptocurrency kinds via
 * live web lookups. CMC's /info tag data is sparse for many large-cap
 * coins (e.g. SOL only carries "mineable" on CMC), so we cross-check
 * with Tavily to assign the correct kind bucket.
 *
 * - Never imported from client components.
 * - Caches responses in-memory with per-query TTL (kind classification
 *   is essentially immutable, so we cache aggressively).
 * - Never logs the API key.
 */

import "server-only";

import { tavily } from "@tavily/core";

const API_KEY = process.env.TAVILY_API_KEY ?? "";

export function isTavilyConfigured(): boolean {
  return Boolean(API_KEY);
}

// ---------------------------------------------------------------------------
// In-memory cache. Keys are query strings; values are the raw search
// response plus a TTL.
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — kind is immutable
const cache = new Map<string, CacheEntry<unknown>>();

function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data);
  }
  return fn().then((data) => {
    cache.set(key, { expiresAt: Date.now() + ttlMs, data });
    return data;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TavilySearchOptions {
  /** Max number of search results. */
  maxResults?: number;
  /** "basic" | "advanced" | "fast" | "ultra-fast". */
  searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast";
  /** "general" | "news" | "finance". */
  topic?: "general" | "news" | "finance";
  /** Restrict to these domains (recommended for crypto classification). */
  includeDomains?: string[];
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  rawContent?: string;
}

export interface TavilySearchResponse {
  answer?: string;
  query: string;
  results: TavilySearchResult[];
}

/**
 * Thin wrapper around `tavily.search()` with caching.
 *
 * Throws if TAVILY_API_KEY is not configured — callers should
 * `isTavilyConfigured()` first and provide a deterministic fallback.
 */
export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilySearchResponse> {
  if (!API_KEY) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Set it in .env.local to use Tavily search.",
    );
  }

  const cacheKey = JSON.stringify({ q: query, o: options });
  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const client = tavily({ apiKey: API_KEY });
    const response = await client.search(query, {
      maxResults: options.maxResults ?? 5,
      searchDepth: options.searchDepth ?? "basic",
      topic: options.topic ?? "general",
      includeDomains: options.includeDomains,
      includeAnswer: false,
    });
    return {
      answer: response.answer,
      query: response.query,
      results: (response.results ?? []).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        content: r.content ?? "",
        score: r.score,
        rawContent: r.rawContent,
      })),
    };
  });
}
