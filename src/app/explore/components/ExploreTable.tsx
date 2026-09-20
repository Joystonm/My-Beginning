"use client";

import Link from "next/link";
import { Panel } from "@/components/design-system";
import { cn, formatPrice, formatUsd, formatPercent } from "@/lib/utils";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type { Density, Direction, SortKey } from "../lib/exploreFilters";
import {
  ExploreSparkline,
  type SparklineSeries,
  buildSparkline,
} from "./ExploreSparkline";

export type SparklineMap = Map<string, SparklineSeries | "loading" | "missing">;

interface Props {
  rows: CmcCryptocurrency[];
  sortKey: SortKey;
  direction: Direction;
  density: Density;
  sparklines: SparklineMap;
  onSort: (key: SortKey) => void;
  onDensityToggle: (d: Density) => void;
  visibleSparklineCount: number;
}

interface Column {
  id: SortKey | "asset" | "sparkline" | "ancestor" | "actions";
  label: string;
  /** Right-aligned numeric columns use tnum + text-right. */
  numeric?: boolean;
  /** Hide in compact density. */
  hideInCompact?: boolean;
}

const COLUMNS: Column[] = [
  { id: "cmc_rank", label: "#", numeric: true },
  { id: "asset", label: "Asset" },
  { id: "sparkline", label: "7d" },
  { id: "market_cap", label: "Market cap", numeric: true },
  { id: "volume_24h", label: "Volume 24h", numeric: true },
  { id: "percent_change_24h", label: "24h", numeric: true },
  { id: "percent_change_7d", label: "7d %", numeric: true, hideInCompact: true },
  { id: "num_market_pairs", label: "Pairs", numeric: true, hideInCompact: true },
  { id: "ancestor", label: "Lineage" },
];

export function ExploreTable({
  rows,
  sortKey,
  direction,
  density,
  sparklines,
  onSort,
  onDensityToggle,
  visibleSparklineCount,
}: Props) {
  const compact = density === "compact";
  const visibleColumns = COLUMNS.filter((c) => !(compact && c.hideInCompact));
  const cellPad = compact ? "px-2.5 py-1.5" : "px-4 py-2.5";
  const cellText = compact ? "text-xs" : "text-sm";

  return (
    <Panel>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line-subtle">
        <p className="text-2xs text-ink-tertiary uppercase tracking-wide">
          Click any column header to sort
        </p>
        <div
          className="flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-7"
          role="tablist"
          aria-label="Row density"
        >
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={density === d}
              onClick={() => onDensityToggle(d)}
              className={cn(
                "h-full px-2.5 text-xs transition-colors duration-180",
                density === d
                  ? "bg-ink-primary text-ink-inverse"
                  : "bg-canvas text-ink-secondary hover:bg-canvas-sunken",
              )}
            >
              {d === "comfortable" ? "Comfortable" : "Compact"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-ink-secondary">
              {visibleColumns.map((col) => {
                if (col.id === "asset" || col.id === "ancestor") {
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      className={cn(
                        "text-left font-medium p-0",
                      )}
                    >
                      <div className={cn(cellPad, "whitespace-nowrap")}>
                        {col.label}
                      </div>
                    </th>
                  );
                }
                const sortable = isSortable(col.id);
                const active = sortable && sortKey === col.id;
                const ariaSort = active
                  ? direction === "asc"
                    ? "ascending"
                    : "descending"
                  : sortable
                    ? "none"
                    : undefined;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      "font-medium p-0",
                      col.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        // The button fills the entire <th> cell so the
                        // whole header area is a click target — not just
                        // the text. We use flex (not inline-flex) so the
                        // arrow + label stay on a single line inside a
                        // table cell. text-right/left on the <th>
                        // controls which side the row of label+arrow is
                        // pinned to.
                        className={cn(
                          "w-full flex items-center gap-1 transition-colors duration-180 whitespace-nowrap",
                          cellPad,
                          col.numeric ? "justify-end" : "justify-start",
                          active ? "text-ink-primary" : "hover:text-ink-primary",
                        )}
                        onClick={() => onSort(col.id as SortKey)}
                      >
                        <span>{col.label}</span>
                        <span aria-hidden className="text-2xs">
                          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    ) : (
                      <div className={cn(cellPad, "whitespace-nowrap")}>
                        {col.label}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {rows.slice(0, 200).map((c) => {
              const usd = c.quote?.USD;
              return (
                <tr key={c.id} className="hover:bg-canvas-sunken/40">
                  <td className={cn(cellPad, "tnum text-ink-tertiary", cellText)}>
                    {c.cmc_rank ?? "—"}
                  </td>
                  <td className={cn(cellPad, cellText)}>
                    <div className="font-medium text-ink-primary">{c.name}</div>
                    <div className="text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                      {c.symbol}
                    </div>
                  </td>
                  <td className={cn(cellPad, cellText)}>
                    <RowSparkline
                      symbol={c.symbol}
                      sparklines={sparklines}
                      visibleSparklineCount={visibleSparklineCount}
                    />
                  </td>
                  <td className={cn(cellPad, "text-right tnum", cellText)}>
                    {formatPrice(usd?.price)}
                  </td>
                  <td className={cn(cellPad, "text-right tnum", cellText)}>
                    {formatUsd(usd?.market_cap, { compact: true })}
                  </td>
                  <td className={cn(cellPad, "text-right tnum", cellText)}>
                    {formatUsd(usd?.volume_24h, { compact: true })}
                  </td>
                  {!compact && (
                    <td className={cn(cellPad, "text-right tnum", cellText)}>
                      <ChangeCell value={usd?.percent_change_24h} />
                    </td>
                  )}
                  {!compact && (
                    <td className={cn(cellPad, "text-right tnum", cellText)}>
                      <ChangeCell value={usd?.percent_change_7d} />
                    </td>
                  )}
                  {!compact && (
                    <td className={cn(cellPad, "text-right tnum text-ink-tertiary", cellText)}>
                      {(c.num_market_pairs ?? 0).toLocaleString("en-US")}
                    </td>
                  )}
                  <td className={cn(cellPad, cellText)}>
                    <Link
                      href={`/ancestor?symbol=${encodeURIComponent(c.symbol)}`}
                      className="text-xs text-accent hover:underline whitespace-nowrap"
                    >
                      Find →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RowSparkline({
  symbol,
  sparklines,
  visibleSparklineCount,
}: {
  symbol: string;
  sparklines: SparklineMap;
  visibleSparklineCount: number;
}) {
  // The orchestrator keeps an insertion-ordered Map; the first N rows
  // get fetched. We render the cell based on the Map value:
  //   - missing:    a "—" placeholder (orchestrator didn't request it
  //                 because it was beyond visibleSparklineCount)
  //   - loading:    a faint shimmer
  //   - Series:     the actual chart
  const idx = sparklines.has(symbol)
    ? [...sparklines.keys()].indexOf(symbol)
    : -1;
  const value = sparklines.get(symbol);
  if (value === undefined) return <span className="text-2xs text-ink-tertiary">—</span>;
  if (value === "loading") {
    return (
      <div
        className="h-[28px] w-[96px] bg-canvas-sunken/40 rounded animate-pulse"
        aria-hidden
      />
    );
  }
  if (value === "missing") {
    // Render the placeholder once the orchestrator confirms there's no
    // data — for visible rows this should be rare (only when the API
    // returned an error per-symbol).
    return <span className="text-2xs text-ink-tertiary">—</span>;
  }
  // Use the index check only to avoid an unused-var lint warning — the
  // value branch above already handled all three states.
  void idx;
  return <ExploreSparkline series={value} />;
}

function isSortable(id: Column["id"]): id is SortKey {
  return (
    id === "cmc_rank" ||
    id === "market_cap" ||
    id === "volume_24h" ||
    id === "percent_change_24h" ||
    id === "percent_change_7d" ||
    id === "percent_change_30d" ||
    id === "num_market_pairs"
  );
}

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return <span className="text-ink-tertiary">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "text-signal-positive" : "text-signal-negative"}>
      {formatPercent(value)}
    </span>
  );
}

// Suppress unused — `buildSparkline` is exported here as a convenience
// re-export for callers, but also lives in ExploreSparkline.tsx. Keep
// the import so tree-shaking sees it as a side-effect-free helper that
// orchestrators may use directly.
export { buildSparkline };
