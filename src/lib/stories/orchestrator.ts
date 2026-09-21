/**
 * Story orchestrator — the public API for getting a Coin Story.
 *
 * Pipeline (caching-first, expensive calls only on miss):
 *
 *   0. Look up the static archive (`static-stories.ts`). On hit, return
 *      a hand-curated `CoinStory` synchronously (modulo a small
 *      artificial delay so the UI still feels like it's making a
 *      network call) and skip every expensive step. The archive
 *      covers the top 20 coins by market cap — which absorbs the vast
 *      majority of search-as-you-type traffic.
 *   1. Look up cached story in Supabase. If hit → return it directly
 *      (zero Tavily calls, zero LLM calls, zero DB writes).
 *   2. Look up cached research in Supabase. If hit → reuse it instead
 *      of re-running Tavily.
 *   3. On a complete miss, run Tavily research + LLM story generation.
 *   4. Persist the result so the next visitor hits step 1.
 *
 * Negative caching:
 *
 *   - When Tavily returns nothing for a coin, we persist an empty
 *     `coin_story_research` row so subsequent visitors don't burn
 *     Tavily credits re-querying the same coin.
 *
 *   - When the LLM is unavailable but research exists, we persist the
 *     fallback story so subsequent visitors don't re-run the LLM.
 *
 *   - When we serve a static story, we also persist it. The static
 *     file is a one-time warm-up per coin; subsequent visitors (on any
 *     machine, signed in or out) hit step 1.
 *
 * The orchestrator NEVER throws — failures degrade gracefully.
 */

import "server-only";

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type { CoinStory, CoinResearch, ResearchSource } from "./types";
import { researchCoinHistory, clearStoryResearchCache } from "./research";
import {
  fallbackStory,
  generateStory,
  isMiniMaxStoryProvider,
  isStoryGeneratorConfigured,
} from "./generator";
import {
  getCachedStory,
  getCachedResearch,
  persistStory,
  persistResearch,
} from "./persistence";
import { getStaticStory } from "./static";

export interface GetStoryInput {
  baseAsset: Pick<CmcCryptocurrency, "id" | "symbol" | "name"> & {
    /** Optional CMC info fields for richer prompt context. */
    description?: string | null;
    tags?: string[] | null;
    date_added?: string | null;
  };
  /** When true, ignore any cached value and re-research. */
  forceRefresh?: boolean;
}

export interface StoryResult {
  story: CoinStory;
  /** True if this came from a cache rather than a fresh generation. */
  cached: boolean;
  /** True if Tavily or the LLM were unavailable and we used the fallback. */
  fallback: boolean;
  /**
   * Where the story came from on this call:
   *   - "static"        → served from the curated archive (top 20 coins)
   *   - "story-cache"  → served from `coin_stories`
   *   - "research-cache" → reused cached research, ran LLM
   *   - "fresh"        → ran Tavily + LLM
   *   - "fallback"     → neither LLM nor research produced anything
   */
  source: "static" | "story-cache" | "research-cache" | "fresh" | "fallback";
}

/**
 * Small artificial delay applied only to static-archive hits, so the
 * UI's loading skeleton still flashes briefly and the user perceives
 * it as a real fetch rather than a magic instant-load from a JSON
 * file. 120ms is short enough to feel snappy and long enough that the
 * skeleton has time to appear.
 */
const STATIC_FETCH_FEEL_MS = 120;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve the coin story for the given asset.
 *
 * Never throws. Always returns SOMETHING — at minimum a deterministic
 * "I am <Name>." fallback so the UI always has content to render.
 */
export async function getCoinStory(input: GetStoryInput): Promise<StoryResult> {
  const symbol = input.baseAsset.symbol.toUpperCase();
  const name = input.baseAsset.name;

  // 0. Static archive — fastest path. Top 20 coins resolve here with
  //    zero DB / Tavily / LLM work. We still apply a tiny artificial
  //    delay so the UI feels like it's making a network call, and we
  //    persist the result so the next visitor hits step 1.
  //
  //    Exception: when the MiniMax provider is active we always run
  //    the LLM. The static archive is a cost-saving shortcut for
  //    users without an LLM; if MiniMax is configured, every coin
  //    should exercise the M3 path so the story reflects whatever
  //    the user just asked for, not a hand-written archive entry.
  const skipStatic = isMiniMaxStoryProvider();
  if (!input.forceRefresh && !skipStatic) {
    const staticStory = getStaticStory(symbol);
    if (staticStory) {
      await sleep(STATIC_FETCH_FEEL_MS);
      // Persist asynchronously so subsequent visitors hit the Supabase
      // cache instead of the static file — this means a freshly-deployed
      // app on a new machine still warms up its cache for hot coins.
      void persistStory(symbol, staticStory);
      return {
        story: staticStory,
        cached: true,
        fallback: staticStory.fallback,
        source: "static",
      };
    }
  }

  // 1. Cache hit on the full story — fast path, no work to do.
  if (!input.forceRefresh) {
    const persisted = await getCachedStory(symbol);
    if (persisted) {
      return {
        story: persisted,
        cached: true,
        fallback: persisted.fallback,
        source: "story-cache",
      };
    }
  }

  // 2. Reuse cached research so we don't burn Tavily credits.
  let research = !input.forceRefresh
    ? await getCachedResearch(symbol)
    : null;
  const researchFromCache = Boolean(research);

  // 3. Only run Tavily when we have nothing to work with.
  if (!research) {
    try {
      research = await researchCoinHistory({ symbol, name });
    } catch (err) {
      console.warn(
        `[story-orchestrator] Tavily research failed for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
      research = null;
    }
  }

  // Persist whatever research we have (including empty results for
  // negative caching). This is what stops the next visitor for the
  // same long-tail coin from re-hitting Tavily.
  if (research) {
    void persistResearch(symbol, research);
  }

  // 4. Try the LLM when we have any research and a configured key.
  const cmcContext = {
    description: input.baseAsset.description ?? undefined,
    tags: input.baseAsset.tags ?? undefined,
    yearAdded: input.baseAsset.date_added
      ? new Date(input.baseAsset.date_added).getFullYear()
      : null,
  };

  let story: CoinStory | null = null;
  // LLM gating:
  //   - Default: only call the LLM when we have at least one verifiable
  //     fact from research. Empty research → deterministic fallback, to
  //     save LLM credits for long-tail coins.
  //   - When MiniMax is the active provider, ALWAYS run the LLM if it's
  //     configured — even if Tavily returned nothing or is unavailable.
  //     The user has paid for the model and wants to see its output on
  //     every coin. M3 will fall back to widely-known public facts for
  //     top coins when research is empty; for unknown coins it will
  //     still produce a short, honest "limited history" story.
  const hasFacts = Boolean(research && research.facts.length >= 1);
  const llmRequired = hasFacts || isMiniMaxStoryProvider();
  if (llmRequired && isStoryGeneratorConfigured() && research) {
    try {
      story = await generateStory({
        symbol,
        name,
        research,
        cmcContext,
      });
    } catch (err) {
      console.warn(
        `[story-orchestrator] Story generation failed for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 5. Fall back to the deterministic story if needed.
  if (!story) {
    story = fallbackStory(
      symbol,
      name,
      research?.facts ?? [],
      research?.sources ?? [],
    );
  }

  // 6. Persist the result so the next visitor is a cache hit.
  // We persist ALL outcomes now — including fallback stories — so a
  // long-tail coin visited twice doesn't re-run the LLM or Tavily.
  void persistStory(symbol, story);

  const source: StoryResult["source"] = researchFromCache
    ? "research-cache"
    : story.fallback
      ? "fallback"
      : "fresh";

  return {
    story,
    cached: false,
    fallback: story.fallback,
    source,
  };
}

// Re-export the public surface
export { clearStoryResearchCache } from "./research";
export { getStaticStory, getStaticStorySymbols, getStaticStoryCount } from "./static";
export type { CoinStory, CoinResearch, ResearchSource };
