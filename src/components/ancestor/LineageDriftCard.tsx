"use client";

import { Badge, Panel, PanelBody, PanelHeader } from "@/components/design-system";
import { cn, formatPercent } from "@/lib/utils";
import { shortRelationLabel } from "@/lib/ancestor/types";
import type { LineageDrift } from "@/lib/ancestor/drift";

interface Props {
  drift: LineageDrift | null;
  loading?: boolean;
  error?: string | null;
  onSelectSymbol?: (symbol: string) => void;
}

/**
 * "What's moving in the family" — the newsworthy headline of the page.
 *
 * Renders the lineage drift computed by /api/ancestor/drift:
 *
 *   - the strongest and weakest descendant over the window,
 *   - the median family return,
 *   - the family-vs-base delta (positive = family outperformed base),
 *   - a compact bar list of every evaluated descendant, sorted by the
 *     magnitude of its move.
 *
 * The bar list is the screenshot bait: one glance, you can see exactly
 * which members of the family are hot and which are fading.
 */
export function LineageDriftCard({
  drift,
  loading = false,
  error = null,
  onSelectSymbol,
}: Props) {
  if (loading) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Lineage drift"
          title="Computing family moves…"
          description="Fetching 30-day price history for each descendant from CMC /quotes/historical."
        />
        <PanelBody>
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-canvas-sunken rounded w-2/3" />
            <div className="h-4 bg-canvas-sunken rounded w-1/2" />
            <div className="h-4 bg-canvas-sunken rounded w-3/5" />
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Lineage drift"
          title="Could not compute drift"
          description={error}
        />
      </Panel>
    );
  }

  if (!drift) {
    return (
      <Panel>
        <PanelHeader
          eyebrow="Lineage drift"
          title="No descendants in the current universe"
          description="This base asset has no first-degree descendants in the top 100 by market cap."
        />
      </Panel>
    );
  }

  const { entries, biggest_gainer, biggest_loser } = drift;
  const familyMedian = drift.family_median_return_pct;
  const baseReturn = drift.base_return_pct;
  const marketReturn = drift.market_return_pct;
  const delta = drift.family_vs_base_delta_pct;
  const vsMarket = drift.family_vs_market_delta_pct;
  const headline = headlineSentence(drift);

  return (
    <Panel>
      <PanelHeader
        eyebrow={`Lineage drift · last ${drift.window_days} days`}
        title={headline.title}
        description={headline.description}
      />
      <PanelBody className="!pt-3 space-y-5">
        {/* Top stat strip — three numbers judges can quote in the pitch */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Family median"
            value={
              familyMedian === null ? "—" : formatPercent(familyMedian)
            }
            tone={familyMedian !== null && familyMedian >= 0 ? "up" : "down"}
            subline={`${drift.evaluated_size} of ${drift.family_size} evaluated`}
          />
          <StatTile
            label={`${drift.base} return`}
            value={baseReturn === null ? "—" : formatPercent(baseReturn)}
            tone={baseReturn !== null && baseReturn >= 0 ? "up" : "down"}
            subline={`over ${drift.window_days}d`}
          />
          <StatTile
            label="Family vs base"
            value={delta === null ? "—" : formatPercent(delta)}
            tone={
              delta === null
                ? "neutral"
                : delta >= 0
                  ? "up"
                  : "down"
            }
            subline={
              delta !== null
                ? delta >= 0
                  ? "family outperformed"
                  : "family underperformed"
                : "—"
            }
          />
          <StatTile
            label="Family vs market"
            value={vsMarket === null ? "—" : formatPercent(vsMarket)}
            tone={
              vsMarket === null
                ? "neutral"
                : vsMarket >= 0
                  ? "up"
                  : "down"
            }
            subline={
              marketReturn === null
                ? "market data unavailable"
                : vsMarket !== null
                  ? `market ${formatPercent(marketReturn)} over ${drift.window_days}d`
                  : "—"
            }
          />
        </div>

        {/* Biggest movers — the "wow" line */}
        {(biggest_gainer || biggest_loser) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {biggest_gainer && (
              <MoverTile
                kind="gainer"
                entry={biggest_gainer}
                onSelect={onSelectSymbol}
              />
            )}
            {biggest_loser && (
              <MoverTile
                kind="loser"
                entry={biggest_loser}
                onSelect={onSelectSymbol}
              />
            )}
          </div>
        )}

        {/* Compact bar list — every evaluated descendant */}
        {entries.length > 0 && (
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-tertiary mb-2">
              All descendants · sorted by |{drift.window_days}d return|
            </p>
            <ul className="space-y-1.5">
              {entries.map((e) => (
                <DriftBarRow
                  key={e.symbol}
                  entry={e}
                  max={maxAbs(entries.map((x) => x.return_pct ?? 0))}
                  onSelect={onSelectSymbol}
                />
              ))}
            </ul>
          </div>
        )}

        <p className="text-2xs text-ink-tertiary">
          Source: CoinMarketCap{" "}
          <code className="font-mono">
            /v1/cryptocurrency/quotes/historical
          </code>{" "}
          and{" "}
          <code className="font-mono">
            /v1/global-metrics/quotes/historical
          </code>
          . Returns are simple price change over the window; not risk-adjusted.
        </p>
      </PanelBody>
    </Panel>
  );
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
    <div className="border border-line-subtle rounded-[4px] px-3 py-2.5 bg-canvas/50">
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
      <div className="text-2xs text-ink-tertiary mt-0.5">{subline}</div>
    </div>
  );
}

function MoverTile({
  kind,
  entry,
  onSelect,
}: {
  kind: "gainer" | "loser";
  entry: import("@/lib/ancestor/drift").DriftEntry;
  onSelect?: (s: string) => void;
}) {
  const tone = kind === "gainer" ? "positive" : "negative";
  const sign = kind === "gainer" ? "+" : "";
  return (
    <button
      type="button"
      onClick={() => onSelect?.(entry.symbol)}
      className={cn(
        "text-left border rounded-[4px] px-3 py-2.5 transition-colors",
        "border-line-subtle hover:border-line bg-canvas/50",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Badge tone={tone}>{kind === "gainer" ? "Strongest" : "Weakest"}</Badge>
        <span className="text-2xs uppercase tracking-wide text-ink-tertiary">
          {shortRelationLabel(entry.relation)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-primary truncate">
            {entry.name}{" "}
            <span className="text-ink-tertiary font-mono text-xs">
              {entry.symbol}
            </span>
          </div>
        </div>
        <div
          className={cn(
            "text-lg font-medium tracking-tight tnum",
            kind === "gainer" ? "text-positive" : "text-negative",
          )}
        >
          {sign}
          {entry.return_pct === null ? "—" : `${entry.return_pct.toFixed(1)}%`}
        </div>
      </div>
    </button>
  );
}

function DriftBarRow({
  entry,
  max,
  onSelect,
}: {
  entry: import("@/lib/ancestor/drift").DriftEntry;
  max: number;
  onSelect?: (s: string) => void;
}) {
  const ret = entry.return_pct ?? 0;
  const widthPct = max === 0 ? 0 : Math.min(100, Math.abs(ret) / max * 100);
  const isUp = ret >= 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(entry.symbol)}
        className="w-full grid grid-cols-[64px_1fr_56px] items-center gap-2 group text-left"
      >
        <span className="font-mono text-2xs uppercase tracking-wide text-ink-secondary truncate">
          {entry.symbol}
        </span>
        <span className="relative h-2 bg-canvas-sunken rounded-full overflow-hidden">
          <span
            className={cn(
              "absolute inset-y-0 left-1/2",
              isUp ? "bg-positive" : "bg-negative",
            )}
            style={{
              width: `${widthPct / 2}%`,
              transform: isUp ? "none" : "translateX(-100%)",
              transformOrigin: isUp ? "left center" : "right center",
            }}
          />
        </span>
        <span
          className={cn(
            "text-xs tnum text-right tabular-nums",
            isUp ? "text-positive" : "text-negative",
          )}
        >
          {ret > 0 ? "+" : ""}
          {ret.toFixed(1)}%
        </span>
      </button>
    </li>
  );
}

function maxAbs(xs: readonly number[]): number {
  let m = 0;
  for (const x of xs) {
    const a = Math.abs(x);
    if (a > m) m = a;
  }
  return m;
}

function headlineSentence(drift: LineageDrift): {
  title: string;
  description: string;
} {
  const base = drift.base_name;
  const window = drift.window_days;
  const gainer = drift.biggest_gainer;
  const loser = drift.biggest_loser;
  if (!gainer && !loser) {
    return {
      title: `${base} family returned ${drift.family_median_return_pct === null ? "—" : formatPercent(drift.family_median_return_pct)} on the median`,
      description: `${drift.evaluated_size} descendants evaluated over the last ${window} days.`,
    };
  }
  const parts: string[] = [];
  if (gainer) {
    parts.push(
      `${gainer.symbol} is the strongest at +${(gainer.return_pct ?? 0).toFixed(1)}%`,
    );
  }
  if (loser && loser.symbol !== gainer?.symbol) {
    parts.push(
      `${loser.symbol} is the weakest at ${(loser.return_pct ?? 0).toFixed(1)}%`,
    );
  }
  const familyPhrase =
    drift.family_median_return_pct === null
      ? ""
      : ` Family median is ${formatPercent(drift.family_median_return_pct)}.`;
  const deltaPhrase =
    drift.family_vs_base_delta_pct === null
      ? ""
      : drift.family_vs_base_delta_pct >= 0
        ? ` Family outperformed ${base} by ${formatPercent(drift.family_vs_base_delta_pct)}.`
        : ` Family underperformed ${base} by ${formatPercent(Math.abs(drift.family_vs_base_delta_pct))}.`;
  const marketPhrase =
    drift.family_vs_market_delta_pct === null
      ? ""
      : drift.family_vs_market_delta_pct >= 0
        ? ` Family beat the broader market by ${formatPercent(drift.family_vs_market_delta_pct)}.`
        : ` Family trailed the broader market by ${formatPercent(Math.abs(drift.family_vs_market_delta_pct))}.`;
  return {
    title: parts.join(", "),
    description: `${base}'s direct descendants over the last ${window} days.${familyPhrase}${deltaPhrase}${marketPhrase}`,
  };
}
