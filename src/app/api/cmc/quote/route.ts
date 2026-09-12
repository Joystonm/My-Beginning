import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentDataSource,
  getQuotesLatest,
  getSeedInfo,
} from "@/lib/cmc/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing ?symbols=BTC,ETH" }, { status: 400 });
  }
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0 || symbols.length > 50) {
    return NextResponse.json(
      { error: "Provide between 1 and 50 symbols." },
      { status: 400 },
    );
  }
  try {
    const data = await getQuotesLatest(symbols);
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
