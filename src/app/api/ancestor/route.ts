import { NextRequest, NextResponse } from "next/server";
import { findLineage } from "@/lib/ancestor/engine";
import {
  getCurrentDataSource,
  getListingsLatest,
  getSeedInfo,
} from "@/lib/cmc/client";
import { isTavilyConfigured } from "@/lib/tavily/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface Body {
  symbol?: string;
  limit?: number;
}

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

  let listings;
  try {
    listings = await getListingsLatest({ limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CMC request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const calculation = await findLineage({
    baseSymbol: symbol,
    listings,
  });

  if (!calculation) {
    return NextResponse.json(
      {
        error: `Symbol ${symbol} was not found in the top ${limit} assets by market cap. Try another symbol.`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...calculation,
    source: getCurrentDataSource(),
    seed: getSeedInfo(),
    has_lineage_data:
      Boolean(calculation.ancestors.length > 0) ||
      Boolean(calculation.meta?.noAncestors),
    classifier: {
      tavily_configured: isTavilyConfigured(),
      curated_hits: calculation.meta?.curatedHits ?? 0,
      tavily_hits: calculation.meta?.tavilyHits ?? 0,
    },
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
