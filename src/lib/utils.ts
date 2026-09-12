/**
 * Small, dependency-free helpers.
 */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a USD number with editorial precision. */
export function formatUsd(value: number | null | undefined, opts?: {
  compact?: boolean;
  precise?: boolean;
}): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const { compact = false, precise = false } = opts ?? {};
  if (compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: precise ? 2 : 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: precise ? 4 : 2,
  }).format(value);
}

/** Format a price with up to N significant digits. */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  const abs = Math.abs(value);
  let maxFractionDigits = 2;
  if (abs < 0.0001) maxFractionDigits = 8;
  else if (abs < 0.01) maxFractionDigits = 6;
  else if (abs < 1) maxFractionDigits = 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** Format a percent. Negative numbers get a minus sign; positive get a +. */
export function formatPercent(value: number | null | undefined, opts?: {
  digits?: number;
  signed?: boolean;
}): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = opts?.digits ?? 2;
  const signed = opts?.signed ?? true;
  const formatted = `${Math.abs(value).toFixed(digits)}%`;
  if (!signed) return formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

/** Format a relative time, e.g. "2m ago". */
export function timeAgo(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return seconds <= 0 ? "just now" : "in a moment";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Stable short id (no deps). */
export function shortId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Mask a string except the last N characters (for API key evidence). */
export function maskTail(value: string, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return value;
  return `${"•".repeat(Math.max(8, value.length - visible))}${value.slice(-visible)}`;
}

/** Truncate with ellipsis. */
export function truncate(value: string, length = 80): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

/** Pick a deterministic bucket from a number for color/category mapping. */
export function bucket(value: number, buckets: number): number {
  if (buckets <= 1) return 0;
  return clamp(Math.floor(value * buckets), 0, buckets - 1);
}

/**
 * Format a value relative to a base (default 100).
 * e.g. formatRelative(103.4) → "+3.4%"; formatRelative(97) → "−3.0%".
 * Used by the normalised historical comparison chart.
 */
export function formatRelative(
  value: number | null | undefined,
  base = 100,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const delta = ((value - base) / base) * 100;
  if (Math.abs(delta) < 0.05) return `${value.toFixed(1)}`;
  if (delta > 0) return `${value.toFixed(1)} (+${delta.toFixed(1)}%)`;
  return `${value.toFixed(1)} (−${Math.abs(delta).toFixed(1)}%)`;
}

/**
 * Map a market-cap value to an editorial tier label.
 */
export function marketCapTier(
  marketCap: number | null | undefined,
): { label: string; tone: "mega" | "large" | "mid" | "small" | "micro" } {
  if (marketCap == null || !Number.isFinite(marketCap) || marketCap <= 0) {
    return { label: "Unranked", tone: "micro" };
  }
  if (marketCap >= 100_000_000_000) return { label: "Mega-cap", tone: "mega" };
  if (marketCap >= 10_000_000_000) return { label: "Large-cap", tone: "large" };
  if (marketCap >= 1_000_000_000) return { label: "Mid-cap", tone: "mid" };
  if (marketCap >= 100_000_000) return { label: "Small-cap", tone: "small" };
  return { label: "Micro-cap", tone: "micro" };
}