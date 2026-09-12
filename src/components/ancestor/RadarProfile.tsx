"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DEFAULT_DIMENSIONS } from "@/lib/ancestor/types";
import type {
  DimensionDef,
  NormalizedFeatures,
  UniverseMedian,
} from "@/lib/ancestor/types";
import { Panel, PanelBody, PanelHeader } from "@/components/design-system";

interface Props {
  base: NormalizedFeatures | null;
  median: UniverseMedian | null;
  className?: string;
}

/**
 * Radar chart of the base asset's 7-dimension profile overlaid on the
 * universe median. Highlights "you are here" — the shape the asset
 * describes across market-cap, turnover, momentum, volatility, etc.
 */
export function RadarProfile({ base, median, className }: Props) {
  const data = useMemo(
    () => buildSeries(base, median),
    [base, median],
  );

  return (
    <Panel className={className}>
      <PanelHeader
        eyebrow="Fingerprint"
        title="The shape of this asset"
        description="Seven dimensions of similarity, plotted against the universe median. Larger area = more 'extreme' on those traits."
      />
      <PanelBody>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="78%">
              <PolarGrid stroke="#E5E2DA" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "#5C5C5C", fontSize: 11 }}
              />
              <PolarRadiusAxis
                domain={[0, 1]}
                axisLine={false}
                tick={false}
                stroke="#EEEAE0"
              />
              {median && (
                <Radar
                  name="Universe median"
                  dataKey="median"
                  stroke="#8A8A85"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="#8A8A85"
                  fillOpacity={0.05}
                  isAnimationActive={false}
                />
              )}
              {base && (
                <Radar
                  name="This asset"
                  dataKey="base"
                  stroke="#0F6B6B"
                  strokeWidth={1.5}
                  fill="#0F6B6B"
                  fillOpacity={0.22}
                  isAnimationActive={true}
                  animationDuration={420}
                />
              )}
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <Legend />
      </PanelBody>
    </Panel>
  );
}

function buildSeries(
  base: NormalizedFeatures | null,
  median: UniverseMedian | null,
) {
  return DEFAULT_DIMENSIONS.map((d) => ({
    axis: shortLabel(d),
    base: base ? ((base as unknown as Record<string, number>)[d.id]) : null,
    median: median ? ((median as unknown as Record<string, number>)[d.id]) : null,
  }));
}

function shortLabel(d: DimensionDef): string {
  // Two-word or short single-word labels that fit on the radar axis.
  switch (d.id) {
    case "market_cap_position":
      return "Size";
    case "turnover_position":
      return "Turnover";
    case "momentum_7d":
      return "Momentum";
    case "short_volatility":
      return "Volatility";
    case "market_pair_breadth":
      return "Pairs";
    case "supply_scarcity":
      return "Scarcity";
    case "maturity":
      return "Maturity";
    case "category":
      return "Category";
    case "kind":
      return "Kind";
    default:
      return d.label;
  }
}

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-canvas border border-line rounded-[4px] px-3 py-2 text-xs shadow-panel">
      <div className="font-medium text-ink-primary mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mt-0.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-ink-secondary">{p.name}</span>
          <span className="tnum text-ink-primary ml-auto">
            {(p.value * 100).toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 text-2xs text-ink-secondary">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-accent" />
        This asset
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full bg-ink-tertiary"
          style={{ opacity: 0.5 }}
        />
        <span
          className="h-px w-4 bg-ink-tertiary"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, currentColor 0 3px, transparent 3px 6px)",
            color: "#8A8A85",
          }}
        />
        Universe median
      </span>
    </div>
  );
}
