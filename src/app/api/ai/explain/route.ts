/**
 * Optional AI explainer route.
 *
 * Accepts a single ancestor node from the lineage engine and either:
 *   1) Returns a deterministic narrative (always available), OR
 *   2) If ANTHROPIC_API_KEY is configured, calls Claude to refine
 *      the explanation using the SAME edge data.
 *
 * The source of truth is always the deterministic notes on the edge.
 * The model cannot invent lineage facts.
 */

import { NextRequest, NextResponse } from "next/server";
import { explainRelationship } from "@/lib/ai/explainer";
import type { AncestorNode } from "@/lib/ancestor/types";

interface Body {
  baseName: string;
  node: AncestorNode;
  /** "fast" (default) = deterministic, "refine" = use Anthropic if available. */
  mode?: "fast" | "refine";
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const base = body.baseName?.trim() ?? "";
  const node = body.node;
  if (!base || !node) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const narrative = explainRelationship(node, base);

  if (body.mode !== "refine" || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      narrative,
      source: "deterministic",
      model: null,
    });
  }

  // Optional Anthropic refinement.
  try {
    const refined = await refineWithAnthropic(narrative, base, node);
    return NextResponse.json({ narrative: refined, source: "anthropic", model: "claude-sonnet" });
  } catch (err) {
    return NextResponse.json({
      narrative,
      source: "deterministic",
      model: null,
      warning:
        err instanceof Error
          ? `AI refinement failed: ${err.message}`
          : "AI refinement failed.",
    });
  }
}

async function refineWithAnthropic(
  baseNarrative: string,
  baseName: string,
  node: AncestorNode,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return baseNarrative;

  const prompt = `You are refining an existing narrative explanation of an asset lineage edge that was already calculated deterministically. You may not invent lineage facts. Use the pre-calculated edge data verbatim.

Base asset: ${baseName}
Ancestor: ${node.name} (${node.symbol})
Relation: ${node.relation}
Confidence: ${Math.round(node.confidence * 100)}%
Source: ${node.source}
Edge notes: ${node.notes}

Existing narrative (rewrite in 1-2 sentences, keep the facts identical):
"""
${baseNarrative}
"""`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = json.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty model response");
  return text.trim();
}
