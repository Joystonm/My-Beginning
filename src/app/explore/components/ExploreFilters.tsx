"use client";

import {
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  Select,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import type {
  Density,
  Direction,
  ExploreFilters as Filters,
  SortKey,
  Window,
} from "../lib/exploreFilters";

interface Props {
  state: Filters;
  onChange: (patch: Partial<Filters>) => void;
  /** Convenience handler — clears all filters. */
  onReset?: () => void;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "cmc_rank", label: "CMC rank" },
  { value: "market_cap", label: "Market cap" },
  { value: "volume_24h", label: "Volume 24h" },
  { value: "percent_change_24h", label: "24h change" },
  { value: "percent_change_7d", label: "7d change" },
  { value: "percent_change_30d", label: "30d change" },
  { value: "num_market_pairs", label: "Market pairs" },
];

/**
 * The left-sidebar filter panel. Fully controlled — every field reads
 * from `state` and emits via `onChange`. No internal state. This is
 * what makes the URL-state plumbing safe: there's exactly one writer.
 */
export function ExploreFilters({ state, onChange, onReset }: Props) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Search"
        title="Filter"
        description={
          onReset ? (
            <button
              type="button"
              className="text-2xs text-accent hover:underline"
              onClick={onReset}
            >
              Reset all
            </button>
          ) : (
            "Every filter writes to the URL."
          )
        }
      />
      <PanelBody className="space-y-4">
        <div>
          <Label htmlFor="explore-q">Search</Label>
          <Input
            id="explore-q"
            value={state.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Symbol or name"
          />
        </div>
        <div>
          <Label htmlFor="explore-sort">Sort by</Label>
          <Select
            id="explore-sort"
            value={state.sort}
            onChange={(e) =>
              onChange({
                sort: e.target.value as SortKey,
                direction:
                  e.target.value === "cmc_rank" ? "asc" : "desc",
              })
            }
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <div
            className="mt-2 flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-8"
            role="tablist"
            aria-label="Sort direction"
          >
            {(["asc", "desc"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={state.direction === d}
                onClick={() => onChange({ direction: d as Direction })}
                className={cn(
                  "flex-1 h-full text-xs transition-colors duration-180",
                  state.direction === d
                    ? "bg-ink-primary text-ink-inverse"
                    : "bg-canvas text-ink-secondary hover:bg-canvas-sunken",
                )}
              >
                {d === "asc" ? "Ascending" : "Descending"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="explore-mincap">Minimum market cap (USD)</Label>
          <Input
            id="explore-mincap"
            inputMode="numeric"
            value={state.minCap === null ? "" : String(state.minCap)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                onChange({ minCap: null });
                return;
              }
              const n = Number(raw);
              onChange({ minCap: Number.isFinite(n) && n >= 0 ? n : null });
            }}
            placeholder="e.g. 1000000000"
          />
        </div>
        <div>
          <Label>Quick window</Label>
          <div
            className="flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-8"
            role="tablist"
            aria-label="Quick change window"
          >
            {(["24h", "7d", "30d"] as const).map((w) => (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={state.window === w}
                onClick={() => {
                  onChange({
                    window: w as Window,
                    sort:
                      w === "24h"
                        ? "percent_change_24h"
                        : w === "7d"
                          ? "percent_change_7d"
                          : "percent_change_30d",
                    direction: "desc",
                  });
                }}
                className={cn(
                  "flex-1 h-full text-xs transition-colors duration-180",
                  state.window === w
                    ? "bg-ink-primary text-ink-inverse"
                    : "bg-canvas text-ink-secondary hover:bg-canvas-sunken",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Density</Label>
          <div
            className="flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-8"
            role="tablist"
            aria-label="Row density"
          >
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={state.density === d}
                onClick={() => onChange({ density: d as Density })}
                className={cn(
                  "flex-1 h-full text-xs transition-colors duration-180",
                  state.density === d
                    ? "bg-ink-primary text-ink-inverse"
                    : "bg-canvas text-ink-secondary hover:bg-canvas-sunken",
                )}
              >
                {d === "comfortable" ? "Comfortable" : "Compact"}
              </button>
            ))}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
