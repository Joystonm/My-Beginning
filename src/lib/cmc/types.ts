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

export interface CmcGlobalMetrics {
  active_cryptocurrencies: number;
  active_exchanges: number;
  active_market_pairs: number;
  total_volume_24h: number;
  total_volume_24h_reported: number;
  total_market_cap: number;
  total_market_cap_yesterday_percentage_change?: number;
  total_volume_24h_yesterday_percentage_change?: number;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd?: number;
  volume_change_percentage_24h_usd?: number;
  updated_at?: string;
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