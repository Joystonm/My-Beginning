import { NextRequest, NextResponse } from "next/server";
import { getCoinStory } from "@/lib/stories";
import { isTavilyConfigured } from "@/lib/tavily/client";
import { isStoryGeneratorConfigured } from "@/lib/stories/generator";
import type { CmcCryptocurrency } from "@/lib/cmc/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface Body {
  symbol?: string;
  name?: string;
  id?: number;
  description?: string;
  tags?: string[];
  date_added?: string;
  forceRefresh?: boolean;
}

/**
 * POST /api/story
 *
 * Body: { symbol, name, id?, description?, tags?, date_added?, forceRefresh? }
 *
 * Returns the first-person Coin Story for the given asset. Fails open:
 * if Tavily or the LLM aren't configured, or both fail, a deterministic
 * fallback story is returned so the UI always has something to render.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const name = (body.name ?? "").trim() || symbol;
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format." }, { status: 400 });
  }

  // The CMC info we need isn't passed in the listings endpoint, so we
  // construct a minimal asset record. The orchestrator only uses these
  // fields when constructing the LLM prompt context.
  const baseAsset = {
    id: typeof body.id === "number" ? body.id : 0,
    symbol,
    name,
    description: body.description ?? null,
    tags: body.tags ?? null,
    date_added: body.date_added ?? null,
  } as Pick<CmcCryptocurrency, "id" | "symbol" | "name"> & {
    description?: string | null;
    tags?: string[] | null;
    date_added?: string | null;
  };

  try {
    const result = await getCoinStory({ baseAsset, forceRefresh: body.forceRefresh });
    return NextResponse.json({
      story: result.story,
      cached: result.cached,
      fallback: result.fallback,
      config: {
        tavily_configured: isTavilyConfigured(),
        llm_configured: isStoryGeneratorConfigured(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Story lookup failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}