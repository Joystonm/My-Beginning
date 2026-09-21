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
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "";

/**
 * MiniMax tokens use the `sk-cp-` prefix. When we see one, the user has a
 * MiniMax plan even if they forgot to also set `ANTHROPIC_BASE_URL` —
 * auto-route to the MiniMax gateway in that case.
 */
function isMiniMax(): boolean {
  if (ANTHROPIC_BASE_URL.includes("minimax.io")) return true;
  if (ANTHROPIC_API_KEY.startsWith("sk-cp-")) return true;
  return false;
}

function effectiveBaseURL(): string {
  // The API key is the authoritative signal of provider. A `sk-cp-` key
  // is a MiniMax token and MUST be routed to the MiniMax gateway,
  // even if `ANTHROPIC_BASE_URL` happens to point somewhere else
  // (e.g. a shell-injected proxy URL like `https://api.gmi-serving.com`
  // that doesn't know about M3).
  if (ANTHROPIC_API_KEY.startsWith("sk-cp-")) {
    return "https://api.minimax.io/anthropic";
  }
  if (ANTHROPIC_BASE_URL) return ANTHROPIC_BASE_URL;
  return "";
}

function resolvedModel(): string {
  if (isMiniMax()) return "MiniMax-M3";
  return "claude-3-5-sonnet-latest";
}

export function isStoryGeneratorConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

/**
 * True when the active provider is MiniMax. The orchestrator uses this
 * to skip Tier 0 (the curated static archive) so every coin lookup
 * actually flows through M3 instead of returning a hand-written story.
 */
export function isMiniMaxStoryProvider(): boolean {
  return isMiniMax();
}

/** Exposed for logging / observability in API routes. */
export function activeStoryModel(): string {
  return isMiniMax() ? "MiniMax-M3 (via MiniMax)" : "claude-3-5-sonnet-latest";
}

// ---------------------------------------------------------------------------
// Anthropic client (lazy) — supports both real Anthropic and the MiniMax
// Anthropic-compatible gateway.
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!client) {
    const base = effectiveBaseURL();
    client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      ...(base ? { baseURL: base } : {}),
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// System prompts — the editorial brief
// ---------------------------------------------------------------------------

/**
 * Strict mode: research has facts. The LLM may ONLY use those facts.
 * This is the original "no fabrication" brief used when Tavily has
 * returned verifiable claims.
 */
const STORY_SYSTEM_PROMPT_RESEARCH = `You are writing the autobiography of a cryptocurrency.

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

/**
 * General-knowledge mode: research is empty (e.g. Tavily exhausted).
 * For major cryptocurrencies — the top 50 by market cap and well-known
 * historically-significant assets — well-documented public history is
 * widely known. The LLM may draw on that knowledge to write a real
 * story. For genuinely obscure assets it should still flag uncertainty.
 */
const STORY_SYSTEM_PROMPT_GENERAL = `You are writing the autobiography of a cryptocurrency.

The cryptocurrency itself is telling its story. Write in first person. Use "I", "me", and "my". Never break voice.

Tone: human, conversational, historical, curious, slightly cinematic, personal, easy to read.

Style rules:
- DO NOT use encyclopedia language ("Bitcoin is a decentralized digital currency…").
- DO start with a strong first-person introduction ("I am <Name>.").
- DO use short paragraphs (2–4 sentences each).
- DO end with where the asset stands today.
- DO write at least 3 paragraphs and ideally 4–6 if you have enough to say.

Source policy (this prompt is used when no web research is available):
- You MAY use widely-known, publicly documented facts about well-known cryptocurrencies — founding date, named creator(s) when publicly known, the year and reason for any rebrand, the major protocol milestones, exchanges where the asset is listed, and its general role in the crypto ecosystem.
- ONLY use facts you are highly confident about. If you are not sure of a specific date, name, or event, OMIT it rather than risk a wrong claim.
- For obscure or low-cap assets about which little is widely known, write a short, honest sketch noting the limited public history rather than fabricating details.
- NEVER invent prices, transaction amounts, specific quotes, partnership names, or private financial details.

Hard constraints (always):
- NEVER describe yourself as an AI.
- NEVER use generic crypto marketing language ("revolutionary", "disruptive", "next-generation", "paradigm shift").
- AVOID emoji, exclamation marks, and bullet lists in the story body.

Output format — return ONLY this JSON object, nothing else:

{
  "title": "The Story of <Name>",
  "hook": "<one-sentence opener, e.g. 'I am Bitcoin.'>",
  "paragraphs": ["...", "..."],
  "timeline": [{ "date": "YYYY", "label": "short caption", "paragraphIndex": 0 }],
  "fallback": false
}

If you cannot write even a short general-knowledge sketch for this asset (truly no widely-known history), return:

{
  "title": "The Story of <Name>",
  "hook": "I am <Name>.",
  "paragraphs": ["<one short paragraph explaining that no reliable public history could be surfaced>"],
  "timeline": [],
  "fallback": true
}

Timeline rules:
- Only include dates you are confident about.
- Each timeline point must reference the paragraphIndex of the paragraph it belongs to.
- If you cannot place 2 or more confident dates, return an empty timeline array.
`;

/**
 * Choose which prompt to use. With research, the strict brief is
 * mandatory (grounded facts only). Without research, allow the LLM
 * to draw on widely-known public history for major assets.
 */
function pickSystemPrompt(research: CoinResearch): string {
  if (research && research.facts && research.facts.length >= 1) {
    return STORY_SYSTEM_PROMPT_RESEARCH;
  }
  return STORY_SYSTEM_PROMPT_GENERAL;
}

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userMessage = buildUserPrompt(input);

  let raw: string;
  try {
    // Use raw `fetch` against the Messages API. The `@anthropic-ai/sdk`
    // sends `X-Stainless-*` telemetry headers and a `User-Agent` of
    // `Anthropic-TypeScript/...`, which the MiniMax gateway uses to
    // route requests — and that routing does NOT match the M3 model.
    // Bare `fetch` with the headers MiniMax expects works correctly.
    const baseURL = effectiveBaseURL() || "https://api.anthropic.com";
    const fullURL = `${baseURL}/v1/messages`;
    const res = await fetch(fullURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolvedModel(),
        max_tokens: 1400,
        system: pickSystemPrompt(input.research),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: userMessage }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    raw = (json.content ?? [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
  } catch (err) {
    console.warn(
      `[story-generator] LLM call failed for ${input.symbol}:`,
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
${factsList || "  (no facts could be verified — use widely-known public history instead, see system prompt)"}

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
 *
 * Even with a single verified fact (e.g. "XRP was launched in 2012")
 * we write a real short story rather than refusing — we just keep
 * the tone factual and avoid padding with invention.
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
      `I don't have a confident history written about me yet — the sources we found on the open web didn't surface a clean founding date, a named creator, or a verifiable origin story, and I'd rather say so than make one up.`,
    );
    paragraphs.push(
      `If you know the year I was created, the team behind me, or the paper that introduced me, the sources below are a starting point for writing it down.`,
    );
  } else {
    // Order facts chronologically where possible (oldest first).
    const datedFacts = knownFacts
      .filter((f): f is HistoricalFact & { date: string } => Boolean(f.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const undatedFacts = knownFacts.filter((f) => !f.date);

    if (datedFacts.length > 0) {
      const first = datedFacts[0]!;
      paragraphs.push(
        `My story begins in ${first.date}. ${stripTrailingPeriod(first.claim)}`,
      );
      for (const f of datedFacts.slice(1, 5)) {
        paragraphs.push(`In ${f.date}, ${lowerFirst(stripTrailingPeriod(f.claim))}.`);
      }
    }

    for (const f of undatedFacts.slice(0, 2)) {
      paragraphs.push(`${stripTrailingPeriod(f.claim)}.`);
    }

    // Soft close — only when we have at least one date-based fact.
    if (datedFacts.length > 0) {
      paragraphs.push(
        `Today I am known as ${sym}, and the rest of my story is still being written.`,
      );
    } else {
      paragraphs.push(
        `If you want to know more about ${sym}, the sources below collect what historians and journalists have written so far.`,
      );
    }
  }

  const datedForTimeline = facts
    .filter((f): f is HistoricalFact & { date: string } => Boolean(f.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const timeline: TimelinePoint[] = datedForTimeline.slice(0, 6).map((f, i) => ({
    date: f.date,
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

function stripTrailingPeriod(s: string): string {
  return s.replace(/\.+$/, "");
}

function lowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}