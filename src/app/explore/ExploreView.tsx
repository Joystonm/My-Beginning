"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eyebrow,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  Select,
  StateBlock,
} from "@/components/design-system";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { formatPercent, formatPrice, formatUsd } from "@/lib/utils";
import Link from "next/link";

type SortKey = "cmc_rank" | "market_cap" | "volume_24h" | "percent_change_24h" | "percent_change_7d" | "percent_change_30d" | "num_market_pairs";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "cmc_rank", label: "CMC rank" },
  { value: "market_cap", label: "Market cap" },
  { value: "volume_24h", label: "Volume 24h" },
  { value: "percent_change_24h", label: "24h change" },
  { value: "percent_change_7d", label: "7d change" },
  { value: "percent_change_30d", label: "30d change" },
  { value: "num_market_pairs", label: "Market pairs" },
];

export function ExploreView() {
  const [listings, setListings] = useState<CmcCryptocurrency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("cmc_rank");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [minCap, setMinCap] = useState<string>("");
  const [changeWindow, setChangeWindow] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cmc/listings?limit=250");
        const json = (await res.json()) as { data?: CmcCryptocurrency[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Failed to load.");
          setLoading(false);
          return;
        }
        setListings(json.data ?? []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const up = q.trim().toUpperCase();
    const minCapNum = minCap ? Number(minCap) : null;
    let rows = listings.filter((c) => {
      if (up) {
        const matches =
          c.symbol.toUpperCase().includes(up) ||
          c.name.toUpperCase().includes(up);
        if (!matches) return false;
      }
      if (minCapNum !== null && Number.isFinite(minCapNum)) {
        const cap = c.quote?.USD?.market_cap ?? 0;
        if (cap < minCapNum) return false;
      }
      return true;
    });
    rows = rows.sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      if (av === bv) return (a.cmc_rank ?? 0) - (b.cmc_rank ?? 0);
      return direction === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [listings, q, minCap, sort, direction]);

  if (loading) {
    return (
      <div className="py-10">
        <Eyebrow>Explore</Eyebrow>
        <div className="mt-4 h-[400px] rounded-[6px] border border-line bg-canvas-sunken/40 animate-pulse-soft" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10">
        <Eyebrow>Explore</Eyebrow>
        <div className="mt-6 max-w-md">
          <StateBlock
            title="Could not load the CMC universe"
            description={error}
            tone="error"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <Eyebrow>Explore</Eyebrow>
      <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary">
          The cryptocurrency universe
        </h1>
        <p className="text-sm text-ink-secondary max-w-md">
          {listings.length} assets · sorted and filtered in real time from
          CoinMarketCap data.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        <aside className="space-y-5">
          <Panel>
            <PanelHeader eyebrow="Search" title="Filter" />
            <PanelBody className="space-y-4">
              <div>
                <Label>Search</Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Symbol or name"
                />
              </div>
              <div>
                <Label>Sort</Label>
                <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <div className="mt-2 flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-8">
                  {(["asc", "desc"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={`flex-1 h-full text-xs transition-colors duration-180 ${
                        direction === d
                          ? "bg-ink-primary text-ink-inverse"
                          : "bg-canvas text-ink-secondary hover:bg-canvas-sunken"
                      }`}
                    >
                      {d === "asc" ? "Ascending" : "Descending"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Minimum market cap (USD)</Label>
                <Input
                  value={minCap}
                  onChange={(e) => setMinCap(e.target.value)}
                  placeholder="e.g. 1000000000"
                />
              </div>
              <div>
                <Label>Quick window</Label>
                <div className="flex items-center gap-1 rounded-[4px] border border-line-strong overflow-hidden h-8">
                  {(["24h", "7d", "30d"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => {
                        setChangeWindow(w);
                        setSort(
                          w === "24h"
                            ? "percent_change_24h"
                            : w === "7d"
                              ? "percent_change_7d"
                              : "percent_change_30d",
                        );
                      }}
                      className={`flex-1 h-full text-xs transition-colors duration-180 ${
                        changeWindow === w
                          ? "bg-ink-primary text-ink-inverse"
                          : "bg-canvas text-ink-secondary hover:bg-canvas-sunken"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </PanelBody>
          </Panel>
        </aside>

        <section>
          <div className="text-sm text-ink-secondary mb-3">
            Showing <span className="text-ink-primary font-medium">{filtered.length}</span> of{" "}
            <span className="text-ink-primary font-medium">{listings.length}</span>
          </div>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-secondary">
                    <th className="text-left font-medium px-4 py-2.5 w-12">#</th>
                    <th className="text-left font-medium px-4 py-2.5">Asset</th>
                    <th className="text-right font-medium px-4 py-2.5">Price</th>
                    <th className="text-right font-medium px-4 py-2.5">24h</th>
                    <th className="text-right font-medium px-4 py-2.5">7d</th>
                    <th className="text-right font-medium px-4 py-2.5">Market cap</th>
                    <th className="text-right font-medium px-4 py-2.5">Volume 24h</th>
                    <th className="text-right font-medium px-4 py-2.5">Pairs</th>
                    <th className="text-right font-medium px-4 py-2.5">Ancestor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {filtered.slice(0, 200).map((c) => (
                    <tr key={c.id} className="hover:bg-canvas-sunken/50">
                      <td className="px-4 py-2.5 tnum text-ink-tertiary">
                        {c.cmc_rank ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink-primary">{c.name}</div>
                        <div className="text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                          {c.symbol}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tnum text-ink-primary">
                        {formatPrice(c.quote?.USD?.price)}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum">
                        <ChangeCell value={c.quote?.USD?.percent_change_24h} />
                      </td>
                      <td className="px-4 py-2.5 text-right tnum">
                        <ChangeCell value={c.quote?.USD?.percent_change_7d} />
                      </td>
                      <td className="px-4 py-2.5 text-right tnum">
                        {formatUsd(c.quote?.USD?.market_cap, { compact: true })}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum">
                        {formatUsd(c.quote?.USD?.volume_24h, { compact: true })}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum text-ink-tertiary">
                        {(c.num_market_pairs ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/ancestor?symbol=${encodeURIComponent(c.symbol)}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Find →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) return "—";
  const positive = value >= 0;
  return (
    <span className={positive ? "text-signal-positive" : "text-signal-negative"}>
      {formatPercent(value)}
    </span>
  );
}

function sortValue(c: CmcCryptocurrency, k: SortKey): number {
  switch (k) {
    case "cmc_rank":
      return c.cmc_rank ?? Number.MAX_SAFE_INTEGER;
    case "market_cap":
      return c.quote?.USD?.market_cap ?? 0;
    case "volume_24h":
      return c.quote?.USD?.volume_24h ?? 0;
    case "percent_change_24h":
      return c.quote?.USD?.percent_change_24h ?? 0;
    case "percent_change_7d":
      return c.quote?.USD?.percent_change_7d ?? 0;
    case "percent_change_30d":
      return c.quote?.USD?.percent_change_30d ?? 0;
    case "num_market_pairs":
      return c.num_market_pairs ?? 0;
  }
}