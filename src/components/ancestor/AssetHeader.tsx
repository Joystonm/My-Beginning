"use client";

import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { Badge } from "@/components/design-system";
import { formatPercent, formatPrice, formatUsd, marketCapTier } from "@/lib/utils";

export interface TimeframeStrip {
  oneHour: number;
  oneDay: number;
  sevenDay: number;
  thirtyDay: number;
}

/**
 * Compact 4-up change strip (1h · 24h · 7d · 30d). Used by both the
 * standalone AssetHeader and the larger BaseProfilePanel composition.
 */
export function TimeframeStrip({ oneHour, oneDay, sevenDay, thirtyDay }: TimeframeStrip) {
  const cells: Array<{ label: string; value: number }> = [
    { label: "1h", value: oneHour },
    { label: "24h", value: oneDay },
    { label: "7d", value: sevenDay },
    { label: "30d", value: thirtyDay },
  ];
  return (
    <div className="grid grid-cols-4 gap-px bg-line border border-line rounded-[6px] overflow-hidden">
      {cells.map(({ label, value }) => {
        const tone =
          value > 0 ? "text-signal-positive" : value < 0 ? "text-signal-negative" : "text-ink-secondary";
        return (
          <div key={label} className="bg-canvas p-3">
            <div className="heading-eyebrow">{label}</div>
            <div className={["text-sm tnum mt-1.5 tracking-tight", tone].join(" ")}>
              {formatPercent(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AssetHeaderProps {
  asset: CmcCryptocurrency;
  /** When true, render the compact 4-up change strip below the main row. */
  showTimeframeStrip?: boolean;
}

export function AssetHeader({ asset, showTimeframeStrip = false }: AssetHeaderProps) {
  const q = asset.quote.USD;
  const change24h = q?.percent_change_24h ?? 0;
  const tier = marketCapTier(q?.market_cap);
  const strip: TimeframeStrip | null = showTimeframeStrip
    ? {
        oneHour: q?.percent_change_1h ?? 0,
        oneDay: change24h,
        sevenDay: q?.percent_change_7d ?? 0,
        thirtyDay: q?.percent_change_30d ?? 0,
      }
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-y-3 gap-x-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-canvas-sunken border border-line flex items-center justify-center text-xs font-medium text-ink-secondary">
              {asset.symbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <div className="text-2xl font-medium tracking-tight text-ink-primary leading-none">
                  {asset.name}
                </div>
                <TierBadge tier={tier} />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-2xs uppercase tracking-[0.12em] text-ink-tertiary font-medium">
                  {asset.symbol}
                </span>
                {asset.cmc_rank && (
                  <Badge tone="muted" className="ml-1">CMC #{asset.cmc_rank}</Badge>
                )}
                {asset.date_added && (
                  <span className="text-2xs text-ink-tertiary">
                    Listed {new Date(asset.date_added).getFullYear()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-6 sm:gap-7 flex-wrap">
          <Stat label="Price" value={formatPrice(q?.price)} />
          <Stat
            label="24h"
            value={
              <span
                className={
                  change24h > 0
                    ? "text-signal-positive"
                    : change24h < 0
                      ? "text-signal-negative"
                      : "text-ink-secondary"
                }
              >
                {formatPercent(change24h)}
              </span>
            }
          />
          <Stat label="Market cap" value={formatUsd(q?.market_cap, { compact: true })} />
          <Stat label="Volume 24h" value={formatUsd(q?.volume_24h, { compact: true })} />
          <Stat
            label="Vol / MC"
            value={
              q?.market_cap && q?.volume_24h
                ? `${((q.volume_24h / q.market_cap) * 100).toFixed(1)}%`
                : "—"
            }
          />
          <Stat label="Pairs" value={asset.num_market_pairs ?? "—"} />
        </div>
      </div>
      {strip && <TimeframeStrip {...strip} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="heading-eyebrow">{label}</div>
      <div className="text-lg tnum mt-1 text-ink-primary">{value}</div>
    </div>
  );
}

function TierBadge({
  tier,
}: {
  tier: ReturnType<typeof marketCapTier>;
}) {
  const tone =
    tier.tone === "mega"
      ? "bg-accent-soft text-accent-hover border-accent/20"
      : tier.tone === "large"
        ? "bg-[#E7F1EA] text-[#2F7D52] border-[#CFE3D7]"
        : tier.tone === "mid"
          ? "bg-[#F2EFE9] text-[#5C5C5C] border-[#E0DCCD]"
          : tier.tone === "small"
            ? "bg-[#F8F0DC] text-[#9B6B12] border-[#E7D7AB]"
            : "bg-canvas-sunken text-ink-secondary border-line";
  return (
    <span
      className={[
        "inline-flex items-center h-[22px] px-2 text-2xs font-medium border rounded-full",
        tone,
      ].join(" ")}
    >
      {tier.label}
    </span>
  );
}
