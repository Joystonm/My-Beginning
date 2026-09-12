import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentDataSource,
  getListingsLatest,
  getSeedInfo,
} from "@/lib/cmc/client";

// Force dynamic so each request hits the latest CMC universe and we never
// accidentally serve a stale cached response after a Fast Refresh.
export const dynamic = "force-dynamic";
// Make sure Fast Refresh doesn't try to evaluate this at build time.
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const start = Number(req.nextUrl.searchParams.get("start") ?? "1");
  const limit = clamp(Number(req.nextUrl.searchParams.get("limit") ?? "100"), 1, 500);
  const sort = req.nextUrl.searchParams.get("sort") ?? "market_cap";
  const tags = req.nextUrl.searchParams.get("tags") ?? undefined;
  const priceMin = numberOrNull(req.nextUrl.searchParams.get("price_min"));
  const priceMax = numberOrNull(req.nextUrl.searchParams.get("price_max"));
  const marketCapMin = numberOrNull(req.nextUrl.searchParams.get("market_cap_min"));
  const marketCapMax = numberOrNull(req.nextUrl.searchParams.get("market_cap_max"));

  try {
    const data = await getListingsLatest({
      start,
      limit,
      sort,
      tags,
      priceMin,
      priceMax,
      marketCapMin,
      marketCapMax,
    });
    return NextResponse.json({
      data,
      source: getCurrentDataSource(),
      seed: getSeedInfo(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CMC request failed." },
      { status: 502 },
    );
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
