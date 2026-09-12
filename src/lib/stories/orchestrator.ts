/**
 * Story orchestrator — the public API for getting a Coin Story.
 *
 * Pipeline:
 *
 *   1. Look up cached story in Supabase (if configured). Skip if cache
 *      miss.
 *   2. Look up cached research in Supabase (if configured).
 *   3. If neither, run Tavily research + LLM story generation.
 *   4. Persist the result to Supabase for the next visitor.
 *   5. Return the story — caller renders it. If anything fails, fall
 *      back to the deterministic explainer so the page never crashes.
 *
 * The orchestrator NEVER throws — failures degrade gracefully.
 */

import "server-only";

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type { CoinResearch, CoinStory, ResearchSource } from "./types";
import { researchCoinHistory, clearStoryResearchCache } from "./research";
import { fallbackStory, generateStory, isStoryGeneratorConfigured } from "./generator";
import {
  getCachedStory,
  getCachedResearch,
  persistStory,
  persistResearch,
} from "./persistence";

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
  /** True if this came from the cache rather than a fresh generation. */
  cached: boolean;
  /** True if Tavily or the LLM were unavailable and we used the fallback. */
  fallback: boolean;
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

  // 1. Check the persisted story cache.
  if (!input.forceRefresh) {
    const persisted = await getCachedStory(symbol);
    if (persisted) {
      return { story: persisted, cached: true, fallback: persisted.fallback };
    }
  }

  // 2. Check the persisted research cache.
  let research = !input.forceRefresh
    ? await getCachedResearch(symbol)
    : null;

  // 3. Run Tavily research if we don't have anything cached.
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

  // Persist whatever research we have so the next visitor is faster.
  if (research) {
    void persistResearch(symbol, research);
  }

  // 4. Generate the story.
  const cmcContext = {
    description: input.baseAsset.description ?? undefined,
    tags: input.baseAsset.tags ?? undefined,
    yearAdded: input.baseAsset.date_added
      ? new Date(input.baseAsset.date_added).getFullYear()
      : null,
  };

  let story: CoinStory | null = null;
  if (research && research.facts.length > 0 && isStoryGeneratorConfigured()) {
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

  // 6. Persist the story for the next visitor.
  if (!story.fallback || (research && research.facts.length > 0)) {
    void persistStory(symbol, story);
  }

  return {
    story,
    cached: false,
    fallback: story.fallback,
  };
}

// Re-export the public surface
export { clearStoryResearchCache } from "./research";
export type { CoinResearch, CoinStory, ResearchSource };