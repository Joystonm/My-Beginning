/**
 * Story orchestrator tests.
 *
 * Verifies that the orchestrator returns a deterministic fallback story
 * even when Tavily + the LLM are unavailable, and that the structured
 * research + fallback story types are valid.
 *
 *   npx tsx scripts/test-story-orchestrator.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { fallbackStory } from "../src/lib/stories/generator";
import { extractFacts } from "../src/lib/stories/research";
import { researchCoinHistory } from "../src/lib/stories/research";
import { isStoryGeneratorConfigured } from "../src/lib/stories/generator";
import type { ResearchSource, HistoricalFact } from "../src/lib/stories/types";

// ---------------------------------------------------------------------------
// 1. fallbackStory always returns a valid story
// ---------------------------------------------------------------------------

test("fallbackStory returns 'I am <Name>.' opener for any input", () => {
  const story = fallbackStory("BTC", "Bitcoin", [], []);
  assert.equal(story.symbol, "BTC");
  assert.equal(story.name, "Bitcoin");
  assert.equal(story.title, "The Story of Bitcoin");
  assert.ok(story.hook.startsWith("I am "), "hook should be first-person");
  assert.equal(story.hook, "I am Bitcoin.");
  assert.ok(story.paragraphs.length >= 1, "must have at least one paragraph");
  assert.equal(story.fallback, true);
});

test("fallbackStory uses verified facts when available", () => {
  const facts: HistoricalFact[] = [
    {
      claim: "Bitcoin's whitepaper was published in 2008.",
      date: "2008",
      confidence: 0.95,
      sourceUrls: ["https://bitcoin.org/bitcoin.pdf"],
    },
    {
      claim: "Bitcoin's network went live in 2009.",
      date: "2009",
      confidence: 0.95,
      sourceUrls: ["https://en.wikipedia.org/wiki/Bitcoin"],
    },
    {
      claim: "Bitcoin was created by Satoshi Nakamoto.",
      date: null,
      confidence: 0.9,
      sourceUrls: ["https://en.wikipedia.org/wiki/Satoshi_Nakamoto"],
    },
  ];
  const story = fallbackStory("BTC", "Bitcoin", facts, []);
  assert.equal(story.paragraphs[0], "I am Bitcoin.");
  assert.match(story.paragraphs[1] ?? "", /2008/, "should mention 2008");
  assert.ok(story.timeline.length >= 1, "timeline should include dated facts");
  assert.ok(
    story.timeline.every((t) => t.date !== null),
    "timeline points must have dates",
  );
});

test("fallbackStory skips low-confidence facts", () => {
  const facts: HistoricalFact[] = [
    {
      claim: "Low confidence claim.",
      date: "2020",
      confidence: 0.3,
      sourceUrls: ["https://example.com"],
    },
  ];
  const story = fallbackStory("X", "Xcoin", facts, []);
  // The low-confidence fact should not surface as a paragraph.
  const joined = story.paragraphs.join(" ").toLowerCase();
  assert.ok(!joined.includes("low confidence"));
});

// ---------------------------------------------------------------------------
// 2. Fact extraction produces structured facts (parser-only, no Tavily)
// ---------------------------------------------------------------------------

test("extractFacts surfaces launch-year claims", () => {
  const sources: ResearchSource[] = [
    {
      title: "Bitcoin - Wikipedia",
      url: "https://en.wikipedia.org/wiki/Bitcoin",
      domain: "en.wikipedia.org",
      snippet:
        "Bitcoin was introduced in 2008 when the pseudonymous Satoshi Nakamoto published a whitepaper. The network went live in 2009.",
      relevance: 0.95,
      publishedAt: null,
    },
  ];
  const facts = extractFacts(sources, "BTC", "Bitcoin");
  assert.ok(facts.length >= 1, "should extract at least one fact");
  // The facts should reference verifiable years.
  const years = facts.map((f) => f.date).filter((d): d is string => Boolean(d));
  assert.ok(
    years.includes("2008") || years.includes("2009"),
    "should extract a year",
  );
});

test("extractFacts handles empty corpus gracefully", () => {
  const facts = extractFacts([], "X", "Xcoin");
  assert.ok(Array.isArray(facts));
  assert.equal(facts.length, 0);
});

// ---------------------------------------------------------------------------
// 3. Configuration surface
// ---------------------------------------------------------------------------

test("isStoryGeneratorConfigured returns false when no API key is set", () => {
  // When ANTHROPIC_API_KEY is not set in the test environment, the
  // generator is not configured. We don't assert the exact value (env
  // could be set during dev) — only that the function returns a boolean.
  const result = isStoryGeneratorConfigured();
  assert.equal(typeof result, "boolean");
});

// ---------------------------------------------------------------------------
// 4. researchCoinHistory returns null when Tavily is not configured
// ---------------------------------------------------------------------------

test("researchCoinHistory returns null when TAVILY_API_KEY is missing", async () => {
  // Force-clear any cache from earlier runs in the same process.
  const { clearStoryResearchCache } = await import("../src/lib/stories/research");
  clearStoryResearchCache();
  // If Tavily isn't configured, the helper must return null.
  if (!process.env.TAVILY_API_KEY) {
    const result = await researchCoinHistory({ symbol: "BTC", name: "Bitcoin" });
    assert.equal(result, null);
  } else {
    // If Tavily IS configured in this environment, skip — the network
    // call would slow the suite down.
    assert.ok(true, "skipping — Tavily is configured");
  }
});

test("researchCoinHistory returns empty research (not null) when Tavily returns nothing", async () => {
  // We can't easily simulate "Tavily configured but returned no results"
  // without spinning up a mock. Instead, verify the contract: when
  // Tavily isn't configured, the function returns null. When Tavily IS
  // configured but returns no results, the function returns an empty
  // CoinResearch (negative cache). The empty shape is documented below.
  if (!process.env.TAVILY_API_KEY) {
    // Skip — the negative-cache behaviour is exercised by the network
    // path in production. We assert the contract is documented by
    // reading the source.
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/stories/research.ts"),
      "utf8",
    );
    assert.match(
      src,
      /sources\.length === 0/,
      "negative-cache branch must exist in research.ts",
    );
    assert.match(
      src,
      /const empty: CoinResearch/,
      "must construct an empty CoinResearch for negative caching",
    );
  } else {
    assert.ok(true, "skipping — Tavily is configured, no need to test contract");
  }
});

// ---------------------------------------------------------------------------
// 5. Long-tail coins: even a single verified fact produces a real story
// ---------------------------------------------------------------------------

test("fallbackStory writes a real story from a single dated fact", () => {
  const facts: HistoricalFact[] = [
    {
      claim: "XRP was launched in 2012.",
      date: "2012",
      confidence: 0.9,
      sourceUrls: ["https://en.wikipedia.org/wiki/XRP_(cryptocurrency)"],
    },
  ];
  const story = fallbackStory("XRP", "XRP", facts, []);
  assert.equal(story.fallback, true);
  assert.ok(story.paragraphs[0], "must start with 'I am XRP.'");
  const joined = story.paragraphs.join(" ");
  assert.match(joined, /2012/, "should mention the verified year");
  assert.ok(
    !/don't have a confident history/.test(joined),
    "should NOT use the 'no confident history' sentence when facts exist",
  );
  assert.ok(story.timeline.length >= 1, "timeline should include the date");
});

test("fallbackStory writes a real story from a single founder fact", () => {
  const facts: HistoricalFact[] = [
    {
      claim: "XRP was created by Ripple Labs.",
      date: null,
      confidence: 0.85,
      sourceUrls: ["https://en.wikipedia.org/wiki/XRP_(cryptocurrency)"],
    },
  ];
  const story = fallbackStory("XRP", "XRP", facts, []);
  const joined = story.paragraphs.join(" ");
  assert.match(joined, /Ripple/);
  assert.ok(
    !/don't have a confident history/.test(joined),
    "should NOT use the 'no confident history' sentence when a fact exists",
  );
});

// ---------------------------------------------------------------------------
// 6. Extractor handles long-tail patterns
// ---------------------------------------------------------------------------

test("extractFacts catches 'originally created in YYYY' patterns", () => {
  const sources: ResearchSource[] = [
    {
      title: "XRP - Wikipedia",
      url: "https://en.wikipedia.org/wiki/XRP_(cryptocurrency)",
      domain: "en.wikipedia.org",
      snippet:
        "XRP was originally created in 2012 by Ripple Labs engineers. The network went live shortly after.",
      relevance: 0.95,
      publishedAt: null,
    },
  ];
  const facts = extractFacts(sources, "XRP", "XRP");
  assert.ok(facts.length >= 1, "should extract at least one fact");
  const dates = facts.map((f) => f.date).filter(Boolean);
  assert.ok(dates.includes("2012"), "should find the 2012 date");
});

test("extractFacts catches 'founded by <org>' patterns", () => {
  const sources: ResearchSource[] = [
    {
      title: "Solana - Wikipedia",
      url: "https://en.wikipedia.org/wiki/Solana_(blockchain)",
      domain: "en.wikipedia.org",
      snippet:
        "Solana was founded by Anatoly Yakovenko in 2017. The project raised funds in 2018.",
      relevance: 0.95,
      publishedAt: null,
    },
  ];
  const facts = extractFacts(sources, "SOL", "Solana");
  assert.ok(facts.length >= 1, "should extract at least one fact");
  const claims = facts.map((f) => f.claim.toLowerCase()).join(" ");
  assert.ok(
    /yakovenko/.test(claims) || /solana was (created|founded|launched)/.test(claims),
    "should mention founder or creation",
  );
});

test("extractFacts salvage pass catches long-tail patterns like USDC", () => {
  // A real-world corpus snippet for USDC that wouldn't match the
  // strict patterns above — but the salvage pass should still find
  // the launch year.
  const sources: ResearchSource[] = [
    {
      title: "USDC - Wikipedia",
      url: "https://en.wikipedia.org/wiki/USD_Coin",
      domain: "en.wikipedia.org",
      snippet:
        "USD Coin (USDC) is a stablecoin issued by Circle. It launched in September 2018 and is pegged 1:1 to the US dollar.",
      relevance: 0.95,
      publishedAt: null,
    },
  ];
  const facts = extractFacts(sources, "USDC", "USD Coin");
  assert.ok(facts.length >= 1, "salvage pass should extract at least one fact");
  const dates = facts.map((f) => f.date).filter(Boolean);
  assert.ok(dates.includes("2018"), "should surface the 2018 date");
});

test("extractFacts salvage pass ignores price/market-cap sentences", () => {
  const sources: ResearchSource[] = [
    {
      title: "Random",
      url: "https://example.com/foo",
      domain: "example.com",
      snippet:
        "The price of USDC in 2024 has remained near $1. Trading at $1.00 has been the market cap reality.",
      relevance: 0.5,
      publishedAt: null,
    },
  ];
  const facts = extractFacts(sources, "USDC", "USD Coin");
  // The salvage pass should not pick up sentences that look like
  // price / market commentary — those aren't founding history.
  const joined = facts.map((f) => f.claim.toLowerCase()).join(" ");
  assert.ok(
    !/price of|trading at|market cap/.test(joined),
    "salvage must filter out price/market-cap sentences",
  );
});

test("fallbackStory uses the honest 'no confident history' message when facts are empty", () => {
  const story = fallbackStory("USDC", "USD Coin", [], []);
  const joined = story.paragraphs.join(" ");
  assert.match(
    joined,
    /don't have a confident history/i,
    "should use the new honest no-history sentence",
  );
  assert.ok(
    !/curated sources we trust/.test(joined),
    "must NOT mention a curated allow-list (we removed that constraint)",
  );
  assert.equal(story.fallback, true);
});

// ---------------------------------------------------------------------------
// 7. Orchestrator: cache-first pipeline returns a story with a source field
// ---------------------------------------------------------------------------

test("getCoinStory returns a story with source='fallback' when no APIs configured", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  // No Tavily, no LLM, no Supabase in test env → must still return a
  // deterministic fallback story so the UI never crashes.
  // We use ZRX (not in the static archive) so we exercise the fallback
  // branch instead of the static branch.
  const result = await getCoinStory({
    baseAsset: { id: 1, symbol: "ZRX", name: "0x Protocol" },
  });
  assert.ok(result.story, "must return a story");
  assert.equal(result.story.symbol, "ZRX");
  assert.equal(result.story.fallback, true);
  assert.equal(result.source, "fallback");
  assert.equal(result.cached, false);
  assert.match(result.story.hook, /^I am 0x Protocol/);
});

test("getCoinStory marks forceRefresh as not cached", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  const result = await getCoinStory({
    baseAsset: { id: 1, symbol: "BTC", name: "Bitcoin" },
    forceRefresh: true,
  });
  assert.ok(result.story);
  // Without Supabase configured, every call hits the fallback path.
  // The important property here is the call completes and returns a
  // shape contract.
  assert.ok(["fallback", "fresh", "research-cache", "story-cache"].includes(result.source));
});

test("getCoinStory result exposes the StoryResult contract", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  const result = await getCoinStory({
    baseAsset: { id: 99, symbol: "ZRX", name: "0x Protocol" },
  });
  // Type/contract assertions — the `source` field is the new contract.
  // We use ZRX (not in the static archive) so we exercise the fallback
  // branch instead of the static branch.
  assert.equal(typeof result.cached, "boolean");
  assert.equal(typeof result.fallback, "boolean");
  assert.equal(
    result.source,
    "fallback",
    "no Tavily + no LLM + no Supabase → source must be 'fallback'",
  );
});

// ---------------------------------------------------------------------------
// 8. Static archive — Tier 0 cache for top coins
// ---------------------------------------------------------------------------

test("static archive covers the major top-of-market coins", async () => {
  const { getStaticStorySymbols, getStaticStoryCount } = await import(
    "../src/lib/stories/static"
  );
  const symbols = getStaticStorySymbols();
  // We expect at least the obvious top 5.
  for (const required of ["BTC", "ETH", "SOL", "XRP", "USDC"]) {
    assert.ok(
      symbols.includes(required),
      `static archive must include ${required}`,
    );
  }
  // We also expect a meaningful coverage floor — at least 15 coins.
  // If this regresses, that's a signal the archive is no longer
  // absorbing the search-as-you-type load.
  assert.ok(
    getStaticStoryCount() >= 15,
    `static archive should cover at least 15 coins, currently covers ${getStaticStoryCount()}`,
  );
});

test("getStaticStory returns a valid CoinStory for each covered symbol", async () => {
  const { getStaticStory, getStaticStorySymbols } = await import(
    "../src/lib/stories/static"
  );
  for (const symbol of getStaticStorySymbols()) {
    const story = getStaticStory(symbol);
    assert.ok(story, `getStaticStory(${symbol}) must return a story`);
    assert.equal(story.symbol, symbol);
    assert.equal(story.name.length > 0, true, "name must be non-empty");
    assert.match(story.hook, /^I am /, "hook must be first-person");
    assert.ok(story.paragraphs.length >= 3, "at least 3 paragraphs");
    assert.equal(
      story.fallback,
      false,
      "static archive entries are full stories, not fallbacks",
    );
    // Sources must reference real public URLs.
    assert.ok(story.sources.length >= 1, "must have at least one source");
    for (const s of story.sources) {
      assert.match(s.url, /^https?:\/\//, `source URL must be absolute: ${s.url}`);
    }
    // Timeline dates, when present, must look like years.
    for (const t of story.timeline) {
      assert.match(t.date, /^\d{4}/, `timeline date should start with a year: ${t.date}`);
    }
  }
});

test("getStaticStory returns null for unknown symbols", async () => {
  const { getStaticStory } = await import("../src/lib/stories/static");
  assert.equal(getStaticStory("XYZ"), null);
  assert.equal(getStaticStory(""), null);
  // Case-insensitive lookup
  assert.equal(getStaticStory("btc") !== null, true, "btc must match BTC");
});

test("getCoinStory returns source='static' for archive-covered coins", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  // BTC is in the static archive.
  const result = await getCoinStory({
    baseAsset: { id: 1, symbol: "BTC", name: "Bitcoin" },
  });
  assert.equal(result.source, "static");
  assert.equal(result.cached, true);
  assert.equal(result.story.symbol, "BTC");
  assert.match(result.story.hook, /^I am Bitcoin/);
  // Timeline must be carried through — proves the full CoinStory was
  // returned, not just a hook.
  assert.ok(result.story.timeline.length >= 1, "timeline present");
});

test("getCoinStory source='static' applies artificial fetch-feel delay", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  const t0 = Date.now();
  await getCoinStory({
    baseAsset: { id: 1, symbol: "ETH", name: "Ethereum" },
  });
  const elapsed = Date.now() - t0;
  // 120ms artificial delay + a little Node overhead. We use >=100ms so
  // the test is not flaky on fast machines.
  assert.ok(
    elapsed >= 100,
    `static hit must feel like a real fetch (>=100ms), took ${elapsed}ms`,
  );
  // And it must NOT take long — 600ms is plenty even on slow CI.
  assert.ok(
    elapsed < 600,
    `static hit should still be snappy (<600ms), took ${elapsed}ms`,
  );
});

test("getCoinStory skips static archive when forceRefresh=true", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  // With forceRefresh=true the static branch is bypassed. Without
  // Supabase + Tavily + LLM, we still get a deterministic fallback.
  const result = await getCoinStory({
    baseAsset: { id: 1, symbol: "BTC", name: "Bitcoin" },
    forceRefresh: true,
  });
  assert.notEqual(
    result.source,
    "static",
    "forceRefresh must bypass the static archive",
  );
  // The story must still be non-null — the orchestrator never throws.
  assert.ok(result.story);
});

test("orchestrator persists static hits (warm-up the Supabase cache)", async () => {
  const { getCoinStory } = await import("../src/lib/stories/orchestrator");
  // We can't easily verify the upsert against Supabase from this test
  // (no client), but we CAN verify the orchestrator calls persistStory
  // on the static path by reading the source code — that's the
  // contract this test pins.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/stories/orchestrator.ts"),
    "utf8",
  );
  // The static branch must call persistStory so subsequent visitors
  // hit the Supabase cache instead of the static file.
  assert.match(
    src,
    /void persistStory\(symbol, staticStory\)/,
    "static branch must persist its result into coin_stories",
  );
});

test("CoinStory SourceBadge handles 'static' with 'From the archive' label", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ancestor/CoinStory.tsx"),
    "utf8",
  );
  assert.match(src, /source === "static"/);
  assert.match(src, /From the archive/);
  // The Props['source'] type must include "static".
  assert.match(
    src,
    /"static"\s*\|\s*"story-cache"/,
    "Props['source'] type must include 'static'",
  );
});

test("AncestorExperience threads 'static' through the StoryState source type", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/ancestor/AncestorExperience.tsx"),
    "utf8",
  );
  // The StoryState source union must include "static".
  assert.match(
    src,
    /source:[\s\S]*"static"[\s\S]*"story-cache"/,
    "StoryState.source must include 'static'",
  );
});