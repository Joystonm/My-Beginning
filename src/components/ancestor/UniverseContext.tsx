"use client";

import { useMemo } from "react";
import {
  DEFAULT_DIMENSIONS,
  type DimensionDef,
  type NormalizedFeatures,
  type UniverseMedian,
} from "@/lib/ancestor/types";
import { percentileRank } from "@/lib/ancestor/ui-helpers";
import { Panel, PanelBody, PanelHeader } from "@/components/design-system";
import { cn } from "@/lib/utils";

interface Props {
  base: NormalizedFeatures | null;
  universe: NormalizedFeatures[];
  className?: string;
}

/**
 * Per-dimension percentile context. Each row answers:
 * "Across the top 250 assets, where does this one sit?"
 */
export function UniverseContext({ base, universe, className }: Props) {
  const rows = useMemo(() => {
    if (!base) return [];
    return DEFAULT_DIMENSIONS.map((d) => {
      // Category + kind are 0/1 binary presence flags, not continuous
      // measurements — skip the percentile bar for them.
      const isBinary = d.id === "category" || d.id === "kind";
      const value = (base as unknown as Record<string, number>)[d.id] ?? 0;
      const p = isBinary
        ? value
        : percentileRank(universe, d.id as keyof UniverseMedian, value);
      return { dim: d, value, p, isBinary };
    });
  }, [base, universe]);

  return (
    <Panel className={className}>
      <PanelHeader
        eyebrow="Universe context"
        title="Where does it sit?"
        description={`Each row shows where ${base?.symbol ?? "this asset"} ranks across the top ${universe.length} assets, on each dimension.`}
      />
      <PanelBody className="!pt-3">
        <ul className="divide-y divide-line-subtle">
          {rows.length === 0 && (
            <li className="py-3 text-sm text-ink-tertiary">
              Select an asset to see its universe position.
            </li>
          )}
          {rows.map(({ dim, value, p, isBinary }) => (
            <li key={dim.id} className="py-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-ink-primary">{dim.label}</span>
                <span className="flex items-baseline gap-2 text-sm tnum">
                  {isBinary ? (
                    <span className="text-ink-primary font-medium">
                      {value >= 1 ? "known" : "unknown"}
                    </span>
                  ) : (
                    <>
                      <span className="text-ink-primary font-medium">
                        {Math.round(p * 100)}
                        <span className="text-ink-tertiary text-2xs">th pct</span>
                      </span>
                      <span className="text-2xs text-ink-tertiary tnum">
                        raw {value.toFixed(2)}
                      </span>
                    </>
                  )}
                </span>
              </div>
              {!isBinary && <PercentileBar p={p} />}
              {isBinary && (
                <p className="text-2xs text-ink-tertiary">
                  {dim.id === "category"
                    ? "Pulled from CMC /info. Required for the engine to identify meaningful ancestors."
                    : "Inferred from CMC tags. Same-kind assets are far more likely to share market behaviour."}
                </p>
              )}
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function PercentileBar({ p }: { p: number }) {
  return (
    <div className="relative h-1.5 rounded-full bg-canvas-sunken overflow-visible">
      {/* Median tick at 50% */}
      <span
        className="absolute top-[-3px] bottom-[-3px] w-px bg-ink-muted"
        style={{ left: "50%" }}
        aria-hidden
      />
      <div
        className={cn(
          "h-full rounded-full transition-all duration-slow ease-editorial",
          p >= 0.5 ? "bg-accent" : "bg-ink-tertiary",
        )}
        style={{ width: `${Math.max(2, p * 100)}%` }}
      />
    </div>
  );
}
