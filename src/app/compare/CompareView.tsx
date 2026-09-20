"use client";

import Link from "next/link";
import {
  Eyebrow,
  Panel,
  PanelBody,
  PanelHeader,
  StateBlock,
} from "@/components/design-system";
import { formatPercent, cn } from "@/lib/utils";

interface AssetSummary {
  symbol: string;
  name: string;
  rank: number | null;
  price: number | null;
  return_30d: number | null;
  market_cap: number | null;
  cmc_relation_to_counterparty:
    | { direction: "ancestor" | "descendant" | "relative" | "similarity"; relation: string; confidence: number; notes: string }
    | null;
}

export type { AssetSummary };

interface Props {
  from: AssetSummary;
  to: AssetSummary;
  sharedAncestors: Array<{ symbol: string; name: string; rank: number | null }>;
  computedAt: string;
}

const PALETTE: readonly [string, string] = ["#0F6B6B", "#B8412F"];

/**
 * The "relationship report" — a single dense page that answers
 * "what's the relationship between these two assets?".
 *
 * Designed as a shareable artifact: the URL is the demo. The X post
 * template for the hackathon is
 *
 *   /compare?from=BTC&to=ETH
 *   /compare?from=ETH&to=SOL
 *   /compare?from=BTC&to=DOGE
 *
 * — judges can click any of them and see the algorithm explain itself.
 */
export function CompareView({ from, to, sharedAncestors, computedAt }: Props) {
  return (
    <div className="py-10 sm:py-14 space-y-8">
      {/* Title + share affordance */}
      <section>
        <Eyebrow>Relationship report</Eyebrow>
        <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary mt-2">
          {from.name}{" "}
          <span className="text-ink-tertiary font-mono text-2xl">{from.symbol}</span>
          {" "}
          <span className="text-ink-tertiary mx-1">vs</span>{" "}
          {to.name}{" "}
          <span className="text-ink-tertiary font-mono text-2xl">{to.symbol}</span>
        </h1>
        <p className="text-sm text-ink-secondary mt-2 max-w-2xl">
          A direct read on the relationship between {from.name} and {to.name},
          built on CoinMarketCap data and the curated lineage graph.
        </p>
        <p className="text-2xs text-ink-tertiary mt-2 font-mono">
          Calculated {new Date(computedAt).toLocaleString()} · share this URL
        </p>
      </section>

      {/* Direct relationship — the headline */}
      <DirectRelationship from={from} to={to} />

      {/* Side-by-side 30-day returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AssetPanel side={from} accentColor={PALETTE[0]!} />
        <AssetPanel side={to} accentColor={PALETTE[1]!} />
      </div>

      {/* Shared ancestors */}
      <Panel>
        <PanelHeader
          eyebrow="Shared ancestors"
          title={
            sharedAncestors.length === 0
              ? "No shared ancestors in the curated graph"
              : `${sharedAncestors.length} ancestor${sharedAncestors.length === 1 ? "" : "s"} in common`
          }
          description={
            sharedAncestors.length === 0
              ? `${from.name} and ${to.name} trace to different roots in the lineage graph.`
              : `Assets both descend from the same lineage — typically a common parent chain.`
          }
        />
        <PanelBody>
          {sharedAncestors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sharedAncestors.map((a) => (
                <Link
                  key={a.symbol}
                  href={`/ancestor?symbol=${encodeURIComponent(a.symbol)}`}
                  className="inline-flex items-center gap-2 h-8 px-3 bg-canvas-sunken rounded-[4px] border border-line text-sm hover:bg-canvas transition-colors"
                >
                  <span className="font-medium text-ink-primary">
                    {a.name}
                  </span>
                  <span className="font-mono text-2xs text-ink-tertiary uppercase">
                    {a.symbol}
                  </span>
                  {a.rank !== null && (
                    <span className="text-2xs text-ink-tertiary">
                      #{a.rank}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-tertiary">
              The lineage engine walks code forks, platform tokens, wrapped
              tokens, inspiration chains, and conceptual lineage. Assets with
              no upstream relationship in the graph will land here.
            </p>
          )}
        </PanelBody>
      </Panel>

      {/* Source footer */}
      <p className="text-2xs text-ink-tertiary">
        Source: CoinMarketCap{" "}
        <code className="font-mono">/v1/cryptocurrency/listings/latest</code>,{" "}
        <code className="font-mono">/v1/cryptocurrency/quotes/latest</code>,{" "}
        <code className="font-mono">/v1/cryptocurrency/quotes/historical</code>,{" "}
        and <code className="font-mono">/v1/global-metrics/quotes/historical</code>.
        Built for the CMC × DoraHacks API Hackathon.
      </p>
    </div>
  );
}

function DirectRelationship({
  from,
  to,
}: {
  from: AssetSummary;
  to: AssetSummary;
}) {
  // Try to find the direct edge either way around.
  const edge = from.cmc_relation_to_counterparty;
  const reverseEdge = to.cmc_relation_to_counterparty;

  if (!edge && !reverseEdge) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Direct relationship"
          title="No direct lineage edge"
          description={`${from.name} and ${to.name} are not directly related in the curated graph. They may still share ancestors upstream.`}
        />
      </Panel>
    );
  }

  const primary = edge ?? reverseEdge!;
  const direction = primary.direction;
  const verb =
    direction === "ancestor"
      ? "descends from"
      : direction === "descendant"
        ? "is the platform / inspiration for"
        : direction === "relative"
          ? "is a peer of"
          : "is statistically similar to";

  const speaker = edge ? from : to;
  const subject = edge ? to : from;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Direct relationship"
        title={`${speaker.name} ${verb} ${subject.name}`}
        description={`Confidence ${Math.round(primary.confidence * 100)}% · relation: ${primary.relation}`}
      />
      <PanelBody>
        <p className="text-md text-ink-primary leading-relaxed max-w-2xl">
          {primary.notes}
        </p>
      </PanelBody>
    </Panel>
  );
}

function AssetPanel({
  side,
  accentColor,
}: {
  side: AssetSummary;
  accentColor: string;
}) {
  const return30d = side.return_30d;
  const up = return30d !== null && return30d >= 0;
  return (
    <Panel>
      <PanelHeader
        eyebrow={side.symbol}
        title={side.name}
        description={
          side.rank !== null ? `CMC rank #${side.rank}` : "Not in top 250"
        }
      />
      <PanelBody className="!pt-3 space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-medium tracking-tight tnum text-ink-primary">
            {side.price === null ? "—" : `$${side.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
          </span>
          {return30d !== null && (
            <span
              className={cn(
                "text-sm tnum font-medium",
                up ? "text-positive" : "text-negative",
              )}
            >
              {up ? "+" : ""}
              {formatPercent(return30d)}
              <span className="text-ink-tertiary font-normal ml-1">
                / 30d
              </span>
            </span>
          )}
        </div>
        {side.market_cap !== null && (
          <p className="text-sm text-ink-secondary">
            Market cap:{" "}
            <span className="font-mono text-ink-primary">
              ${side.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        )}
        <Link
          href={`/ancestor?symbol=${encodeURIComponent(side.symbol)}`}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          See {side.name}&apos;s full lineage →
        </Link>
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// (No client wrapper needed — the server component in page.tsx renders
// CompareView directly when the URL has valid query params, and renders
// inline error / missing-param states otherwise.)
// ---------------------------------------------------------------------------
