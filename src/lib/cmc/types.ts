/**
 * CoinMarketCap API response types.
 *
 * Subset of fields we actually consume. We deliberately do not
 * model the full response because some fields are tier-gated and
 * shape-shifting shapes is not a good idea.
 */

export interface CmcStatus {
  timestamp: string;
  error_code: number;
  error_message: string | null;
  elapsed: number;
  credit_count: number;
  notice: string | null;
}

export interface CmcUsdQuote {
  price: number;
  volume_24h: number;
  volume_change_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  percent_change_60d?: number;
  percent_change_90d?: number;
  percent_change_1y?: number;
  market_cap: number;
  market_cap_dominance?: number;
  fully_diluted_market_cap?: number;
  tvl_ratio?: number | null;
  last_updated: string;
}

export interface CmcCryptocurrency {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  num_market_pairs?: number;
  date_added?: string;
  tags?: string[];
  max_supply?: number | null;
  circulating_supply: number;
  total_supply?: number;
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
  cmc_rank?: number;
  last_updated?: string;
  quote: Record<"USD", CmcUsdQuote>;
}

export interface CmcInfoData {
  id: number;
  name: string;
  symbol: string;
  category: string;
  slug: string;
  logo?: string;
  description?: string;
  date_added?: string;
  notice?: string;
  tags?: string[];
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
  urls?: {
    website?: string[];
    twitter?: string[];
    message_board?: string[];
    chat?: string[];
    explorer?: string[];
    reddit?: string[];
    technical_doc?: string[];
    source_code?: string[];
    announcement?: string[];
  };
}

export interface CmcMarketPair {
  exchange: { id: number; name: string; slug: string };
  market_pair: string;
  market_pair_base: { currency_id: number; currency_symbol: string; currency_type: string };
  market_pair_quote: { currency_id: number; currency_symbol: string; currency_type: string };
  category: string;
  fee_type: string;
  outlier?: boolean;
  reported_volume_24h_share?: number;
  volume_24h?: number;
  price?: number;
  trust_score?: string;
}

export interface CmcMarketPairsResponse {
  id: number;
  name: string;
  symbol: string;
  num_market_pairs: number;
  market_pairs: CmcMarketPair[];
}

export interface CmcExchange {
  id: number;
  name: string;
  slug: string;
  num_market_pairs?: number;
  volume_24h?: number;
  market_share?: number;
}

/**
 * Global market metrics — shape returned by
 * `GET /v1/global-metrics/quotes/latest`.
 *
 * NOTE: The historical v3 docs and our internal type were modelled on
 * an older shape where `total_market_cap`, `total_volume_24h` and
 * `market_cap_percentage` lived at the top level of `data`. The
 * current CMC response nests the totals under `quote.USD` and exposes
 * dominance as flat `btc_dominance` / `eth_dominance` fields instead
 * of a `market_cap_percentage` map.
 *
 * Reference shape (from CMC Pro API docs):
 *
 * ```json
 * {
 *   "active_cryptocurrencies": 8176,
 *   "active_exchanges": 978,
 *   "active_market_pairs": 116587,
 *   "btc_dominance": 52.3,
 *   "eth_dominance": 17.8,
 *   "last_updated": "2026-09-12T...",
 *   "quote": {
 *     "USD": {
 *       "total_market_cap": 3500000000000,
 *       "total_volume_24h": 150000000000,
 *       "total_volume_24h_reported": 150000000000,
 *       "market_cap_change_percentage_24h_usd": 0.5
 *     }
 *   }
 * }
 * ```
 */
export interface CmcGlobalMetrics {
  active_cryptocurrencies: number;
  total_cryptocurrencies?: number;
  active_market_pairs: number;
  active_exchanges: number;
  total_exchanges?: number;
  /** Bitcoin dominance percentage (0..100). */
  btc_dominance: number;
  /** Ethereum dominance percentage (0..100). */
  eth_dominance: number;
  last_updated?: string;
  /**
   * Conversion-keyed totals. The historical endpoint exposes the same
   * shape per-point, so the historical quote-point type is a subset of
   * this.
   */
  quote: Record<
    "USD",
    {
      total_market_cap: number;
      total_volume_24h: number;
      total_volume_24h_reported: number;
      altcoin_volume_24h?: number;
      altcoin_volume_24h_reported?: number;
      altcoin_market_cap?: number;
      market_cap_change_percentage_24h_usd?: number;
      last_updated?: string;
    }
  >;
}

export interface CmcHistoricalQuotePoint {
  timestamp: string;
  quote: Record<"USD", {
    price: number;
    volume_24h?: number;
    market_cap?: number;
    percent_change_24h?: number;
  }>;
}

/**
 * Real CoinMarketCap shape for /v1/cryptocurrency/quotes/historical —
 * a single object keyed by symbol when one is requested, or an array of
 * such objects when several are requested via `symbol=A,B,C`.
 */
export interface CmcHistoricalQuotesResponse {
  id: number;
  name: string;
  symbol: string;
  is_active?: number;
  is_fiat?: number;
  quotes: CmcHistoricalQuotePoint[];
}

export interface CmcEnvelope<T> {
  status: CmcStatus;
  data: T;
}

/** A sanitized, safe-to-show API call record. */
export interface CmcCallRecord {
  endpoint: string;
  method: "GET";
  params: Record<string, string | number | boolean | null>;
  requestedAt: string;
  durationMs: number;
  creditCount: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  /** Truncated, tier-aware summary of the data (no API key, no internal fields). */
  sample: unknown;
}

export class CmcApiError extends Error {
  public readonly status: number;
  public readonly errorCode: number;
  public readonly endpoint: string;
  public readonly retriable: boolean;
  constructor(opts: {
    message: string;
    status: number;
    errorCode: number;
    endpoint: string;
    retriable: boolean;
  }) {
    super(opts.message);
    this.name = "CmcApiError";
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.endpoint = opts.endpoint;
    this.retriable = opts.retriable;
  }
}