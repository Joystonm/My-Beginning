"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import {
  Eyebrow,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  StateBlock,
} from "@/components/design-system";
import { formatPercent, formatPrice, formatUsd } from "@/lib/utils";

interface Props {
  universe: CmcCryptocurrency[];
}

const PALETTE = ["#0F6B6B", "#B8412F", "#5C5C5C", "#2F7D52", "#9B6B12"];

export function CompareTab({ universe }: Props) {
  const searchParams = useSearchParams();
  const initial = useMemo(() => {
    const fromUrl = (searchParams.get("symbols") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return fromUrl.length > 0 ? fromUrl : ["BTC", "ETH"];
  }, [searchParams]);
  const [selected, setSelected] = useState<string[]>(initial);

  const universeBySymbol = useMemo(() => {
    const map = new Map<string, CmcCryptocurrency>();
    for (const c of universe) map.set(c.symbol.toUpperCase(), c);
    return map;
  }, [universe]);

  const items = selected
    .map((s) => universeBySymbol.get(s.toUpperCase()))
    .filter((c): c is CmcCryptocurrency => Boolean(c));

  function addSymbol(sym: string) {
    const upper = sym.toUpperCase();
    if (!upper || selected.includes(upper)) return;
    if (selected.length >= 5) return;
    setSelected([...selected, upper]);
  }
  function removeSymbol(sym: string) {
    setSelected(selected.filter((s) => s !== sym));
  }

  // Radar data: normalize each metric to its rank within the universe.
  // NOTE: this useMemo MUST run before any early return so the hook
  // count stays stable across renders — React requires hooks to be
  // called in the same order every time.
  const radarData = useMemo(() => {
    const dims = [
      { id: "market_cap", label: "Market cap", accessor: (c: CmcCryptocurrency) => c.quote?.USD?.market_cap ?? 0 },
      { id: "volume", label: "Volume 24h", accessor: (c: CmcCryptocurrency) => c.quote?.USD?.volume_24h ?? 0 },
      { id: "turnover", label: "Turnover", accessor: (c: CmcCryptocurrency) =>
          c.quote?.USD?.market_cap && c.quote?.USD?.volume_24h
            ? c.quote.USD.volume_24h / c.quote.USD.market_cap
            : 0
      },
      { id: "perf_24h", label: "24h perf.", accessor: (c: CmcCryptocurrency) => c.quote?.USD?.percent_change_24h ?? 0 },
      { id: "perf_7d", label: "7d perf.", accessor: (c: CmcCryptocurrency) => c.quote?.USD?.percent_change_7d ?? 0 },
      { id: "pairs", label: "Market pairs", accessor: (c: CmcCryptocurrency) => c.num_market_pairs ?? 0 },
    ] as const;
    return dims.map((dim) => {
      const row: Record<string, number | string> = { dim: dim.label };
      for (const c of items) {
        const v = dim.accessor(c);
        // Log-rank normalize across the universe so different scales compare.
        const universeValues = universe
          .map((x) => Math.abs(dim.accessor(x)))
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        if (universeValues.length === 0) {
          row[c.symbol] = 0;
          continue;
        }
        const rank = universeValues.findIndex((n) => n >= Math.abs(v));
        const percentile =
          rank === -1 ? 1 : rank / universeValues.length;
        row[c.symbol] = Math.round(percentile * 100);
      }
      return row;
    });
  }, [items, universe]);

  if (items.length === 0) {
    return (
      <StateBlock
        eyebrow="Compare"
        title="Add at least one asset"
        description="Use the search below to add cryptocurrencies to the comparison."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          eyebrow="Compare"
          title="Side-by-side asset analysis"
          description="Select up to 5 assets. The radar ranks each metric on a 0-100 percentile against the broader universe."
        />
        <PanelBody>
          <div className="space-y-3">
            <Label>Selected assets</Label>
            <div className="flex flex-wrap gap-2">
              {selected.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-2 h-8 px-3 bg-canvas-sunken rounded-[4px] border border-line text-sm"
                >
                  <span className="font-medium text-ink-primary">{s}</span>
                  <button
                    onClick={() => removeSymbol(s)}
                    aria-label={`Remove ${s}`}
                    className="text-ink-tertiary hover:text-ink-primary"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </span>
              ))}
              {selected.length < 5 && (
                <AddSymbolInput universe={universe} onAdd={addSymbol} existing={selected} />
              )}
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Radar" title="Multi-dimensional shape" />
        <div className="p-5">
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#E5E2DA" />
                <PolarAngleAxis dataKey="dim" stroke="#5C5C5C" fontSize={11} />
                <PolarRadiusAxis stroke="#B4B4AE" fontSize={10} tick={false} axisLine={false} />
                {items.map((c, i) => (
                  <Radar
                    key={c.symbol}
                    name={c.symbol}
                    dataKey={c.symbol}
                    stroke={PALETTE[i % PALETTE.length]}
                    fill={PALETTE[i % PALETTE.length]}
                    fillOpacity={0.12}
                    strokeWidth={1.5}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E2DA",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${v}`}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-tertiary mt-3">
            Percentile rank within the top 250 assets by market cap. Each axis
            goes from 0 (lowest in the universe) to 100 (highest).
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Detail" title="Per-asset metrics" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-ink-secondary">
                <th className="text-left font-medium px-4 py-2.5">Metric</th>
                {items.map((c) => (
                  <th key={c.symbol} className="text-right font-medium px-4 py-2.5 tnum">
                    {c.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              <Row label="Price (USD)" items={items} render={(c) => formatPrice(c.quote?.USD?.price)} />
              <Row
                label="Market cap"
                items={items}
                render={(c) => formatUsd(c.quote?.USD?.market_cap, { compact: true })}
              />
              <Row
                label="Volume 24h"
                items={items}
                render={(c) => formatUsd(c.quote?.USD?.volume_24h, { compact: true })}
              />
              <Row
                label="Turnover"
                items={items}
                render={(c) =>
                  c.quote?.USD?.market_cap
                    ? `${((c.quote.USD.volume_24h ?? 0) / c.quote.USD.market_cap * 100).toFixed(2)}%`
                    : "—"
                }
              />
              <Row
                label="24h"
                items={items}
                render={(c) => formatPercent(c.quote?.USD?.percent_change_24h)}
              />
              <Row
                label="7d"
                items={items}
                render={(c) => formatPercent(c.quote?.USD?.percent_change_7d)}
              />
              <Row
                label="30d"
                items={items}
                render={(c) => formatPercent(c.quote?.USD?.percent_change_30d)}
              />
              <Row
                label="Market pairs"
                items={items}
                render={(c) => (c.num_market_pairs ?? 0).toLocaleString()}
              />
              <Row
                label="Listed"
                items={items}
                render={(c) =>
                  c.date_added ? new Date(c.date_added).getFullYear() : "—"
                }
              />
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Row({
  label,
  items,
  render,
}: {
  label: string;
  items: CmcCryptocurrency[];
  render: (c: CmcCryptocurrency) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="text-ink-secondary px-4 py-2.5">{label}</td>
      {items.map((c) => (
        <td key={c.symbol} className="text-right tnum px-4 py-2.5 text-ink-primary">
          {render(c)}
        </td>
      ))}
    </tr>
  );
}

function AddSymbolInput({
  universe,
  onAdd,
  existing,
}: {
  universe: CmcCryptocurrency[];
  onAdd: (s: string) => void;
  existing: string[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const up = q.trim().toUpperCase();
    if (!up) return universe.slice(0, 6);
    return universe
      .filter(
        (c) =>
          !existing.includes(c.symbol.toUpperCase()) &&
          (c.symbol.toUpperCase().startsWith(up) ||
            c.name.toUpperCase().startsWith(up)),
      )
      .slice(0, 6);
  }, [q, universe, existing]);

  return (
    <div className="relative w-[180px]">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Add asset…"
        className="h-8 text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-canvas border border-line rounded-[4px] shadow-lg z-20 overflow-hidden">
          {matches.map((m) => (
            <button
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(m.symbol);
                setQ("");
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-canvas-sunken"
            >
              <span className="font-medium text-ink-primary">{m.symbol}</span>{" "}
              <span className="text-ink-tertiary">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}