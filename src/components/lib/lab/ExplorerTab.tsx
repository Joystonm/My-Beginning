"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import {
  Eyebrow,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  Select,
  Tabs,
} from "@/components/design-system";
import { formatPercent, formatPrice, formatUsd } from "@/lib/utils";

interface Props {
  universe: CmcCryptocurrency[];
}

type MetricKey =
  | "market_cap"
  | "volume_24h"
  | "turnover"
  | "percent_change_24h"
  | "percent_change_7d"
  | "percent_change_30d"
  | "num_market_pairs";

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: "market_cap", label: "Market cap" },
  { value: "volume_24h", label: "Volume 24h" },
  { value: "turnover", label: "Turnover ratio" },
  { value: "percent_change_24h", label: "24h change" },
  { value: "percent_change_7d", label: "7d change" },
  { value: "percent_change_30d", label: "30d change" },
  { value: "num_market_pairs", label: "Market pairs" },
];

const RANGES = [
  { id: "1d", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
] as const;

const CALCULATIONS = [
  { id: "raw", label: "Raw value" },
  { id: "rank", label: "Rank in universe" },
  { id: "percentile", label: "Percentile" },
] as const;

type CalcId = (typeof CALCULATIONS)[number]["id"];

export function ExplorerTab({ universe }: Props) {
  const [top, setTop] = useState<number>(100);
  const [xMetric, setXMetric] = useState<MetricKey>("market_cap");
  const [yMetric, setYMetric] = useState<MetricKey>("percent_change_7d");
  const [calc, setCalc] = useState<CalcId>("raw");
  const [datasetId, setDatasetId] = useState<"top" | "gainers" | "losers">("top");

  const dataset = useMemo(() => {
    if (datasetId === "top") return universe.slice(0, top);
    const sortKey =
      datasetId === "gainers" ? "percent_change_24h" : "percent_change_24h";
    const dir = datasetId === "gainers" ? -1 : 1;
    return [...universe]
      .sort(
        (a, b) =>
          dir *
          ((b.quote?.USD?.[sortKey] ?? 0) - (a.quote?.USD?.[sortKey] ?? 0)),
      )
      .slice(0, top);
  }, [universe, datasetId, top]);

  const data = useMemo(() => {
    const get = (c: CmcCryptocurrency, k: MetricKey): number => {
      if (k === "turnover") {
        if (!c.quote?.USD?.market_cap) return 0;
        return (c.quote.USD.volume_24h ?? 0) / c.quote.USD.market_cap;
      }
      if (k === "num_market_pairs") return c.num_market_pairs ?? 0;
      const v = c.quote?.USD?.[k];
      return typeof v === "number" ? v : 0;
    };

    const allX = dataset.map((c) => get(c, xMetric));
    const allY = dataset.map((c) => get(c, yMetric));

    return dataset.map((c, i) => {
      const x = allX[i] ?? 0;
      const y = allY[i] ?? 0;
      let xV = x;
      let yV = y;
      if (calc === "rank") {
        xV = rankInUniverse(xMetric, x);
        yV = rankInUniverse(yMetric, y);
      } else if (calc === "percentile") {
        xV = percentileInUniverse(xMetric, x);
        yV = percentileInUniverse(yMetric, y);
      }
      return {
        symbol: c.symbol,
        name: c.name,
        x: xV,
        y: yV,
        rawX: x,
        rawY: y,
        z: Math.min(200, Math.max(20, Math.sqrt(Math.max(0, x || 1)))),
      };
    });
  }, [dataset, xMetric, yMetric, calc]);

  function rankInUniverse(key: MetricKey, value: number): number {
    const all = universe.map((c) => extract(c, key)).filter(Number.isFinite);
    if (all.length === 0) return 0;
    return [...all].sort((a, b) => b - a).indexOf(value) + 1;
  }

  function percentileInUniverse(key: MetricKey, value: number): number {
    const all = universe.map((c) => extract(c, key)).filter(Number.isFinite);
    if (all.length === 0) return 0;
    const sorted = [...all].sort((a, b) => a - b);
    const idx = sorted.indexOf(value);
    return Math.round((idx / sorted.length) * 100);
  }

  function extract(c: CmcCryptocurrency, k: MetricKey): number {
    if (k === "turnover") {
      if (!c.quote?.USD?.market_cap) return 0;
      return (c.quote.USD.volume_24h ?? 0) / c.quote.USD.market_cap;
    }
    if (k === "num_market_pairs") return c.num_market_pairs ?? 0;
    const v = c.quote?.USD?.[k];
    return typeof v === "number" ? v : 0;
  }

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          eyebrow="Data explorer"
          title="Build a custom view of the CMC universe"
          description="Dataset → metric → calculation → visualization. No spreadsheet required."
        />
        <PanelBody>
          <Tabs
            tabs={[
              {
                id: "scatter",
                label: "Scatter",
                content: (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <SelectField label="Dataset">
                      <Select
                        value={datasetId}
                        onChange={(e) => setDatasetId(e.target.value as typeof datasetId)}
                      >
                        <option value="top">Top by market cap</option>
                        <option value="gainers">Top 24h gainers</option>
                        <option value="losers">Top 24h losers</option>
                      </Select>
                    </SelectField>
                    <SelectField label="Top N">
                      <Select
                        value={top}
                        onChange={(e) => setTop(Number(e.target.value))}
                      >
                        {[25, 50, 100, 200].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </SelectField>
                    <SelectField label="X axis">
                      <Select
                        value={xMetric}
                        onChange={(e) => setXMetric(e.target.value as MetricKey)}
                      >
                        {METRIC_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </SelectField>
                    <SelectField label="Y axis">
                      <Select
                        value={yMetric}
                        onChange={(e) => setYMetric(e.target.value as MetricKey)}
                      >
                        {METRIC_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </SelectField>
                    <SelectField label="Calculation">
                      <Select
                        value={calc}
                        onChange={(e) => setCalc(e.target.value as CalcId)}
                      >
                        {CALCULATIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </SelectField>
                  </div>
                ),
              },
              {
                id: "table",
                label: "Ranked table",
                content: (
                  <RankedTable
                    dataset={dataset}
                    sortMetric={yMetric}
                  />
                ),
              },
            ]}
          />

          <div className="mt-6">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 0, right: 16, bottom: 24, left: 16 }}>
                  <CartesianGrid stroke="#EEEAE0" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    stroke="#8A8A85"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#E5E2DA" }}
                    name={METRIC_OPTIONS.find((m) => m.value === xMetric)?.label}
                    tickFormatter={(v) => formatNumber(v, xMetric)}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    stroke="#8A8A85"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    name={METRIC_OPTIONS.find((m) => m.value === yMetric)?.label}
                    tickFormatter={(v) => formatNumber(v, yMetric)}
                  />
                  <ZAxis type="number" dataKey="z" range={[20, 80]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "2 4", stroke: "#B4B4AE" }}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E5E2DA",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                    formatter={(value: number, key: string) => {
                      if (key === "x") return [formatNumber(value, xMetric), METRIC_OPTIONS.find((m) => m.value === xMetric)?.label];
                      if (key === "y") return [formatNumber(value, yMetric), METRIC_OPTIONS.find((m) => m.value === yMetric)?.label];
                      return [value, key];
                    }}
                    labelFormatter={(_, payload) => {
                      const p = Array.isArray(payload) ? payload[0] : null;
                      return p?.payload ? `${p.payload.name} (${p.payload.symbol})` : "";
                    }}
                  />
                  <Scatter data={data} fill="#0F6B6B" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink-tertiary mt-3">
              Marker size scales with the X metric. Hover for details. Switch
              the calculation to compare assets on rank or percentile instead
              of raw values.
            </p>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Custom calculations"
          title="Build a metric from CMC fields"
          description="Combine any two metrics to derive a new one. No black boxes."
        />
        <PanelBody>
          <CustomCalculator universe={universe} />
        </PanelBody>
      </Panel>
    </div>
  );
}

function SelectField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function formatNumber(value: number, key: MetricKey): string {
  if (key === "market_cap" || key === "volume_24h") {
    return formatUsd(value, { compact: true });
  }
  if (key === "percent_change_24h" || key === "percent_change_7d" || key === "percent_change_30d") {
    return `${value.toFixed(1)}%`;
  }
  if (key === "turnover") return `${(value * 100).toFixed(1)}%`;
  if (key === "num_market_pairs") return value.toFixed(0);
  return value.toString();
}

function RankedTable({
  dataset,
  sortMetric,
}: {
  dataset: CmcCryptocurrency[];
  sortMetric: MetricKey;
}) {
  const sorted = useMemo(() => {
    const arr = [...dataset];
    arr.sort((a, b) => {
      const va = metricValue(a, sortMetric);
      const vb = metricValue(b, sortMetric);
      return vb - va;
    });
    return arr.slice(0, 50);
  }, [dataset, sortMetric]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-ink-secondary">
            <th className="text-left font-medium px-3 py-2.5 w-10">#</th>
            <th className="text-left font-medium px-3 py-2.5">Asset</th>
            <th className="text-right font-medium px-3 py-2.5">Price</th>
            <th className="text-right font-medium px-3 py-2.5">Market cap</th>
            <th className="text-right font-medium px-3 py-2.5">Volume 24h</th>
            <th className="text-right font-medium px-3 py-2.5">24h</th>
            <th className="text-right font-medium px-3 py-2.5">7d</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {sorted.map((c, i) => (
            <tr key={c.id}>
              <td className="px-3 py-2 tnum text-ink-tertiary">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-ink-primary">{c.name}</span>
                <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                  {c.symbol}
                </span>
              </td>
              <td className="px-3 py-2 text-right tnum">
                {formatPrice(c.quote?.USD?.price)}
              </td>
              <td className="px-3 py-2 text-right tnum">
                {formatUsd(c.quote?.USD?.market_cap, { compact: true })}
              </td>
              <td className="px-3 py-2 text-right tnum">
                {formatUsd(c.quote?.USD?.volume_24h, { compact: true })}
              </td>
              <td className="px-3 py-2 text-right tnum">
                {formatPercent(c.quote?.USD?.percent_change_24h)}
              </td>
              <td className="px-3 py-2 text-right tnum">
                {formatPercent(c.quote?.USD?.percent_change_7d)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function metricValue(c: CmcCryptocurrency, k: MetricKey): number {
  if (k === "turnover") {
    if (!c.quote?.USD?.market_cap) return 0;
    return (c.quote.USD.volume_24h ?? 0) / c.quote.USD.market_cap;
  }
  if (k === "num_market_pairs") return c.num_market_pairs ?? 0;
  const v = c.quote?.USD?.[k];
  return typeof v === "number" ? v : 0;
}

function CustomCalculator({ universe }: { universe: CmcCryptocurrency[] }) {
  const [numerator, setNumerator] = useState<MetricKey>("volume_24h");
  const [denominator, setDenominator] = useState<MetricKey>("market_cap");
  const [top, setTop] = useState<number>(20);

  const result = useMemo(() => {
    const rows = universe
      .map((c) => {
        const n = metricValue(c, numerator);
        const d = metricValue(c, denominator);
        if (!d) return null;
        return { symbol: c.symbol, name: c.name, value: n / d, raw: { n, d } };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && Number.isFinite(r.value));
    rows.sort((a, b) => b.value - a.value);
    return rows.slice(0, top);
  }, [universe, numerator, denominator, top]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SelectField label="Numerator">
          <Select value={numerator} onChange={(e) => setNumerator(e.target.value as MetricKey)}>
            {METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </SelectField>
        <SelectField label="÷">
          <Select value={denominator} onChange={(e) => setDenominator(e.target.value as MetricKey)}>
            {METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </SelectField>
        <SelectField label="Top N">
          <Select value={top} onChange={(e) => setTop(Number(e.target.value))}>
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </SelectField>
      </div>

      <div className="mt-4 text-sm text-ink-secondary">
        Formula:{" "}
        <code className="font-mono text-xs px-1.5 py-0.5 bg-canvas-sunken rounded">
          {METRIC_OPTIONS.find((m) => m.value === numerator)?.label}{" "}
          <span className="text-ink-tertiary">÷</span>{" "}
          {METRIC_OPTIONS.find((m) => m.value === denominator)?.label}
        </code>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-ink-secondary">
              <th className="text-left font-medium px-3 py-2.5 w-10">#</th>
              <th className="text-left font-medium px-3 py-2.5">Asset</th>
              <th className="text-right font-medium px-3 py-2.5">
                {METRIC_OPTIONS.find((m) => m.value === numerator)?.label}
              </th>
              <th className="text-right font-medium px-3 py-2.5">
                {METRIC_OPTIONS.find((m) => m.value === denominator)?.label}
              </th>
              <th className="text-right font-medium px-3 py-2.5">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {result.map((r, i) => (
              <tr key={r.symbol}>
                <td className="px-3 py-2 tnum text-ink-tertiary">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-ink-primary">{r.name}</span>
                  <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                    {r.symbol}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tnum">
                  {formatNumber(r.raw.n, numerator)}
                </td>
                <td className="px-3 py-2 text-right tnum">
                  {formatNumber(r.raw.d, denominator)}
                </td>
                <td className="px-3 py-2 text-right tnum font-medium">
                  {r.value.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}