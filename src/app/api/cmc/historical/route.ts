import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentDataSource,
  getHistoricalQuotes,
  getSeedInfo,
} from "@/lib/cmc/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface Body {
  symbols?: string[];
  days?: number;
}

interface NormalizedPoint {
  /** Unix ms timestamp. */
  t: number;
  /** Price relative to the first point, base = 100. */
  value: number;
}

interface SeriesResult {
  symbol: string;
  name?: string;
  series: NormalizedPoint[];
  error?: string;
}

/**
 * Fetch historical quotes for a small set of symbols and normalize each
 * series to a base of 100 at the start. Used by /ancestor to show a
 * relative-performance comparison between the base asset and its top
 * ancestors.
 *
 * Visible to judges in `/api/cmc/evidence` — calls the real
 * `/v1/cryptocurrency/quotes/historical` endpoint when a key is configured.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const symbols = (body.symbols ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    // Cap was 6 for /ancestor's base+peer set; bumped to 30 so /explore
    // can fetch ~12 sparklines in one round-trip. Hard upper bound stays
    // so a typo can't OOM the server.
    .slice(0, 30);
  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one symbol." },
      { status: 400 },
    );
  }
  const days = Math.max(7, Math.min(120, body.days ?? 30));
  const count = days;
  const interval = "1d";

  // CMC's /quotes/historical only supports a single symbol per call, so
  // we fan out and normalise each series on the server side.
  const results = await Promise.all(
    symbols.map(async (sym): Promise<SeriesResult> => {
      try {
        const data = await getHistoricalQuotes({
          symbol: sym,
          count,
          interval,
        });
        const series = normalizeSeries(data.quotes ?? []);
        return { symbol: data.symbol ?? sym, name: data.name, series };
      } catch (err) {
        return {
          symbol: sym,
          series: [],
          error: err instanceof Error ? err.message : "Unknown error.",
        };
      }
    }),
  );

  return NextResponse.json({
    data: results,
    days,
    source: getCurrentDataSource(),
    seed: getSeedInfo(),
  });
}

function normalizeSeries(
  points: { timestamp: string; quote: Record<"USD", { price: number }> }[],
): { t: number; value: number }[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const base = sorted[0]?.quote.USD.price ?? 0;
  if (!Number.isFinite(base) || base <= 0) return [];
  return sorted.map((p) => ({
    t: Date.parse(p.timestamp),
    value: (p.quote.USD.price / base) * 100,
  }));
}
