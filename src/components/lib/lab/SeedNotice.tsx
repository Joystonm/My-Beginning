"use client";

import { Badge } from "@/components/design-system";

interface SeedInfo {
  source: "seed";
  message: string;
  count: number;
  handCurated: number;
}

interface Props {
  source: "live" | "seed" | null | undefined;
  seed?: SeedInfo | null;
  className?: string;
}

/**
 * Renders a clear, always-visible badge indicating whether the current
 * Market Lab view is backed by live CoinMarketCap data or by the
 * deterministic development seed.
 *
 * - Live: a small positive "live CMC" pill.
 * - Seed: an amber-toned notice with a short explanation.
 */
export function SeedNotice({ source, seed, className }: Props) {
  if (source === "live") {
    return (
      <Badge tone="positive" dot className={className}>
        Live · CoinMarketCap
      </Badge>
    );
  }
  if (source === "seed") {
    return (
      <div
        className={
          "flex items-start gap-3 rounded-[6px] border border-line bg-[#FAF4E6] px-3.5 py-2.5 " +
          (className ?? "")
        }
        role="status"
        aria-label="Using synthetic seed data"
      >
        <div className="mt-[2px] h-1.5 w-1.5 rounded-full bg-[#B8862F]" aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#6B4D14]">
              Synthetic seed data
            </span>
            <Badge tone="muted" className="!h-[18px] !text-[10px] !px-1.5">
              {seed?.handCurated ?? 50}+{seed ? (seed.count - seed.handCurated) : 0}
            </Badge>
          </div>
          <p className="text-2xs text-[#6B4D14] mt-0.5 leading-snug">
            {seed?.message ??
              "CMC_API_KEY is not configured. Add it to .env.local for live data."}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
