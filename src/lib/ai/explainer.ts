/**
 * Deterministic narrative generator for lineage explanations.
 *
 * The lineage engine's "why is this an ancestor?" question has a
 * different shape than the old similarity engine's "why are these
 * similar?". This module turns an `AncestorNode` into a 1–2 sentence
 * editorial explanation that's always available (no LLM required).
 *
 * The optional /api/ai/explain route layers Anthropic on top for
 * a refined rewrite, but the source of truth is always the
 * deterministic notes on the edge.
 */

import type { AncestorNode } from "@/lib/ancestor/types";
import { shortRelationLabel } from "@/lib/ancestor/types";

export function explainRelationship(
  node: AncestorNode,
  baseName: string,
): string {
  const verb = shortRelationLabel(node.relation).toLowerCase();
  const confidence = `${Math.round(node.confidence * 100)}%`;

  const source =
    node.source === "curated"
      ? "curated ancestor graph"
      : "Tavily web lookup";

  return `${baseName} is ${verb} ${node.name} (${node.symbol}) — ${confidence} confidence, drawn from our ${source}. ${node.notes}`;
}
