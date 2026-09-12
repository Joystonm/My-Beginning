"use client";

import Link from "next/link";
import { Badge, Panel } from "@/components/design-system";
import type { AncestorNode } from "@/lib/ancestor/types";
import { shortRelationLabel } from "@/lib/ancestor/types";
import { formatPercent, formatPrice, formatUsd } from "@/lib/utils";

interface Props {
  ancestor: AncestorNode;
  index: number;
  baseSymbol?: string;
  onDrillDown?: (symbol: string) => void;
}

/**
 * Lineage-first ancestor card.
 *
 * Each card describes one direct ancestor edge — what the relation is,
 * how strong we are in the claim, and the human-readable notes. Drops
 * the dimension-score machinery entirely: lineage is a categorical
 * claim, not a number.
 */
export function AncestorCard({ ancestor, index, baseSymbol, onDrillDown }: Props) {
  const q = ancestor.quote;
  const change = q?.percent_change_24h ?? 0;

  return (
    <Panel>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="heading-eyebrow">Ancestor {index + 1}</span>
              {ancestor.cmc_rank !== null && ancestor.cmc_rank !== undefined && (
                <Badge tone="muted" className="ml-1">
                  CMC #{ancestor.cmc_rank}
                </Badge>
              )}
              <Badge tone="accent" className="ml-1">
                {shortRelationLabel(ancestor.relation)}
              </Badge>
              <Badge
                tone={ancestor.source === "curated" ? "muted" : "positive"}
                className="ml-1"
              >
                {ancestor.source === "curated" ? "Curated" : "Tavily"}
              </Badge>
            </div>
            <div className="text-lg font-medium tracking-tight text-ink-primary truncate">
              {ancestor.name}
            </div>
            <div className="text-2xs uppercase tracking-[0.12em] text-ink-tertiary mt-1">
              {ancestor.symbol}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="heading-eyebrow">Confidence</div>
            <div className="text-3xl tnum tracking-tight text-ink-primary mt-1">
              {Math.round(ancestor.confidence * 100)}%
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">lineage claim</div>
          </div>
        </div>

        {/* Lineage note — the heart of the card */}
        <div className="mt-5 rounded-[4px] border border-line-subtle bg-canvas-sunken/40 p-4">
          <p className="text-2xs uppercase tracking-wider text-ink-tertiary mb-1.5">
            Why this is an ancestor
          </p>
          <p className="text-sm text-ink-primary leading-relaxed">
            {ancestor.notes}
          </p>
        </div>

        {/* Live market data — only shown if the ancestor is in the top-N universe */}
        {ancestor.inUniverse && q ? (
          <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm">
            <Field label="Price" value={formatPrice(q.price)} />
            <Field
              label="24h"
              value={
                <span className={change >= 0 ? "text-signal-positive" : "text-signal-negative"}>
                  {formatPercent(change)}
                </span>
              }
            />
            <Field
              label="Market cap"
              value={formatUsd(q.market_cap, { compact: true })}
            />
            <Field
              label="Volume 24h"
              value={formatUsd(q.volume_24h, { compact: true })}
            />
            <Field
              label="Turnover"
              value={
                q.market_cap
                  ? `${((q.volume_24h ?? 0) / q.market_cap * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </div>
        ) : (
          <div className="mt-5 text-xs text-ink-tertiary italic">
            Not in current top-{baseSymbol ? "N" : ""} universe · lineage claim
            remains in force even when the asset falls off the rankings.
          </div>
        )}

        <div className="mt-5 border-t border-line-subtle pt-4 flex items-center justify-between gap-4 flex-wrap">
          {baseSymbol ? (
            <Link
              href={`/lab?tab=compare&symbols=${encodeURIComponent(`${baseSymbol},${ancestor.symbol}`)}`}
              className="text-xs text-ink-secondary hover:text-ink-primary"
            >
              Compare in Lab →
            </Link>
          ) : (
            <span />
          )}
          {onDrillDown && (
            <button
              onClick={() => onDrillDown(ancestor.symbol)}
              className="text-sm text-accent hover:underline"
            >
              Find ancestors of {ancestor.symbol} →
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="heading-eyebrow">{label}</div>
      <div className="text-sm tnum text-ink-primary mt-1 truncate">{value}</div>
    </div>
  );
}
