/**
 * Deterministic natural-language parser for Market Lab queries.
 *
 * This is NOT an LLM. It is a rule-based parser that converts a short
 * English phrase into a structured query the Data Explorer can run.
 *
 * The AI helper (when ANTHROPIC_API_KEY is configured) is layered on
 * top of this and uses the SAME structured output — it cannot invent
 * market facts.
 */

export type MetricKey =
  | "market_cap"
  | "volume_24h"
  | "turnover"
  | "percent_change_24h"
  | "percent_change_7d"
  | "percent_change_30d"
  | "num_market_pairs";

export type DatasetId = "top" | "gainers" | "losers";
export type Calculation = "raw" | "rank" | "percentile";

export interface ParsedQuery {
  dataset: DatasetId;
  top: number;
  metric: MetricKey;
  calculation: Calculation;
  description: string;
  matchedRules: string[];
}

const METRIC_KEYWORDS: Array<{ keywords: string[]; metric: MetricKey }> = [
  { keywords: ["market cap", "marketcap", "mcap", "cap"], metric: "market_cap" },
  { keywords: ["volume", "vol"], metric: "volume_24h" },
  { keywords: ["turnover", "vol/mc", "vol / mc", "volume to market"], metric: "turnover" },
  { keywords: ["30-day", "30d", "month", "1m"], metric: "percent_change_30d" },
  { keywords: ["7-day", "7d", "week"], metric: "percent_change_7d" },
  { keywords: ["24-hour", "24h", "today"], metric: "percent_change_24h" },
  { keywords: ["pairs", "markets", "pair"], metric: "num_market_pairs" },
];

const TOP_KEYWORDS: Array<{ pattern: RegExp; value: number }> = [
  { pattern: /top\s+(\d{1,3})/, value: 0 }, // dynamic
  { pattern: /\b(?:top\s+)?twenty\b/, value: 20 },
  { pattern: /\b(?:top\s+)?fifty\b/, value: 50 },
  { pattern: /\b(?:top\s+)?hundred\b/, value: 100 },
];

const DATASET_KEYWORDS: Array<{ keywords: string[]; dataset: DatasetId }> = [
  { keywords: ["gainer", "winning", "best performer", "top performer"], dataset: "gainers" },
  { keywords: ["loser", "decliner", "worst performer"], dataset: "losers" },
];

const CALC_KEYWORDS: Array<{ keywords: string[]; calc: Calculation }> = [
  { keywords: ["percentile", "percent"], calc: "percentile" },
  { keywords: ["rank", "ranking"], calc: "rank" },
];

export function parseLabQuery(input: string): ParsedQuery {
  const text = input.toLowerCase();
  const matched: string[] = [];

  let metric: MetricKey = "market_cap";
  for (const m of METRIC_KEYWORDS) {
    if (m.keywords.some((k) => text.includes(k))) {
      metric = m.metric;
      matched.push(`metric:${m.metric}`);
      break;
    }
  }

  let dataset: DatasetId = "top";
  for (const d of DATASET_KEYWORDS) {
    if (d.keywords.some((k) => text.includes(k))) {
      dataset = d.dataset;
      matched.push(`dataset:${d.dataset}`);
      break;
    }
  }

  let top = 20;
  for (const t of TOP_KEYWORDS) {
    const m = text.match(t.pattern);
    if (m) {
      if (t.value > 0) {
        top = t.value;
      } else if (m[1]) {
        top = clamp(parseInt(m[1], 10), 1, 250);
      }
      matched.push(`top:${top}`);
      break;
    }
  }

  let calculation: Calculation = "raw";
  for (const c of CALC_KEYWORDS) {
    if (c.keywords.some((k) => text.includes(k))) {
      calculation = c.calc;
      matched.push(`calc:${c.calc}`);
      break;
    }
  }

  const description = buildDescription({ dataset, top, metric, calc: calculation });
  return { dataset, top, metric, calculation, description, matchedRules: matched };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildDescription(q: {
  dataset: DatasetId;
  top: number;
  metric: MetricKey;
  calc: Calculation;
}): string {
  const datasetLabel =
    q.dataset === "top"
      ? "the top assets"
      : q.dataset === "gainers"
        ? "today's strongest performers"
        : "today's biggest decliners";
  const calcLabel =
    q.calc === "raw"
      ? "raw values"
      : q.calc === "rank"
        ? "ranked against the universe"
        : "as a percentile of the universe";
  const metricLabel = labelForMetric(q.metric);
  return `Showing ${q.top} ${datasetLabel}, ranked by ${metricLabel}, ${calcLabel}.`;
}

export function labelForMetric(m: MetricKey): string {
  switch (m) {
    case "market_cap":
      return "market cap";
    case "volume_24h":
      return "24-hour volume";
    case "turnover":
      return "turnover ratio";
    case "percent_change_24h":
      return "24-hour price change";
    case "percent_change_7d":
      return "7-day price change";
    case "percent_change_30d":
      return "30-day price change";
    case "num_market_pairs":
      return "market pair breadth";
  }
}