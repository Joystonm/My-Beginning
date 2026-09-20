import { redirect } from "next/navigation";

/**
 * Route alias — the canonical path is /lab; /market-lab redirects there.
 * Preserves query string so deep links work.
 */
export default function MarketLabAlias({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const tail = qs.toString();
  redirect(`/lab${tail ? `?${tail}` : ""}`);
}
