import { NextRequest, NextResponse } from "next/server";
import { computeLineageDrift } from "@/lib/ancestor/drift";
import { getCurrentDataSource, getListingsLatest } from "@/lib/cmc/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface Body {
  symbol?: string;
  limit?: number;
  windowDays?: number;
}

/**
 * Lineage drift API — the "what's moving in the family" headline.
 *
 * Given a base asset, walks its descendants in the curated ancestor
 * graph, fetches 30-day price history for each from CMC's
 * /v1/cryptocurrency/quotes/historical endpoint, and returns the
 * biggest movers plus the family-vs-base return delta.
 *
 * Used by:
 *   - /ancestor page (`LineageDriftCard`)
 *   - any future /compare surface
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format." }, { status: 400 });
  }

  const limit = clamp(body.limit ?? 250, 50, 500);
  const windowDays = clamp(body.windowDays ?? 30, 7, 90);

  let listings;
  try {
    listings = await getListingsLatest({ limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CMC request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const drift = await computeLineageDrift({
    baseSymbol: symbol,
    listings,
    windowDays,
  });

  if (!drift) {
    return NextResponse.json({
      base: symbol,
      drift: null,
      source: getCurrentDataSource(),
      message: `${symbol} has no descendants in the current universe.`,
    });
  }

  return NextResponse.json({
    base: symbol,
    drift,
    source: getCurrentDataSource(),
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
