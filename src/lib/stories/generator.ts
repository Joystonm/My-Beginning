/**
 * Story generator — turns structured research into a first-person story.
 *
 * The LLM is the storyteller. The structured facts from `research.ts`
 * are its ONLY source of historical information. The LLM is explicitly
 * forbidden from inventing dates, founders, events, prices, transactions,
 * people, quotes, partnerships, or milestones.
 *
 * The LLM receives:
 *
 *   - selected asset name and symbol
 *   - CMC metadata
 *   - the structured facts (each with confidence + source URLs)
 *   - the raw research snippets (for context, not for inventing)
 *
 * The LLM returns a JSON object:
 *
 *   {
 *     title: "The Story of <Name>",
 *     hook:  "I am <Name>.",
 *     paragraphs: [string, string, ...],
 *     timeline: [{ date, label, paragraphIndex }],
 *     fallback: false
 *   }
 *
 * If the research is too thin to write a story, the LLM returns
 * `fallback: true` and a short one-paragraph sketch.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  CoinResearch,
  CoinStory,
  HistoricalFact,
  ResearchSource,
  TimelinePoint,
} from "./types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export function isStoryGeneratorConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

// ---------------------------------------------------------------------------
// Anthropic client (lazy)
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

// ---------------------------------------------------------------------------
// System prompt — the editorial brief
// ---------------------------------------------------------------------------

const STORY_SYSTEM_PROMPT = `You are writing the autobiography of a cryptocurrency.

The cryptocurrency itself is telling its story. Write in first person. Use "I", "me", and "my". Never break voice.

Tone: human, conversational, historical, curious, slightly cinematic, personal, easy to read.

Style rules:
- DO NOT use encyclopedia language ("Bitcoin is a decentralized digital currency…").
- DO start with a strong first-person introduction.
- DO use short paragraphs (2–4 sentences each).
- DO adapt the story length to the available evidence.
- DO end with where the asset stands today.

Hard constraints:
- ONLY use facts from the supplied research. Never invent dates, founders, events, prices, transactions, people, quotes, partnerships, or milestones.
- If a fact is uncertain or could not be established, OMIT it. Prefer omission to invention.
- NEVER describe yourself as an AI.
- NEVER use generic crypto marketing language ("revolutionary", "disruptive", "next-generation", "paradigm shift").
- AVOID emoji, exclamation marks, and bullet lists in the story body.

Structural target (adapt as needed; do not force every section):
1. Introduction (who you are)
2. Your birth / creation
3. Your early days
4. The first people who discovered you
5. Important moments
6. Famous stories (if any)
7. How you changed
8. Where you stand today

Output format — return ONLY this JSON object, nothing else:

{
  "title": "The Story of <Name>",
  "hook": "<one-sentence opener, e.g. 'I am Bitcoin.'>",
  "paragraphs": ["...", "..."],
  "timeline": [{ "date": "YYYY", "label": "short caption", "paragraphIndex": 0 }],
  "fallback": false
}

If the research is too thin to write a story, return:

{
  "title": "The Story of <Name>",
  "hook": "I am <Name>.",
  "paragraphs": ["<one short paragraph explaining that not enough reliable history could be verified>"],
  "timeline": [],
  "fallback": true
}

Timeline rules:
- Only include dates that are supported by the supplied facts.
- Each timeline point must reference the paragraphIndex of the paragraph it belongs to.
- If fewer than 2 verifiable dates exist, return an empty timeline array.
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StoryInput {
  symbol: string;
  name: string;
  research: CoinResearch;
  /** Optional CMC description / tags — purely contextual, not authoritative. */
  cmcContext?: {
    description?: string;
    tags?: string[];
    yearAdded?: number | null;
  };
}

/**
 * Generate a first-person story from structured research.
 *
 * Returns null if the story generator is not configured or the LLM
 * fails — callers should fall back to the deterministic explainer.
 */
export async function generateStory(input: StoryInput): Promise<CoinStory | null> {
  const client = getClient();
  if (!client) return null;

  const userMessage = buildUserPrompt(input);

  let raw: string;
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1400,
      system: STORY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    raw = text;
  } catch (err) {
    console.warn(
      `[story-generator] Anthropic call failed for ${input.symbol}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  return parseStoryResponse(raw, input, raw.length > 0);
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildUserPrompt(input: StoryInput): string {
  const { symbol, name, research, cmcContext } = input;
  const facts = research.facts;
  const sources = research.sources;

  const factsList = facts
    .map((f, i) => {
      const urls = f.sourceUrls.slice(0, 3).join(", ");
      return `  ${i + 1}. [confidence=${f.confidence.toFixed(2)}, year=${f.date ?? "—"}] ${f.claim}\n     Sources: ${urls}`;
    })
    .join("\n");

  const sourcesList = sources
    .slice(0, 8)
    .map((s, i) => `  ${i + 1}. [${s.domain}] ${s.title} — ${s.url}\n     "${s.snippet.slice(0, 240)}…"`)
    .join("\n");

  const cmcBlock = cmcContext
    ? `\nCMC metadata (context, NOT a source of historical claims):
  ${cmcContext.description ? `description: ${cmcContext.description.slice(0, 400)}` : "description: <none>"}
  ${cmcContext.tags?.length ? `tags: ${cmcContext.tags.join(", ")}` : "tags: <none>"}
  ${cmcContext.yearAdded ? `listed on CMC: ${cmcContext.yearAdded}` : ""}\n`
    : "";

  return `ASSET
  symbol: ${symbol}
  name: ${name}

VERIFIED HISTORICAL FACTS (each grounded in the sources below — only use these)
${factsList || "  (no facts could be verified — write the fallback sketch)"}

SUPPORTING SOURCES
${sourcesList || "  (none)"}
${cmcBlock}
Write the story now. Return ONLY the JSON object — no prose, no markdown.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseStoryResponse(
  raw: string,
  input: StoryInput,
  success: boolean,
): CoinStory | null {
  // The model may wrap the JSON in markdown fences. Strip them.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  // Find the first { and last } to be defensive.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // The LLM sometimes includes stray text. Try to recover.
    const m = /\{[\s\S]*\}/.exec(cleaned);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const paragraphs = Array.isArray(obj.paragraphs)
    ? obj.paragraphs
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map((p) => p.trim())
    : [];

  const timeline = Array.isArray(obj.timeline)
    ? obj.timeline
        .map((t): TimelinePoint | null => {
          if (!t || typeof t !== "object") return null;
          const item = t as Record<string, unknown>;
          if (typeof item.date !== "string") return null;
          if (typeof item.label !== "string") return null;
          const idx =
            typeof item.paragraphIndex === "number"
              ? Math.max(0, Math.min(item.paragraphIndex, paragraphs.length - 1))
              : 0;
          return { date: item.date, label: item.label, paragraphIndex: idx };
        })
        .filter((t): t is TimelinePoint => t !== null)
    : [];

  const title = typeof obj.title === "string" ? obj.title.trim() : `The Story of ${input.name}`;
  const hook = typeof obj.hook === "string" ? obj.hook.trim() : `I am ${input.name}.`;
  const fallback = obj.fallback === true;

  if (paragraphs.length === 0) {
    return null;
  }

  return {
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    title,
    hook,
    paragraphs,
    timeline,
    sources: input.research.sources,
    researchHash: input.research.researchHash,
    generatedAt: new Date().toISOString(),
    fallback,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

/**
 * A short deterministic "I am <Name>" fallback used when the LLM is not
 * configured or fails. It only uses facts the research layer verified, so
 * it's still honest about what we don't know.
 */
export function fallbackStory(
  symbol: string,
  name: string,
  facts: readonly HistoricalFact[],
  sources: readonly ResearchSource[],
): CoinStory {
  const sym = symbol.toUpperCase();
  const knownFacts = facts.filter((f) => f.confidence >= 0.7);
  const paragraphs: string[] = [];

  paragraphs.push(`I am ${name}.`);

  if (knownFacts.length === 0) {
    paragraphs.push(
      `I don't have reliable, verified history about myself yet — the curated sources we trust couldn't agree on enough details to tell my story without invention.`,
    );
  } else {
    const first = knownFacts[0]!;
    const rest = knownFacts.slice(1, 4);
    if (first.date) {
      paragraphs.push(`My story begins in ${first.date}. ${first.claim}`);
    } else {
      paragraphs.push(`${first.claim}`);
    }
    for (const f of rest) {
      paragraphs.push(
        f.date ? `In ${f.date}, ${f.claim.toLowerCase()}` : f.claim,
      );
    }
    paragraphs.push(
      `Today I am known as ${sym}, and the rest of my story is still being written.`,
    );
  }

  const timeline: TimelinePoint[] = knownFacts
    .filter((f) => f.date !== null)
    .slice(0, 5)
    .map((f, i) => ({
      date: f.date!,
      label: truncate(f.claim, 60),
      paragraphIndex: Math.min(i + 1, paragraphs.length - 1),
    }));

  return {
    symbol: sym,
    name,
    title: `The Story of ${name}`,
    hook: `I am ${name}.`,
    paragraphs,
    timeline,
    sources: sources.slice(0, 6),
    researchHash: "",
    generatedAt: new Date().toISOString(),
    fallback: true,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}