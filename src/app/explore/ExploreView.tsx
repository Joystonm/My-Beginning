"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eyebrow, Skeleton, StateBlock } from "@/components/design-system";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { descendantsOf } from "@/lib/ancestor/lineage";
import {
  kindForSymbol,
  type AssetKind,
} from "@/lib/ancestor/category";
import {
  DEFAULT_FILTERS,
  applyFilters,
  buildSearchParams,
  computeInsights,
  nextSort,
  parseFilters,
  type ExploreFilters,
  type SortKey,
} from "./lib/exploreFilters";
import { FAMILIES, getFamilyById } from "./lib/families";
import { ExploreFamilyChips } from "./components/ExploreFamilyChips";
import { ExploreFilters as ExploreFiltersPanel } from "./components/ExploreFilters";
import { ExploreInsights } from "./components/ExploreInsights";
import { ExploreTable, type SparklineMap } from "./components/ExploreTable";
import { buildSparkline } from "./components/ExploreSparkline";

/** How many rows from the top get a sparkline fetch on load. */
const SPARKLINE_BATCH = 12;
/** Debounce for the search input → URL write. */
const Q_DEBOUNCE_MS = 250;

/**
 * Orchestrator for /explore.
 *
 * Owns:
 *   - the listings fetch (one shot on mount)
 *   - the URL-derived filter state
 *   - the sparkline result map
 *
 * Writes the URL via a single useEffect with a shallow-equality guard,
 * debouncing `q` so typing doesn't spam history.
 */
export function ExploreView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<CmcCryptocurrency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters — derived from the URL on first render, then held as React
  // state. The single useEffect below mirrors them back to the URL.
  const [filters, setFilters] = useState<ExploreFilters>(() =>
    parseFilters(searchParams),
  );

  // Sparkline cache — keyed by symbol. Values:
  //   - "loading"   fetch in flight
  //   - "missing"   API confirmed no data
  //   - SparklineSeries  ready
  const [sparklines, setSparklines] = useState<SparklineMap>(new Map());

  // Listings fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cmc/listings?limit=250");
        const json = (await res.json()) as {
          data?: CmcCryptocurrency[];
          error?: string;
        };
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

  // Derived — apply filters + family intersection.
  const family = getFamilyById(filters.category);
  const { rows, familySize, totalSize } = useMemo(
    () => applyFilters(listings, family, filters),
    [listings, family, filters],
  );
  const insights = useMemo(() => computeInsights(rows), [rows]);

  // Family counts — pre-compute once per listings change. Used to
  // badge each chip with its in-listings size.
  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FAMILIES) {
      // The All chip shows total listings; the rest show their family size.
      if (f.id === "") {
        counts[f.id] = listings.length;
        continue;
      }
      if (f.shape === "root" && f.root) {
        const set = computeRootSet(f.root, listings);
        counts[f.id] = set.size;
      } else if (f.shape === "kind" && f.kind) {
        counts[f.id] = computeKindSet(f.kind, listings).size;
      } else {
        counts[f.id] = 0;
      }
    }
    return counts;
  }, [listings]);

  // Sparklines — fetch the first N visible rows after listings settle.
  // Re-fetch if the filter narrows the universe to fewer than N rows so
  // every row gets a chart. We never re-fetch rows past SPARKLINE_BATCH.
  const sparklineSymbols = useMemo(
    () => rows.slice(0, SPARKLINE_BATCH).map((c) => c.symbol.toUpperCase()),
    [rows],
  );
  useEffect(() => {
    if (sparklineSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      // Mark loading for missing entries only.
      setSparklines((prev) => {
        const next = new Map(prev);
        let dirty = false;
        for (const sym of sparklineSymbols) {
          if (!next.has(sym)) {
            next.set(sym, "loading");
            dirty = true;
          }
        }
        return dirty ? next : prev;
      });
      try {
        const res = await fetch("/api/cmc/historical", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symbols: sparklineSymbols, days: 7 }),
        });
        const json = (await res.json()) as {
          data?: Array<{
            symbol: string;
            series: { t: number; value: number }[];
            error?: string;
          }>;
        };
        if (cancelled) return;
        setSparklines((prev) => {
          const next = new Map(prev);
          for (const sym of sparklineSymbols) {
            const found = json.data?.find(
              (d) => d.symbol.toUpperCase() === sym,
            );
            const built = buildSparkline(found?.series);
            next.set(sym, built ?? "missing");
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setSparklines((prev) => {
          const next = new Map(prev);
          for (const sym of sparklineSymbols) next.set(sym, "missing");
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally don't depend on `sparklines` — only the visible
    // symbol list. The effect itself updates the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparklineSymbols.join(",")]);

  // URL writer — single source of truth. Debounces `q`.
  const lastWrittenRef = useRef<string>("");
  useEffect(() => {
    const next = buildSearchParams(filters);
    const nextString = next.toString();
    if (nextString === searchParams.toString()) return;
    if (nextString === lastWrittenRef.current) return;
    const handle = window.setTimeout(() => {
      const qs = nextString ? `?${nextString}` : "";
      lastWrittenRef.current = nextString;
      router.replace(`${pathname}${qs}`, { scroll: false });
    }, Q_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // searchParams is intentionally excluded — we only WRITE here, and
    // including it would re-trigger on every URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pathname, router]);

  // Loading / error states.
  if (loading) {
    return (
      <div className="py-10">
        <Eyebrow>Explore</Eyebrow>
        <Skeleton className="mt-6 h-[400px] w-full" />
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
    <div className="py-10 sm:py-14 space-y-8">
      {/* Title */}
      <section>
        <Eyebrow>Explore</Eyebrow>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary">
            The cryptocurrency universe
          </h1>
          <p className="text-sm text-ink-secondary max-w-md">
            {familySize} of {totalSize} assets · sorted and filtered in real
            time from CoinMarketCap data.
          </p>
        </div>
      </section>

      {/* Insight strip — the "5-second wow". */}
      <ExploreInsights insights={insights} />

      {/* Family chips — curated graph in one tap. */}
      <ExploreFamilyChips
        value={filters.category}
        onChange={(id) => setFilters((f) => ({ ...f, category: id }))}
        counts={familyCounts}
      />

      {/* Sidebar + table */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        <aside>
          <ExploreFiltersPanel
            state={filters}
            onChange={(patch) =>
              setFilters((prev) => ({ ...prev, ...patch }))
            }
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
        </aside>
        <section>
          <p className="text-sm text-ink-secondary mb-3">
            Showing{" "}
            <span className="text-ink-primary font-medium">{rows.length}</span>{" "}
            of{" "}
            <span className="text-ink-primary font-medium">{listings.length}</span>
          </p>
          <ExploreTable
            rows={rows}
            sortKey={filters.sort}
            direction={filters.direction}
            density={filters.density}
            sparklines={sparklines}
            visibleSparklineCount={Math.min(rows.length, SPARKLINE_BATCH)}
            onSort={(key: SortKey) =>
              setFilters((prev) => ({
                ...prev,
                ...nextSort(
                  { key: prev.sort, direction: prev.direction },
                  key,
                ),
              }))
            }
            onDensityToggle={(d) =>
              setFilters((prev) => ({ ...prev, density: d }))
            }
          />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Family-count helpers — kept here (not in lib/families.ts) so we can
// compute all chip counts in a single O(N) pass per listings change
// instead of O(N × |FAMILIES|). The lib/families.ts symbolsInFamily()
// stays authoritative for the per-click row filter.
// ---------------------------------------------------------------------------

function computeRootSet(
  root: string,
  listings: readonly CmcCryptocurrency[],
): Set<string> {
  const desc = descendantsOf(root, 8);
  return new Set(
    listings
      .filter((c) => desc.has(c.symbol.toUpperCase()))
      .map((c) => c.symbol.toUpperCase()),
  );
}

function computeKindSet(
  want: AssetKind,
  listings: readonly CmcCryptocurrency[],
): Set<string> {
  return new Set(
    listings
      .filter((c) => {
        const kind = kindForSymbol(c.symbol, null, c.tags ?? null);
        return kind === want;
      })
      .map((c) => c.symbol.toUpperCase()),
  );
}
