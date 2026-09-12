/**
 * Supabase persistence layer for Coin Stories.
 *
 * Reads + writes are non-blocking — failures are logged and swallowed.
 * The orchestrator calls these in the background, so a transient DB
 * outage never breaks the story UI.
 *
 * All persistence is keyed by asset symbol. The schema is:
 *
 *   coin_stories(
 *     id, asset_symbol, title, hook, story_paragraphs,
 *     timeline, sources, research_hash, generated_at, updated_at
 *   )
 *
 *   coin_story_research(
 *     id, asset_symbol, facts, sources,
 *     research_hash, researched_at, updated_at
 *   )
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/config";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { CoinResearch, CoinStory } from "./types";

let adminClient: SupabaseClient | null | undefined;

function getAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getCachedStory(symbol: string): Promise<CoinStory | null> {
  const client = getAdmin();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("coin_stories")
      .select("*")
      .eq("asset_symbol", symbol.toUpperCase())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return rowToStory(data);
  } catch (err) {
    console.warn(
      `[story-persistence] read story failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function getCachedResearch(symbol: string): Promise<CoinResearch | null> {
  const client = getAdmin();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("coin_story_research")
      .select("*")
      .eq("asset_symbol", symbol.toUpperCase())
      .order("researched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return rowToResearch(data);
  } catch (err) {
    console.warn(
      `[story-persistence] read research failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function persistStory(symbol: string, story: CoinStory): Promise<void> {
  const client = getAdmin();
  if (!client) return;
  try {
    const payload = {
      asset_symbol: symbol.toUpperCase(),
      title: story.title,
      hook: story.hook,
      story_paragraphs: story.paragraphs,
      timeline: story.timeline,
      sources: story.sources,
      research_hash: story.researchHash,
      fallback: story.fallback,
      generated_at: story.generatedAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from("coin_stories")
      .upsert(payload, { onConflict: "asset_symbol" });
    if (error) {
      console.warn(`[story-persistence] persist story failed:`, error.message);
    }
  } catch (err) {
    console.warn(
      `[story-persistence] persist story crashed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function persistResearch(symbol: string, research: CoinResearch): Promise<void> {
  const client = getAdmin();
  if (!client) return;
  try {
    const payload = {
      asset_symbol: symbol.toUpperCase(),
      facts: research.facts,
      sources: research.sources,
      research_hash: research.researchHash,
      researched_at: research.researchedAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from("coin_story_research")
      .upsert(payload, { onConflict: "asset_symbol" });
    if (error) {
      console.warn(`[story-persistence] persist research failed:`, error.message);
    }
  } catch (err) {
    console.warn(
      `[story-persistence] persist research crashed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface StoryRow {
  asset_symbol: string;
  title: string;
  hook: string;
  story_paragraphs: string[];
  timeline: CoinStory["timeline"];
  sources: CoinStory["sources"];
  research_hash: string;
  fallback: boolean;
  generated_at: string;
  updated_at: string;
}

interface ResearchRow {
  asset_symbol: string;
  facts: CoinResearch["facts"];
  sources: CoinResearch["sources"];
  research_hash: string;
  researched_at: string;
}

function rowToStory(row: StoryRow): CoinStory {
  return {
    symbol: row.asset_symbol,
    name: row.title.replace(/^The Story of\s+/i, "") || row.asset_symbol,
    title: row.title,
    hook: row.hook,
    paragraphs: row.story_paragraphs ?? [],
    timeline: row.timeline ?? [],
    sources: row.sources ?? [],
    researchHash: row.research_hash ?? "",
    generatedAt: row.generated_at ?? row.updated_at ?? new Date().toISOString(),
    fallback: row.fallback ?? false,
  };
}

function rowToResearch(row: ResearchRow): CoinResearch {
  return {
    symbol: row.asset_symbol,
    name: row.asset_symbol,
    facts: row.facts ?? [],
    sources: row.sources ?? [],
    researchHash: row.research_hash ?? "",
    researchedAt: row.researched_at ?? new Date().toISOString(),
  };
}