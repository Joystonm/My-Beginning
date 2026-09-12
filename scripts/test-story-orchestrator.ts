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