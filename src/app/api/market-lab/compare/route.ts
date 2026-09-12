import { NextRequest, NextResponse } from "next/server";
import { getListingsLatest } from "@/lib/cmc/client";
import { isApiKeyConfigured } from "@/lib/cmc";

export const dynamic = "force-dynamic";

interface Body {
  symbols?: string[];
}

/**
 * Returns quotes for a list of symbols. The Market Lab compares
 * market_cap, volume, performance, volatility and pair breadth
 * using these quotes — all derived server-side from CMC.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const symbols = (body.symbols ?? [])
    .map((s) => s.toString().trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: "Provide at least one symbol." }, { status: 400 });
  }
  if (symbols.length > 10) {
    return NextResponse.json({ error: "Compare up to 10 assets at once." }, { status: 400 });
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      { error: "CMC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    const universe = await getListingsLatest({ limit: 250 });
    const map = new Map(universe.map((c) => [c.symbol.toUpperCase(), c]));
    const matched = symbols
      .map((s) => map.get(s))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const missing = symbols.filter((s) => !map.has(s));
    return NextResponse.json({ data: matched, missing });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CMC request failed." },
      { status: 502 },
    );
  }
}