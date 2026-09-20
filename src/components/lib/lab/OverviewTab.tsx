"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CmcCryptocurrency, CmcGlobalMetrics } from "@/lib/cmc/types";
import { Eyebrow, Panel, PanelBody, PanelHeader, StateBlock } from "@/components/design-system";
import { formatPercent, formatUsd } from "@/lib/utils";
import { SeedNotice } from "./SeedNotice";

interface SeedInfo {
  source: "seed";
  message: string;
  count: number;
  handCurated: number;
}

interface Props {
  global: CmcGlobalMetrics | null;
  universe: CmcCryptocurrency[];
  error: string | null;
}

export function OverviewTab({ global, universe, error }: Props) {
  const [source, setSource] = useState<"live" | "seed" | null>(null);
  const [seed, setSeed] = useState<SeedInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cmc/evidence")
      .then((r) => r.json() as Promise<{ source?: "live" | "seed"; seed?: SeedInfo }>)
      .then((j) => {
        if (cancelled) return;
        setSource(j.source ?? null);
        setSeed(j.seed ?? null);
      })
      .catch(() => {
        // Non-critical — if the evidence endpoint is down the page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const top = useMemo(() => universe.slice(0, 15), [universe]);
  const gainers = useMemo(
    () =>
      [...universe]
        .filter((c) => Number.isFinite(c.quote?.USD?.percent_change_24h))
        .sort(
          (a, b) =>
            (b.quote?.USD?.percent_change_24h ?? 0) -
            (a.quote?.USD?.percent_change_24h ?? 0),
        )
        .slice(0, 8),
    [universe],
  );
  const losers = useMemo(
    () =>
      [...universe]
        .filter((c) => Number.isFinite(c.quote?.USD?.percent_change_24h))
        .sort(
          (a, b) =>
            (a.quote?.USD?.percent_change_24h ?? 0) -
            (b.quote?.USD?.percent_change_24h ?? 0),
        )
        .slice(0, 8),
    [universe],
  );

  if (error) {
    return (
      <StateBlock
        title="Global metrics unavailable"
        description={error}
        tone="error"
        eyebrow="CoinMarketCap"
      />
    );
  }

  if (!global) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[6px] border border-line bg-canvas p-5 h-[120px] animate-pulse-soft"
          />
        ))}
      </div>
    );
  }

  // CMC's /v1/global-metrics/quotes/latest nests totals under `quote.USD`
  // and exposes dominance as flat fields. Older docs showed a
  // `market_cap_percentage` map and top-level totals — that's not what
  // the endpoint actually returns anymore, so we read from the new
  // shape directly.
  const usd = global.quote.USD;
  const btcDominance = global.btc_dominance ?? 0;
  const ethDominance = global.eth_dominance ?? 0;
  const change24h = usd.market_cap_change_percentage_24h_usd ?? 0;

  return (
    <div className="space-y-6">
      {source && <SeedNotice source={source} seed={seed} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[6px] overflow-hidden">
        <Stat label="Total market cap" value={formatUsd(usd.total_market_cap, { compact: true })} />
        <Stat
          label="24h change"
          value={formatPercent(change24h)}
          tone={change24h >= 0 ? "positive" : "negative"}
        />
        <Stat label="24h volume" value={formatUsd(usd.total_volume_24h, { compact: true })} />
        <Stat label="Active assets" value={global.active_cryptocurrencies.toLocaleString()} />
        <Stat label="BTC dominance" value={`${btcDominance.toFixed(2)}%`} />
        <Stat label="ETH dominance" value={`${ethDominance.toFixed(2)}%`} />
        <Stat label="Active exchanges" value={global.active_exchanges.toLocaleString()} />
        <Stat
          label="Active pairs"
          // Force en-US locale — some browsers default to en-IN and render
          // 116587 as "1,16,587", which is meaningless for a market count.
          value={global.active_market_pairs?.toLocaleString("en-US") ?? "—"}
        />
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Top 15 by market cap"
          title="The CMC universe"
          description="Bar chart of the largest assets by market capitalization."
        />
        <div className="p-5">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top.map((c) => ({
                  symbol: c.symbol,
                  cap: c.quote?.USD?.market_cap ?? 0,
                }))}
                margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="#EEEAE0" vertical={false} />
                <XAxis
                  dataKey="symbol"
                  stroke="#8A8A85"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E2DA" }}
                />
                <YAxis
                  stroke="#8A8A85"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatUsd(v, { compact: true })}
                />
                <Tooltip
                  cursor={{ fill: "#F2EFE9" }}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E2DA",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatUsd(v, { compact: true }), "Market cap"]}
                />
                <Bar dataKey="cap" fill="#0F6B6B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel>
          <PanelHeader
            eyebrow="Top gainers · 24h"
            title="Strongest performers"
          />
          <PanelBody className="!pt-2">
            <ul className="divide-y divide-line-subtle">
              {gainers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="tnum text-ink-tertiary text-xs w-6">
                      {c.cmc_rank ?? "—"}
                    </span>
                    <span className="font-medium text-ink-primary truncate">{c.name}</span>
                    <span className="text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                      {c.symbol}
                    </span>
                  </div>
                  <span className="text-signal-positive tnum">
                    {formatPercent(c.quote?.USD?.percent_change_24h)}
                  </span>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Top losers · 24h" title="Biggest decliners" />
          <PanelBody className="!pt-2">
            <ul className="divide-y divide-line-subtle">
              {losers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="tnum text-ink-tertiary text-xs w-6">
                      {c.cmc_rank ?? "—"}
                    </span>
                    <span className="font-medium text-ink-primary truncate">{c.name}</span>
                    <span className="text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                      {c.symbol}
                    </span>
                  </div>
                  <span className="text-signal-negative tnum">
                    {formatPercent(c.quote?.USD?.percent_change_24h)}
                  </span>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="bg-canvas p-5">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`text-lg tnum mt-2 tracking-tight ${
          tone === "positive"
            ? "text-signal-positive"
            : tone === "negative"
              ? "text-signal-negative"
              : "text-ink-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}