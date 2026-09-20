"use client";

import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";

export interface SparklineSeries {
  /** Normalized points (rebased to 100 at the start). */
  points: { t: number; value: number }[];
  /** Final value vs base; used to color the line. */
  trend: "up" | "down" | "flat";
}

interface Props {
  series: SparklineSeries | null;
  width?: number;
  height?: number;
}

/**
 * Tiny per-row 7-day sparkline. Renders nothing until mounted (Recharts
 * measures the parent on the client and an SSR/CSR width mismatch
 * causes a visible flash).
 *
 * Visual rules:
 *   - no axes, no legend, no tooltip
 *   - one stroke, `dot={false}`, `connectNulls`
 *   - green/red/gray based on the final value's sign
 *   - fixed width so columns align
 */
export function ExploreSparkline({ series, width = 96, height = 28 }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ width, height }} aria-hidden />;
  if (!series || series.points.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="text-2xs text-ink-tertiary flex items-center justify-center"
        aria-label="no sparkline data"
      >
        —
      </div>
    );
  }

  const color =
    series.trend === "up"
      ? "#3F7A4D" // positive
      : series.trend === "down"
        ? "#9A3F2E" // negative
        : "#8A8A85"; // neutral

  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={series.points}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Build a SparklineSeries from the historical endpoint's normalized
 * series. Exported so the orchestrator can compute it after the POST
 * returns, without the component having to know the wire format.
 */
export function buildSparkline(
  series: { t: number; value: number }[] | undefined,
): SparklineSeries | null {
  if (!series || series.length === 0) return null;
  const first = series[0]?.value ?? 100;
  const last = series[series.length - 1]?.value ?? 100;
  const delta = last - first;
  const trend =
    Math.abs(delta) < 0.5 ? "flat" : delta > 0 ? "up" : "down";
  return { points: series, trend };
}
