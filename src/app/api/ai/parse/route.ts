/**
 * NL → structured query parser for Market Lab.
 * Deterministic. No LLM dependency. Works offline.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseLabQuery } from "@/lib/ai/parser";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Empty prompt." }, { status: 400 });
  }
  const parsed = parseLabQuery(prompt);
  return NextResponse.json({ parsed });
}