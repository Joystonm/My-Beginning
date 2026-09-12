"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelBody, PanelHeader } from "@/components/design-system";
import { cn, formatRelative } from "@/lib/utils";

export interface HistoricalSeries {
  symbol: string;
  series: { t: number; value: number }[];
  error?: string;
}

interface Props {
  baseSymbol: string;
  baseName?: string;
  series: HistoricalSeries[];
  days: number;
  className?: string;
}

const SERIES_COLORS = ["#0F6B6B", "#A86B2F", "#5C5C5C", "#7A8A85"];

/**
 * Normalised price comparison. Each series is rebased to 100 at the start
 * so judges can see relative behaviour, not absolute price. Base asset is
 * always drawn first (accent).
 */
export function HistoricalComparison({
  baseSymbol,
  baseName,
  series,
  days,
  className,
}: Props) {
  const { data, symbols } = useMemo(() => {
    // Index each series by timestamp, then merge into rows.
    const byTs = new Map<number, Record<string, number>>();
    const syms: string[] = [];
    series.forEach((s) => {
      syms.push(s.symbol);
      for (const p of s.series) {
        const row = byTs.get(p.t) ?? {};
        row[s.symbol] = p.value;
        byTs.set(p.t, row);
      }
    });
    const rows = [...byTs.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, row]) => ({ t, ...row }));
    return { data: rows, symbols: syms };
  }, [series]);

  const hasData = data.length > 0;

  return (
    <Panel className={className}>
      <PanelHeader
        eyebrow="Historical context"
        title={`Relative performance · last ${days} days`}
        description={`Each line is rebased to 100 at the start. ${baseName ?? baseSymbol} compared against its closest market relatives.`}
      />
      <PanelBody className="!pt-3">
        <div className="h-[280px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="#EEEAE0" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={tickDate}
                  tick={{ fill: "#8A8A85", fontSize: 11 }}
                  axisLine={{ stroke: "#E5E2DA" }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: "#8A8A85", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                  width={48}
                  tickFormatter={(v) => v.toFixed(0)}
                />
                <Tooltip
                  cursor={{ stroke: "#CFCCC3", strokeWidth: 1 }}
                  content={<HistoricalTooltip baseSymbol={baseSymbol} />}
                />
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  iconType="plainline"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, color: "#5C5C5C" }}
                />
                {symbols.map((sym, i) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={sym === baseSymbol ? 2 : 1.25}
                    dot={false}
                    isAnimationActive={true}
                    animationDuration={500}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState baseSymbol={baseSymbol} />
          )}
        </div>
        {hasData && (
          <p className="text-2xs text-ink-tertiary mt-2">
            Values rebased to 100 at the start of the window. Source: CoinMarketCap <code className="font-mono">/quotes/historical</code>.
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}

function HistoricalTooltip({
  active,
  payload,
  label,
  baseSymbol,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: number;
  baseSymbol: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-canvas border border-line rounded-[4px] px-3 py-2 text-xs shadow-panel">
      <div className="font-medium text-ink-primary mb-1.5">
        {label ? new Date(label).toLocaleDateString() : "—"}
      </div>
      <div className="space-y-0.5">
        {payload
          .slice()
          .sort((a, b) =>
            a.name === baseSymbol ? -1 : b.name === baseSymbol ? 1 : 0,
          )
          .map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: p.color }}
              />
              <span
                className={cn(
                  "font-mono",
                  p.name === baseSymbol
                    ? "text-ink-primary font-medium"
                    : "text-ink-secondary",
                )}
              >
                {p.name}
              </span>
              <span className="tnum text-ink-primary ml-auto">
                {formatRelative(p.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function EmptyState({ baseSymbol }: { baseSymbol: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-ink-tertiary">
      Historical data is unavailable for {baseSymbol}.
    </div>
  );
}

function tickDate(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
