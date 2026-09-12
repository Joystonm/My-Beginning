/**
 * Server-only CoinMarketCap API client.
 *
 * - Never imported from client components or middleware that runs on the edge.
 * - Caches responses in-memory with a per-endpoint TTL.
 * - Retries transient failures with exponential backoff and honors Retry-After.
 * - Records sanitized API call evidence (no API key) for the hackathon demo.
 *
 * CMC API docs:
 *   https://coinmarketcap.com/api/documentation/v1
 *
 * Endpoints used by this app:
 *   GET /v1/cryptocurrency/listings/latest
 *   GET /v1/cryptocurrency/quotes/latest
 *   GET /v1/cryptocurrency/info
 *   GET /v1/cryptocurrency/market-pairs/latest
 *   GET /v1/cryptocurrency/quotes/historical
 *   GET /v1/global-metrics/quotes/latest
 *   GET /v1/exchange/listings/latest
 */

import "server-only";

import {
  CmcApiError,
  type CmcCallRecord,
  type CmcCryptocurrency,
  type CmcEnvelope,
  type CmcExchange,
  type CmcGlobalMetrics,
  type CmcHistoricalQuotesResponse,
  type CmcInfoData,
  type CmcMarketPairsResponse,
} from "./types";
// Re-export historical point type for callers that still reference it.
export type { CmcHistoricalQuotePoint } from "./types";
import {
  getSeedGlobalMetrics,
  getSeedListings,
  getSeedQuotes,
  SEED_INFO,
} from "./seed";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.CMC_API_BASE_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://pro-api.coinmarketcap.com"
    : "https://pro-api.coinmarketcap.com");

const API_KEY = process.env.CMC_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Data source tracking — exposed to UI so the demo can clearly say
// "live CMC" vs "synthetic development seed".
// ---------------------------------------------------------------------------

export type CmcDataSource = "live" | "seed";

let lastSource: CmcDataSource = API_KEY ? "live" : "seed";

export function getCurrentDataSource(): CmcDataSource {
  return lastSource;
}

export function getSeedInfo(): typeof SEED_INFO {
  return SEED_INFO;
}

export function isApiKeyConfigured(): boolean {
  return Boolean(API_KEY);
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
  record: CmcCallRecord;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 90 * 1000; // 90s — hot listings refresh frequently
const LONG_TTL_MS = 5 * 60 * 1000; // 5m — info / exchange listings
const HISTORICAL_TTL_MS = 10 * 60 * 1000; // 10m — historical points

function ttlFor(endpoint: string): number {
  if (endpoint.includes("/info")) return LONG_TTL_MS;
  if (endpoint.includes("/exchange/")) return LONG_TTL_MS;
  if (endpoint.includes("/historical")) return HISTORICAL_TTL_MS;
  if (endpoint.includes("/global-metrics")) return DEFAULT_TTL_MS;
  return DEFAULT_TTL_MS;
}

// ---------------------------------------------------------------------------
// Evidence log — sanitized API call records for the hackathon demo.
// ---------------------------------------------------------------------------

const evidenceLog: CmcCallRecord[] = [];
const EVIDENCE_CAP = 200;

export function getCmcEvidence(): CmcCallRecord[] {
  return [...evidenceLog].reverse();
}

export function clearCmcEvidence(): void {
  evidenceLog.length = 0;
}

function recordCall(record: CmcCallRecord): void {
  evidenceLog.push(record);
  if (evidenceLog.length > EVIDENCE_CAP) {
    evidenceLog.splice(0, evidenceLog.length - EVIDENCE_CAP);
  }
}

// ---------------------------------------------------------------------------
// HTTP core
// ---------------------------------------------------------------------------

interface RequestOpts {
  endpoint: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  ttlMs?: number;
  /** Maximum number of retry attempts for retriable errors. */
  maxRetries?: number;
  /** Optional explicit cache key (otherwise derived from endpoint+params). */
  cacheKey?: string;
}

async function request<T>(opts: RequestOpts): Promise<T> {
  const { endpoint, params = {}, ttlMs, maxRetries = 2, cacheKey } = opts;

  const cleanedParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    cleanedParams[k] = String(v);
  }

  const key = cacheKey ?? `${endpoint}?${new URLSearchParams(cleanedParams).toString()}`;
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (!API_KEY) {
    // No live key configured → serve deterministic seed data so the entire
    // app remains usable in development. The seed is clearly labelled in
    // both the evidence log and the UI banner.
    lastSource = "seed";
    const seedData = buildSeedResponse<T>(endpoint, cleanedParams);
    recordCall({
      endpoint,
      method: "GET",
      params: cleanedParams,
      requestedAt: new Date().toISOString(),
      durationMs: 0,
      creditCount: 0,
      errorCode: 0,
      errorMessage: null,
      sample: summarizeSample(endpoint, seedData),
    });
    cache.set(key, {
      expiresAt: Date.now() + (ttlMs ?? ttlFor(endpoint)),
      data: seedData,
      record: {
        endpoint,
        method: "GET",
        params: cleanedParams,
        requestedAt: new Date().toISOString(),
        durationMs: 0,
        creditCount: 0,
        errorCode: 0,
        errorMessage: null,
        sample: summarizeSample(endpoint, seedData),
      },
    } as CacheEntry<unknown>);
    return seedData;
  }

  lastSource = "live";

  const url = `${BASE_URL}${endpoint}?${new URLSearchParams(cleanedParams).toString()}`;
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": API_KEY,
          "User-Agent": "who-is-my-ancestor/0.1 (+cmc-hackathon)",
        },
        // Next.js fetch caching — keep things off the static edge.
        cache: "no-store",
      });

      const text = await response.text();
      let parsed: CmcEnvelope<T> | null = null;
      try {
        parsed = text ? (JSON.parse(text) as CmcEnvelope<T>) : null;
      } catch {
        throw new CmcApiError({
          message: `CMC returned non-JSON body (status ${response.status}).`,
          status: response.status,
          errorCode: 0,
          endpoint,
          retriable: response.status >= 500,
        });
      }

      const durationMs = Date.now() - startedAt;

      // CMC-level error (status 200 but error_code !== 0)
      if (parsed?.status?.error_code !== undefined && parsed.status.error_code !== 0) {
        const retriable =
          parsed.status.error_code === 1008 || // rate limit
          parsed.status.error_code === 1005 || // timeout
          parsed.status.error_code === 1006;   // plan/credit

        const error = new CmcApiError({
          message: parsed.status.error_message ?? `CMC error ${parsed.status.error_code}`,
          status: response.status,
          errorCode: parsed.status.error_code,
          endpoint,
          retriable,
        });

        recordCall({
          endpoint,
          method: "GET",
          params: cleanedParams,
          requestedAt: new Date(startedAt).toISOString(),
          durationMs,
          creditCount: parsed.status.credit_count ?? null,
          errorCode: error.errorCode,
          errorMessage: error.message,
          sample: null,
        });

        if (retriable && attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          attempt += 1;
          lastError = error;
          continue;
        }
        throw error;
      }

      // HTTP-level error
      if (!response.ok) {
        const retriable = response.status === 429 || response.status >= 500;
        const error = new CmcApiError({
          message: `CMC HTTP ${response.status}: ${response.statusText || "error"}`,
          status: response.status,
          errorCode: response.status,
          endpoint,
          retriable,
        });

        recordCall({
          endpoint,
          method: "GET",
          params: cleanedParams,
          requestedAt: new Date(startedAt).toISOString(),
          durationMs,
          creditCount: null,
          errorCode: error.errorCode,
          errorMessage: error.message,
          sample: null,
        });

        if (retriable && attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          attempt += 1;
          lastError = error;
          continue;
        }
        throw error;
      }

      const data = parsed!.data;

      // Record sanitized evidence.
      recordCall({
        endpoint,
        method: "GET",
        params: cleanedParams,
        requestedAt: new Date(startedAt).toISOString(),
        durationMs,
        creditCount: parsed!.status.credit_count ?? null,
        errorCode: 0,
        errorMessage: null,
        sample: summarizeSample(endpoint, data),
      });

      const entry: CacheEntry<T> = {
        expiresAt: Date.now() + (ttlMs ?? ttlFor(endpoint)),
        data,
        record: {
          endpoint,
          method: "GET",
          params: cleanedParams,
          requestedAt: new Date(startedAt).toISOString(),
          durationMs,
          creditCount: parsed!.status.credit_count ?? null,
          errorCode: 0,
          errorMessage: null,
          sample: summarizeSample(endpoint, data),
        },
      };
      cache.set(key, entry as CacheEntry<unknown>);
      return data;
    } catch (err) {
      lastError = err;
      if (err instanceof CmcApiError && !err.retriable) throw err;
      if (attempt >= maxRetries) break;
      await sleep(backoffMs(attempt));
      attempt += 1;
    }
  }

  throw lastError instanceof CmcApiError
    ? lastError
    : new CmcApiError({
        message: "CMC request failed after retries.",
        status: 0,
        errorCode: 0,
        endpoint,
        retriable: false,
      });
}

function buildSeedResponse<T>(endpoint: string, params: Record<string, string>): T {
  if (endpoint.includes("/listings/latest")) {
    const limit = Math.max(1, Math.min(500, Number(params.limit ?? 100)));
    const start = Math.max(1, Number(params.start ?? 1));
    return getSeedListings({ limit, start }) as unknown as T;
  }
  if (endpoint.includes("/quotes/latest")) {
    const symbols = (params.symbol ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return getSeedQuotes(symbols) as unknown as T;
  }
  if (endpoint.includes("/global-metrics")) {
    return getSeedGlobalMetrics() as unknown as T;
  }
  // Endpoints without a seed equivalent → empty payloads so callers
  // can render graceful empty states instead of crashing.
  if (endpoint.includes("/info")) return {} as unknown as T;
  if (endpoint.includes("/market-pairs/latest")) {
    const symbol = (params.symbol ?? "").toUpperCase();
    return {
      id: 0,
      name: symbol,
      symbol,
      num_market_pairs: 0,
      market_pairs: [],
    } as unknown as T;
  }
  if (endpoint.includes("/historical")) return {} as unknown as T;
  if (endpoint.includes("/exchange/")) return [] as unknown as T;
  return [] as unknown as T;
}

function backoffMs(attempt: number): number {
  const base = 350 * Math.pow(2, attempt);
  return base + Math.floor(Math.random() * 120);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Sanitize API responses so they are safe to show to the user in the
 * "API Evidence" UI. Never include the API key.
 */
function summarizeSample(endpoint: string, data: unknown): unknown {
  if (!data) return null;
  try {
    if (endpoint.includes("/listings/latest")) {
      const arr = data as CmcCryptocurrency[];
      return arr.slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        cmc_rank: c.cmc_rank,
        quote: c.quote,
      }));
    }
    if (endpoint.includes("/quotes/latest")) {
      const arr = data as CmcCryptocurrency[];
      return arr.slice(0, 3).map((c) => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        quote: c.quote,
      }));
    }
    if (endpoint.includes("/info")) {
      const obj = data as Record<string, CmcInfoData>;
      const summary: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        summary[k] = {
          id: v.id,
          name: v.name,
          symbol: v.symbol,
          category: v.category,
          date_added: v.date_added,
          tags: v.tags,
          urls: v.urls ? Object.keys(v.urls) : undefined,
        };
      }
      return summary;
    }
    if (endpoint.includes("/market-pairs/latest")) {
      const obj = data as CmcMarketPairsResponse;
      return {
        id: obj.id,
        symbol: obj.symbol,
        num_market_pairs: obj.num_market_pairs,
        sample_pairs: obj.market_pairs.slice(0, 3).map((p) => ({
          market_pair: p.market_pair,
          exchange: p.exchange?.name,
          category: p.category,
          trust_score: p.trust_score,
        })),
      };
    }
    if (endpoint.includes("/historical")) {
      const obj = data as { symbol?: string; quotes?: { timestamp: string }[] };
      const points = obj.quotes ?? [];
      return {
        symbol: obj.symbol,
        count: points.length,
        first: points[0]?.timestamp,
        last: points[points.length - 1]?.timestamp,
      };
    }
    if (endpoint.includes("/exchange/")) {
      const arr = data as CmcExchange[];
      return arr.slice(0, 3).map((e) => ({
        id: e.id,
        name: e.name,
        num_market_pairs: e.num_market_pairs,
      }));
    }
    if (endpoint.includes("/global-metrics")) {
      return data as CmcGlobalMetrics;
    }
    return "OK";
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ListingsParams {
  start?: number;
  limit?: number;
  convert?: string;
  sort?: string;
  /** "all" returns full universe (paid tiers); "price" filters for priced assets. */
  priceMin?: number | null;
  priceMax?: number | null;
  marketCapMin?: number | null;
  marketCapMax?: number | null;
  /** Comma-separated tags, e.g. "layer-1,defi". */
  tags?: string;
}

export async function getListingsLatest(
  params: ListingsParams = {},
): Promise<CmcCryptocurrency[]> {
  const data = await request<CmcCryptocurrency[]>({
    endpoint: "/v1/cryptocurrency/listings/latest",
    params: {
      start: params.start ?? 1,
      limit: params.limit ?? 200,
      convert: params.convert ?? "USD",
      sort: params.sort ?? "market_cap",
      price_min: params.priceMin,
      price_max: params.priceMax,
      market_cap_min: params.marketCapMin,
      market_cap_max: params.marketCapMax,
      tags: params.tags,
    },
  });
  return data;
}

export async function getQuotesLatest(symbols: string[]): Promise<CmcCryptocurrency[]> {
  if (symbols.length === 0) return [];
  const data = await request<CmcCryptocurrency[]>({
    endpoint: "/v1/cryptocurrency/quotes/latest",
    params: { symbol: symbols.join(","), convert: "USD" },
    cacheKey: `/v1/cryptocurrency/quotes/latest?symbol=${[...symbols].sort().join(",")}`,
  });
  return data;
}

export async function getInfo(symbols: string[]): Promise<Record<string, CmcInfoData>> {
  if (symbols.length === 0) return {};
  const data = await request<Record<string, CmcInfoData>>({
    endpoint: "/v1/cryptocurrency/info",
    params: { symbol: symbols.join(",") },
    cacheKey: `/v1/cryptocurrency/info?symbol=${[...symbols].sort().join(",")}`,
  });
  return data;
}

export async function getMarketPairs(
  symbol: string,
  opts: { limit?: number } = {},
): Promise<CmcMarketPairsResponse> {
  const data = await request<CmcMarketPairsResponse>({
    endpoint: "/v1/cryptocurrency/market-pairs/latest",
    params: { symbol, limit: opts.limit ?? 50 },
  });
  return data;
}

export interface HistoricalParams {
  symbol: string;
  /** ISO timestamp or unix seconds. */
  timeStart?: string;
  /** ISO timestamp or unix seconds. */
  timeEnd?: string;
  /** "hourly" | "daily" — mapped to interval param below. */
  interval?: "1h" | "3h" | "6h" | "12h" | "1d" | "2d" | "3d" | "7d";
  count?: number;
  convert?: string;
}

export async function getHistoricalQuotes(
  params: HistoricalParams,
): Promise<CmcHistoricalQuotesResponse> {
  const interval = params.interval ?? "1d";
  const count = params.count ?? 60;
  const data = await request<CmcHistoricalQuotesResponse>({
    endpoint: "/v1/cryptocurrency/quotes/historical",
    params: {
      symbol: params.symbol,
      convert: params.convert ?? "USD",
      interval,
      count,
      time_start: params.timeStart,
      time_end: params.timeEnd,
    },
  });
  return data;
}

export async function getGlobalMetrics(): Promise<CmcGlobalMetrics> {
  const data = await request<CmcGlobalMetrics>({
    endpoint: "/v1/global-metrics/quotes/latest",
    params: { convert: "USD" },
  });
  return data;
}

export async function getExchangeListings(
  opts: { limit?: number } = {},
): Promise<CmcExchange[]> {
  const data = await request<CmcExchange[]>({
    endpoint: "/v1/exchange/listings/latest",
    params: { limit: opts.limit ?? 100 },
  });
  return data;
}

/**
 * Aggregate a universe of market data for the ancestor engine.
 * Returns a normalized snapshot suitable for similarity computation.
 */
export async function getMarketUniverse(opts: {
  limit?: number;
} = {}): Promise<{
  listings: CmcCryptocurrency[];
  global: CmcGlobalMetrics | null;
  exchanges: CmcExchange[];
}> {
  const [listings, global, exchanges] = await Promise.all([
    getListingsLatest({ limit: opts.limit ?? 250 }),
    getGlobalMetrics().catch(() => null),
    getExchangeListings({ limit: 50 }).catch(() => [] as CmcExchange[]),
  ]);
  return { listings, global, exchanges };
}