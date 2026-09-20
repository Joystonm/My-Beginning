"use client";

import { cn } from "@/lib/utils";
import type { Insights } from "../lib/exploreFilters";
import { pct } from "../lib/exploreFilters";

interface Props {
  insights: Insights;
}

/**
 * 4-tile headline strip — the "look at this for 5 seconds and remember"
 * hook. Same visual pattern as LineageDriftCard.StatTile: bordered
 * cells, eyebrow label, large tnum value, 2xs subline.
 *
 *   - Median 24h change across the filtered set
 *   - Biggest gainer (name + %)
 *   - Biggest loser (name + %)
 *   - Gainers vs losers count
 *
 * Pure presentation — all computation lives in computeInsights().
 */
export function ExploreInsights({ insights }: Props) {
  if (insights.count === 0) {
    return (
      <div className="border border-line-subtle rounded-[6px] px-4 py-3 bg-canvas-sunken/30 text-sm text-ink-tertiary">
        No assets match the current filter.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile
        label="Median 24h change"
        value={pct(insights.median24h)}
        tone={toneFor(insights.median24h)}
        subline={`Across ${insights.count} ${insights.count === 1 ? "asset" : "assets"}`}
      />
      <StatTile
        label="Top gainer (24h)"
        value={
          insights.topGainer
            ? `+${insights.topGainer.pct.toFixed(2)}%`
            : "—"
        }
        tone="up"
        subline={
          insights.topGainer
            ? `${insights.topGainer.name} · ${insights.topGainer.symbol}`
            : "no gainers in the filter"
        }
      />
      <StatTile
        label="Top loser (24h)"
        value={
          insights.topLoser
            ? `${insights.topLoser.pct.toFixed(2)}%`
            : "—"
        }
        tone="down"
        subline={
          insights.topLoser
            ? `${insights.topLoser.name} · ${insights.topLoser.symbol}`
            : "no losers in the filter"
        }
      />
      <StatTile
        label="Up vs Down (24h)"
        value={`${insights.gainers} / ${insights.losers}`}
        tone={insights.gainers >= insights.losers ? "up" : "down"}
        subline={
          insights.gainers + insights.losers === 0
            ? "no 24h data"
            : `${Math.round(
                (insights.gainers /
                  Math.max(1, insights.gainers + insights.losers)) *
                  100,
              )}% green`
        }
      />
    </div>
  );
}

function toneFor(v: number | null): "up" | "down" | "neutral" {
  if (v === null || !Number.isFinite(v) || v === 0) return "neutral";
  return v > 0 ? "up" : "down";
}

function StatTile({
  label,
  value,
  tone,
  subline,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  subline: string;
}) {
  return (
    <div className="border border-line-subtle rounded-[6px] px-3 py-2.5 bg-canvas/50">
      <div className="text-2xs uppercase tracking-wide text-ink-tertiary">
        {label}
      </div>
      <div
        className={cn(
          "text-2xl font-medium tracking-tight mt-1 tnum",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
          tone === "neutral" && "text-ink-primary",
        )}
      >
        {value}
      </div>
      <div className="text-2xs text-ink-tertiary mt-0.5 truncate" title={subline}>
        {subline}
      </div>
    </div>
  );
}
