import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/guard";
import {
  getListingsLatest,
  getHistoricalQuotesForSymbols,
} from "@/lib/cmc/client";
import { findLineage } from "@/lib/ancestor/engine";
import { getEdgesByChild, getEdgesByParent } from "@/lib/ancestor/lineage";
import { shortRelationLabel, type RelationshipDirection } from "@/lib/ancestor/types";
import { CompareView, type AssetSummary } from "./CompareView";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "A direct relationship report between any two CoinMarketCap-tracked assets.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

/**
 * /compare — the shareable URL entry point.
 *
 *   /compare?from=BTC&to=ETH  → a single dense page explaining how the
 *                               two assets are related, in the curated
 *                               lineage graph and in the live CMC data.
 *
 * This is the demo video's central URL and the X post template. Judges
 * can click any variation and the algorithm explains itself.
 *
 * Auth: gated just like the rest of the app — `requireUser()` runs on
 * the server before any data fetch.
 */
export default async function ComparePage({ searchParams }: PageProps) {
  let nextPath = "/compare";
  try {
    const h = headers();
    const path =
      h.get("x-invoke-path") || h.get("x-pathname") || h.get("next-url");
    if (path) nextPath = path;
  } catch {
    /* headers() not available — use fallback */
  }

  await requireUser(nextPath);

  const from = (firstParam(searchParams?.from) ?? "").trim().toUpperCase();
  const to = (firstParam(searchParams?.to) ?? "").trim().toUpperCase();

  if (!from || !to) {
    return <CompareViewMissing />;
  }
  if (!/^[A-Z0-9]{1,12}$/.test(from) || !/^[A-Z0-9]{1,12}$/.test(to)) {
    return (
      <CompareViewError
        title="Invalid symbol"
        message={`"${from}" or "${to}" is not a valid CoinMarketCap symbol format.`}
      />
    );
  }
  if (from === to) {
    return (
      <CompareViewError
        title="Pick two different assets"
        message={`Choose two different symbols to compare. ${from} vs ${from} isn't useful.`}
      />
    );
  }

  // Fetch listings once.
  let listings;
  try {
    listings = await getListingsLatest({ limit: 250 });
  } catch (err) {
    return (
      <CompareViewError
        title="CoinMarketCap unavailable"
        message={
          err instanceof Error
            ? err.message
            : "Failed to fetch market data. Try again in a moment."
        }
      />
    );
  }

  const universe = new Map(listings.map((l) => [l.symbol.toUpperCase(), l]));
  const fromListing = universe.get(from);
  const toListing = universe.get(to);

  if (!fromListing || !toListing) {
    return (
      <CompareViewError
        title="One or both assets not in the top 250"
        message={`${!fromListing ? from : ""}${!fromListing && !toListing ? " and " : ""}${!toListing ? to : ""} ${!fromListing || !toListing ? "are" : "is"} not in the current top 250 by market cap. Try a different symbol.`}
      />
    );
  }

  // Compute lineage for both (sequential — they share the listings fetch).
  const fromLineage = await findLineage({ baseSymbol: from, listings });
  const toLineage = await findLineage({ baseSymbol: to, listings });

  // Fetch 30-day prices for both assets + the universe median.
  const histories = await getHistoricalQuotesForSymbols([from, to], {
    interval: "1d",
    count: 31,
  });

  function computeReturn30d(symbol: string): number | null {
    const h = histories.get(symbol);
    if (!h) return null;
    const points = h.quotes ?? [];
    if (points.length < 2) return null;
    const first = points[0]!.quote.USD.price;
    const last = points[points.length - 1]!.quote.USD.price;
    if (!Number.isFinite(first) || first <= 0) return null;
    if (!Number.isFinite(last) || last <= 0) return null;
    return ((last - first) / first) * 100;
  }

  // Find the direct relationship between the two, if any.
  // Check the curated graph: is `to` an ancestor of `from`, or vice versa?
  const fromAncestors = new Set((fromLineage?.lineage_chain ?? []).map((s) => s.toUpperCase()));
  const toAncestors = new Set((toLineage?.lineage_chain ?? []).map((s) => s.toUpperCase()));

  const fromDescendants = new Set(
    getEdgesByParent(from).map((e) => e.child.toUpperCase()),
  );
  const toDescendants = new Set(
    getEdgesByParent(to).map((e) => e.child.toUpperCase()),
  );

  function findDirectEdge(
    speaker: string,
    counterparty: string,
  ): {
    direction: RelationshipDirection;
    relation: string;
    confidence: number;
    notes: string;
  } | null {
    // Direct: speaker's child is counterparty, or speaker is counterparty's child.
    const fromSpeaker = getEdgesByParent(speaker).find(
      (e) => e.child.toUpperCase() === counterparty,
    );
    if (fromSpeaker) {
      return {
        direction: "ancestor",
        relation: shortRelationLabel(fromSpeaker.relation),
        confidence: fromSpeaker.confidence,
        notes: fromSpeaker.notes,
      };
    }
    const fromCounterparty = getEdgesByChild(speaker).find(
      (e) => e.parent.toUpperCase() === counterparty,
    );
    if (fromCounterparty) {
      return {
        direction: "descendant",
        relation: shortRelationLabel(fromCounterparty.relation),
        confidence: fromCounterparty.confidence,
        notes: fromCounterparty.notes,
      };
    }
    // Conceptual peer: check if both have BTC as conceptual ancestor and
    // the curated graph treats them as same-era peers.
    if (speaker !== "BTC" && counterparty !== "BTC") {
      const edges = [...getEdgesByChild(speaker), ...getEdgesByChild(counterparty)];
      const btcEdges = edges.filter((e) => e.parent.toUpperCase() === "BTC");
      if (btcEdges.length >= 2) {
        const first = btcEdges[0]!;
        return {
          direction: "relative",
          relation: "Spiritual descendant of the same origin",
          confidence: Math.min(...btcEdges.map((e) => e.confidence)),
          notes: `Both trace their conceptual lineage to Bitcoin (${first.relation}). They are same-era peers in the post-Bitcoin altcoin generation.`,
        };
      }
    }
    return null;
  }

  const fromToEdge = findDirectEdge(from, to);
  const toFromEdge = findDirectEdge(to, from);

  // Shared ancestors = intersection of lineage_chain.
  const sharedAncestorsList: Array<{ symbol: string; name: string; rank: number | null }> = [];
  for (const sym of fromAncestors) {
    if (toAncestors.has(sym)) {
      const listing = universe.get(sym);
      if (listing) {
        sharedAncestorsList.push({
          symbol: sym,
          name: listing.name,
          rank: listing.cmc_rank ?? null,
        });
      }
    }
  }
  // Sort by rank.
  sharedAncestorsList.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  const fromSummary: AssetSummary = {
    symbol: from,
    name: fromListing.name,
    rank: fromListing.cmc_rank ?? null,
    price: fromListing.quote?.USD?.price ?? null,
    market_cap: fromListing.quote?.USD?.market_cap ?? null,
    return_30d: computeReturn30d(from),
    cmc_relation_to_counterparty: fromToEdge,
  };
  const toSummary: AssetSummary = {
    symbol: to,
    name: toListing.name,
    rank: toListing.cmc_rank ?? null,
    price: toListing.quote?.USD?.price ?? null,
    market_cap: toListing.quote?.USD?.market_cap ?? null,
    return_30d: computeReturn30d(to),
    cmc_relation_to_counterparty: toFromEdge,
  };

  return (
    <CompareView
      from={fromSummary}
      to={toSummary}
      sharedAncestors={sharedAncestorsList}
      computedAt={new Date().toISOString()}
    />
  );
}

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// Inline error / empty states — kept server-rendered so they hydrate
// without a client-side round-trip.
function CompareViewError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="py-10 sm:py-14">
      <div className="border border-line rounded-[6px] p-8 max-w-2xl">
        <p className="heading-eyebrow mb-2">Compare</p>
        <h2 className="text-xl font-medium tracking-tight text-ink-primary">
          {title}
        </h2>
        <p className="text-sm text-ink-secondary mt-2">{message}</p>
      </div>
    </div>
  );
}

function CompareViewMissing() {
  return (
    <div className="py-10 sm:py-14">
      <div className="border border-line rounded-[6px] p-8 max-w-2xl">
        <p className="heading-eyebrow mb-2">Compare</p>
        <h2 className="text-xl font-medium tracking-tight text-ink-primary">
          Add ?from=BTC&to=ETH to the URL
        </h2>
        <p className="text-sm text-ink-secondary mt-2">
          This page expects two symbol query parameters. For example:
        </p>
        <pre className="mt-3 px-3 py-2 bg-canvas-sunken border border-line rounded-[4px] text-sm font-mono text-ink-primary">
          /compare?from=BTC&to=ETH
        </pre>
      </div>
    </div>
  );
}
