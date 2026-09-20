"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eyebrow,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonPanel,
  StateBlock,
} from "@/components/design-system";
import { AssetSearch } from "@/components/ancestor/AssetSearch";
import { BaseProfilePanel } from "@/components/ancestor/BaseProfilePanel";
import { LineageGraph } from "@/components/ancestor/LineageGraph";
import { AncestorCard } from "@/components/ancestor/AncestorCard";
import { RadarProfile } from "@/components/ancestor/RadarProfile";
import { UniverseContext } from "@/components/ancestor/UniverseContext";
import {
  HistoricalComparison,
  type HistoricalSeries,
} from "@/components/ancestor/HistoricalComparison";
import { CoinStory } from "@/components/ancestor/CoinStory";
import { LineageBreadcrumb } from "@/components/ancestor/LineageBreadcrumb";
import { LineageDriftCard } from "@/components/ancestor/LineageDriftCard";
import type { LineageResult } from "@/lib/ancestor/types";
import type { LineageDrift } from "@/lib/ancestor/drift";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import type { CoinStory as CoinStoryT } from "@/lib/stories/types";
import { extractRawFeatures, normalizeUniverse } from "@/lib/ancestor/normalize";
import type { NormalizedFeatures } from "@/lib/ancestor/types";
import { getUniverseMedian } from "@/lib/ancestor/ui-helpers";
import { addAsset, createUniverse, listUniverses } from "@/lib/universes";
import { cn, timeAgo } from "@/lib/utils";

type Phase = "idle" | "searching" | "loading" | "ready" | "error";

interface UniverseState {
  data: CmcCryptocurrency[];
  loadedAt: number | null;
  error: string | null;
}

interface HistoricalState {
  series: HistoricalSeries[];
  days: number;
  loadedAt: number | null;
  error: string | null;
}

interface StoryState {
  story: CoinStoryT | null;
  loading: boolean;
  error: string | null;
  /**
   * Where the story came from on the last successful fetch:
   *   - "static"        → served from the curated archive (top 20 coins)
   *   - "story-cache"  → served from a prior visitor's persisted story
   *   - "research-cache" → reused cached research, ran the LLM
   *   - "fresh"        → ran Tavily + LLM this time
   *   - "fallback"     → neither LLM nor research produced a story
   *   - null           → no fetch attempted yet
   */
  source:
    | "static"
    | "story-cache"
    | "research-cache"
    | "fresh"
    | "fallback"
    | null;
  /** Iteration token — bump to retry. */
  nonce: number;
}

interface DriftState {
  drift: LineageDrift | null;
  loading: boolean;
  error: string | null;
}

const HISTORICAL_DAYS = 30;

export function AncestorExperience() {
  return (
    <Suspense fallback={null}>
      <AncestorExperienceInner />
    </Suspense>
  );
}

function AncestorExperienceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get("symbol");
  const symbol = symbolParam ? symbolParam.toUpperCase() : null;

  const [universe, setUniverse] = useState<UniverseState>({
    data: [],
    loadedAt: null,
    error: null,
  });
  const [phase, setPhase] = useState<Phase>(symbol ? "loading" : "idle");
  const [lineage, setLineage] = useState<LineageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAncestor, setSelectedAncestor] = useState<number | null>(null);
  const [historical, setHistorical] = useState<HistoricalState>({
    series: [],
    days: HISTORICAL_DAYS,
    loadedAt: null,
    error: null,
  });
  const [lineageStack, setLineageStack] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [storyState, setStoryState] = useState<StoryState>({
    story: null,
    loading: false,
    error: null,
    source: null,
    nonce: 0,
  });
  const [driftState, setDriftState] = useState<DriftState>({
    drift: null,
    loading: false,
    error: null,
  });

  // Load universe (for autocomplete + base asset profile + radar context)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cmc/listings?limit=100");
        const json = (await res.json()) as
          | { data?: CmcCryptocurrency[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setUniverse({
            data: [],
            loadedAt: null,
            error: json.error ?? "Failed to load universe.",
          });
          return;
        }
        setUniverse({ data: json.data ?? [], loadedAt: Date.now(), error: null });
      } catch (err) {
        if (cancelled) return;
        setUniverse({
          data: [],
          loadedAt: null,
          error: err instanceof Error ? err.message : "Failed to load universe.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load lineage when symbol changes
  useEffect(() => {
    if (!symbol) {
      setPhase("idle");
      setLineage(null);
      setError(null);
      setHistorical({ series: [], days: HISTORICAL_DAYS, loadedAt: null, error: null });
      setDriftState({ drift: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setError(null);
    setSelectedAncestor(null);
    (async () => {
      try {
        const res = await fetch("/api/ancestor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, limit: 250 }),
        });
        const json = (await res.json()) as
          | (LineageResult & { source?: string; seed?: unknown; classifier?: unknown })
          | { error: string; hint?: string };
        if (cancelled) return;
        if (!res.ok) {
          const message = "error" in json ? json.error : "Failed to find ancestor.";
          setError(message);
          setPhase("error");
          return;
        }
        setLineage(json as LineageResult);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unexpected error.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Load historical for the base asset (no peer overlay in v2 — lineage is
  // about the base's story).
  useEffect(() => {
    if (phase !== "ready" || !lineage || !symbol) return;
    let cancelled = false;
    setHistorical((s) => ({ ...s, error: null }));
    (async () => {
      try {
        const res = await fetch("/api/cmc/historical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: [symbol], days: HISTORICAL_DAYS }),
        });
        const json = (await res.json()) as
          | { data?: HistoricalSeries[]; days?: number; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setHistorical({
            series: [],
            days: HISTORICAL_DAYS,
            loadedAt: null,
            error: json.error ?? "Historical data unavailable.",
          });
          return;
        }
        setHistorical({
          series: json.data ?? [],
          days: json.days ?? HISTORICAL_DAYS,
          loadedAt: Date.now(),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setHistorical({
          series: [],
          days: HISTORICAL_DAYS,
          loadedAt: null,
          error: err instanceof Error ? err.message : "Historical fetch failed.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, lineage, symbol]);

  // Load lineage drift — the "what's moving in the family" headline.
  // Independent of the story fetch; allowed to fail without breaking
  // the rest of the page.
  useEffect(() => {
    if (phase !== "ready" || !lineage || !symbol) {
      setDriftState({ drift: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setDriftState({ drift: null, loading: true, error: null });
    (async () => {
      try {
        const res = await fetch("/api/ancestor/drift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, limit: 250, windowDays: 30 }),
        });
        const json = (await res.json()) as
          | { drift?: LineageDrift; error?: string }
          | { error: string };
        if (cancelled) return;
        if (!res.ok) {
          setDriftState({
            drift: null,
            loading: false,
            error:
              "error" in json && typeof json.error === "string"
                ? json.error
                : "Drift unavailable.",
          });
          return;
        }
        setDriftState({
          drift: "drift" in json ? json.drift ?? null : null,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setDriftState({
          drift: null,
          loading: false,
          error: err instanceof Error ? err.message : "Drift lookup failed.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, lineage, symbol]);

  // Load the story independently of the lineage. The story is allowed to
  // fail without breaking the rest of the page.
  useEffect(() => {
    if (phase !== "ready" || !lineage || !symbol) {
      setStoryState({ story: null, loading: false, error: null, source: null, nonce: 0 });
      return;
    }
    let cancelled = false;
    setStoryState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const res = await fetch("/api/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: lineage.base,
            name: lineage.base_name,
          }),
        });
        const json = (await res.json()) as
          | { story?: CoinStoryT; source?: StoryState["source"]; error?: string }
          | { error: string };
        if (cancelled) return;
        if (!res.ok || !("story" in json) || !json.story) {
          setStoryState({
            story: null,
            loading: false,
            error:
              "error" in json && typeof json.error === "string"
                ? json.error
                : "Story unavailable.",
            source: null,
            nonce: storyState.nonce,
          });
          return;
        }
        const source =
          "source" in json && json.source ? json.source : null;
        setStoryState({
          story: json.story,
          loading: false,
          error: null,
          source,
          nonce: storyState.nonce,
        });
      } catch (err) {
        if (cancelled) return;
        setStoryState({
          story: null,
          loading: false,
          error: err instanceof Error ? err.message : "Story lookup failed.",
          source: null,
          nonce: storyState.nonce,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // storyState.nonce intentionally not in deps — retry is a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lineage, symbol]);

  const handleRetryStory = useCallback(() => {
    setStoryState((s) => ({
      story: null,
      loading: false,
      error: null,
      source: null,
      nonce: s.nonce + 1,
    }));
    // Bumping the nonce triggers the same effect to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry effect — listens to nonce.
  useEffect(() => {
    if (storyState.nonce === 0) return;
    if (phase !== "ready" || !lineage || !symbol) return;
    let cancelled = false;
    setStoryState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const res = await fetch("/api/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: lineage.base,
            name: lineage.base_name,
            forceRefresh: true,
          }),
        });
        const json = (await res.json()) as
          | { story?: CoinStoryT; source?: StoryState["source"]; error?: string };
        if (cancelled) return;
        if (!res.ok || !("story" in json) || !json.story) {
          setStoryState({
            story: null,
            loading: false,
            error:
              "error" in json && typeof json.error === "string"
                ? json.error
                : "Story unavailable.",
            source: null,
            nonce: storyState.nonce,
          });
          return;
        }
        const source =
          "source" in json && json.source ? json.source : null;
        setStoryState({
          story: json.story,
          loading: false,
          error: null,
          source,
          nonce: storyState.nonce,
        });
      } catch (err) {
        if (cancelled) return;
        setStoryState({
          story: null,
          loading: false,
          error: err instanceof Error ? err.message : "Story lookup failed.",
          source: null,
          nonce: storyState.nonce,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyState.nonce]);

  const handleSelect = useCallback(
    (next: string) => {
      const upper = next.trim().toUpperCase();
      if (!upper) {
        router.replace("/ancestor", { scroll: false });
        setLineageStack([]);
        return;
      }
      setLineageStack((prev) => {
        if (!symbol || symbol === upper) return prev;
        return [...prev, symbol];
      });
      router.replace(`/ancestor?symbol=${encodeURIComponent(upper)}`, {
        scroll: false,
      });
    },
    [router, symbol],
  );

  const handleJumpBack = useCallback(
    (target: string) => {
      const upper = target.trim().toUpperCase();
      setLineageStack((prev) => {
        const idx = prev.findIndex((s) => s.toUpperCase() === upper);
        return idx === -1 ? prev : prev.slice(0, idx);
      });
      router.replace(`/ancestor?symbol=${encodeURIComponent(upper)}`, {
        scroll: false,
      });
    },
    [router],
  );

  const handleDrillDown = useCallback(
    (next: string) => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      handleSelect(next);
    },
    [handleSelect],
  );

  const baseAsset = useMemo(() => {
    if (!lineage) return null;
    return (
      universe.data.find(
        (c) => c.symbol.toUpperCase() === lineage.base,
      ) ?? null
    );
  }, [lineage, universe.data]);

  const { baseFeatures, universeFeatures, median } = useMemo(() => {
    if (!lineage || universe.data.length === 0) {
      return {
        baseFeatures: null,
        universeFeatures: [] as NormalizedFeatures[],
        median: null,
      };
    }
    const raw = universe.data.map(extractRawFeatures);
    const features = normalizeUniverse(raw);
    const base =
      features.find((f) => f.symbol.toUpperCase() === lineage.base) ?? null;
    return {
      baseFeatures: base,
      universeFeatures: features,
      median: getUniverseMedian(features),
    };
  }, [lineage, universe.data]);

  const handleSaveToUniverse = useCallback(async () => {
    if (!lineage || !baseAsset) return;
    try {
      let universes = await listUniverses();
      if (universes.length === 0) {
        const created = await createUniverse({
          name: `${lineage.base} lineage`,
          description: `Auto-saved while exploring ${lineage.base}'s lineage.`,
        });
        if (created) universes = [created];
      }
      const target = universes[0];
      if (!target) return;
      const updated = await addAsset(target.id, {
        cmcId: baseAsset.id,
        symbol: baseAsset.symbol,
        name: baseAsset.name,
      });
      if (updated) {
        setSavedFlash(`Saved to “${updated.name}”`);
        setTimeout(() => setSavedFlash(null), 2000);
      } else {
        setSavedFlash("Save failed — try again");
        setTimeout(() => setSavedFlash(null), 2000);
      }
    } catch {
      setSavedFlash("Save failed — try again");
      setTimeout(() => setSavedFlash(null), 2000);
    }
  }, [lineage, baseAsset]);

  return (
    <div className="py-10 sm:py-14" ref={useRef<HTMLDivElement | null>(null)}>
      {/* Hero / search */}
      <section>
        <Eyebrow>Ancestor engine · v2</Eyebrow>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary max-w-xl">
            Who is my ancestor?
          </h1>
          <p className="text-sm text-ink-secondary max-w-md">
            Select an asset. Read its story. Discover where it sits in the
            crypto universe — and what came before it.
          </p>
        </div>

        <div className="mt-6 max-w-2xl">
          <AssetSearch
            universe={universe.data}
            large
            placeholder={
              universe.error
                ? "Add CMC_API_KEY to enable search"
                : "Try BTC, ETH, SOL, DOGE, USDT…"
            }
          />
          {universe.error && (
            <p className="mt-2 text-xs text-signal-negative">
              {universe.error} Set{" "}
              <code className="font-mono">CMC_API_KEY</code> in{" "}
              <code className="font-mono">.env.local</code> and restart.
            </p>
          )}
        </div>

        {symbol && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-secondary">
            {lineageStack.length > 0 && (
              <LineageBreadcrumb
                stack={lineageStack.map((s) => ({ symbol: s }))}
                current={symbol}
                onJump={handleJumpBack}
              />
            )}
            {lineage && (
              <span className="flex items-center gap-2 ml-auto">
                <span className="heading-eyebrow">Calculated</span>
                <span>{timeAgo(lineage.calculated_at)}</span>
                <span className="text-ink-tertiary">·</span>
                <span className="font-mono">v{lineage.algorithm_version}</span>
              </span>
            )}
          </div>
        )}

        {savedFlash && (
          <p className="mt-2 text-xs text-signal-positive">{savedFlash}</p>
        )}
      </section>

      {/* Content */}
      <section className="mt-10">
        {phase === "idle" && <IdleHint />}
        {phase === "loading" && <LoadingSkeleton />}
        {phase === "error" && (
          <StateBlock
            eyebrow="Ancestor not found"
            title={error ?? "Something went wrong."}
            description={
              <span>
                The asset may not be in the top 250 by market cap, or the CMC
                API returned an error.{" "}
                <Link href="/ancestor" className="text-accent hover:underline">
                  Reset
                </Link>
                .
              </span>
            }
            tone="error"
          />
        )}
        {phase === "ready" && lineage && (
          <ReadyView
            lineage={lineage}
            baseAsset={baseAsset}
            baseFeatures={baseFeatures}
            universeFeatures={universeFeatures}
            median={median}
            selectedAncestor={selectedAncestor}
            onSelectAncestor={setSelectedAncestor}
            onDrillDown={handleDrillDown}
            historical={historical}
            onSaveToUniverse={handleSaveToUniverse}
            story={storyState.story}
            storyLoading={storyState.loading}
            storyError={storyState.error}
            storySource={storyState.source}
            onRetryStory={handleRetryStory}
            drift={driftState.drift}
            driftLoading={driftState.loading}
            driftError={driftState.error}
          />
        )}
      </section>
    </div>
  );
}

interface ReadyViewProps {
  lineage: LineageResult;
  baseAsset: CmcCryptocurrency | null;
  baseFeatures: import("@/lib/ancestor/types").NormalizedFeatures | null;
  universeFeatures: NormalizedFeatures[];
  median: ReturnType<typeof getUniverseMedian> | null;
  selectedAncestor: number | null;
  onSelectAncestor: (i: number | null) => void;
  onDrillDown: (symbol: string) => void;
  historical: HistoricalState;
  onSaveToUniverse: () => void;
  story: CoinStoryT | null;
  storyLoading: boolean;
  storyError: string | null;
  storySource:
    | "static"
    | "story-cache"
    | "research-cache"
    | "fresh"
    | "fallback"
    | null;
  onRetryStory: () => void;
  drift: LineageDrift | null;
  driftLoading: boolean;
  driftError: string | null;
}

function ReadyView({
  lineage,
  baseAsset,
  baseFeatures,
  universeFeatures,
  median,
  selectedAncestor,
  onSelectAncestor,
  onDrillDown,
  historical,
  onSaveToUniverse,
  story,
  storyLoading,
  storyError,
  storySource,
  onRetryStory,
  drift,
  driftLoading,
  driftError,
}: ReadyViewProps) {
  const ancestors = lineage.ancestors;
  const edges = lineage.edges;
  const noAncestors = lineage.meta?.noAncestors ?? false;

  return (
    <div className="space-y-10">
      {/* Base asset profile */}
      {baseAsset && (
        <BaseProfilePanel
          asset={baseAsset}
          onSaveToUniverse={onSaveToUniverse}
        />
      )}

      {/* Story — the centerpiece. Always rendered. */}
      <CoinStory
        story={story}
        loading={storyLoading}
        error={storyError}
        source={storySource}
        onRetry={onRetryStory}
      />

      {/* Lineage — the main answer */}
      <Panel>
        <PanelHeader
          eyebrow={
            noAncestors
              ? "Lineage · no ancestors"
              : `My ancestors · ${ancestors.length}`
          }
          title={
            noAncestors
              ? `${lineage.base_name} is the original.`
              : `From ${lineage.base_name} to ${lineage.lineage_chain[lineage.lineage_chain.length - 1] ?? "—"}`
          }
          description={
            noAncestors
              ? lineage.meta?.noAncestorsReason ??
                "No lineage edges found in the graph or via Tavily."
              : `A chain of ${ancestors.length} ancestor step${ancestors.length === 1 ? "" : "s"}. Each step shows the relation (fork, platform, wrapped, inspiration) and the confidence in the claim.`
          }
        />

        {noAncestors ? (
          <PanelBody>
            <NoLineageState lineage={lineage} />
          </PanelBody>
        ) : (
          <div className="p-3 sm:p-5 overflow-x-auto">
            <LineageGraph
              baseSymbol={lineage.base}
              baseName={lineage.base_name}
              ancestors={ancestors}
              edges={edges}
              selectedIndex={selectedAncestor}
              onSelectAncestor={(i) =>
                onSelectAncestor(selectedAncestor === i ? null : i)
              }
            />
          </div>
        )}
      </Panel>

      {/* Base asset fingerprint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RadarProfile base={baseFeatures} median={median} />
        <UniverseContext base={baseFeatures} universe={universeFeatures} />
      </div>

      {/* Lineage drift — "what's moving in the family" */}
      {(drift || driftLoading || driftError) && (
        <LineageDriftCard
          drift={drift}
          loading={driftLoading}
          error={driftError}
          onSelectSymbol={onDrillDown}
        />
      )}

      {/* Historical (base only) */}
      <HistoricalComparison
        baseSymbol={lineage.base}
        baseName={lineage.base_name}
        series={historical.series}
        days={historical.days}
      />

      {/* Ancestor cards — one per direct ancestor edge */}
      {ancestors.length > 0 && (
        <div>
          <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
            <div>
              <Eyebrow>My ancestors · step by step</Eyebrow>
              <h2 className="text-xl font-medium tracking-tight mt-1.5">
                {ancestors.length} ancestor{ancestors.length === 1 ? "" : "s"}
              </h2>
            </div>
            <Link
              href="/lab?tab=evidence"
              className="text-xs text-ink-secondary hover:text-ink-primary"
            >
              See the API evidence →
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {ancestors.map((a, i) => (
              <div
                key={`${a.symbol}-${i}`}
                className={cn(
                  "transition-opacity duration-180",
                  selectedAncestor !== null && selectedAncestor !== i && "opacity-60",
                )}
              >
                <AncestorCard
                  ancestor={a}
                  index={i}
                  baseSymbol={lineage.base}
                  onDrillDown={onDrillDown}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoLineageState({ lineage }: { lineage: LineageResult }) {
  const reason =
    lineage.meta?.noAncestorsReason ??
    `${lineage.base_name} has no lineage edges in our curated graph, and Tavily didn't surface a clear ancestor either.`;
  return (
    <div className="max-w-2xl">
      <p className="heading-eyebrow mb-3">Why no ancestors?</p>
      <p className="text-md text-ink-primary leading-relaxed">{reason}</p>
      <p className="text-sm text-ink-secondary leading-relaxed mt-4">
        The lineage engine walks a curated ancestor graph of code forks,
        platform tokens, wrapped tokens, inspiration chains, and conceptual
        lineage. When no edge exists in the graph and Tavily can&apos;t find one
        either, the engine reports an empty lineage rather than inventing a
        relationship. That is the honest answer.
      </p>
    </div>
  );
}

function IdleHint() {
  return (
    <div className="rounded-[6px] border border-line bg-canvas-sunken/40 p-8 max-w-2xl">
      <h2 className="text-md font-medium text-ink-primary mb-2">
        How the lineage engine works
      </h2>
      <ol className="space-y-2 text-sm text-ink-secondary list-decimal pl-5">
        <li>
          The server fetches the top 250 assets from CoinMarketCap&apos;s{" "}
          <code className="font-mono text-xs">/listings/latest</code> endpoint.
        </li>
        <li>
          We walk a curated ancestor graph — code forks (LTC ← BTC, DOGE ←
          LTC), platform tokens (USDT/SHIB/LINK → ETH, BONK/WIF → SOL),
          wrapped versions (WETH → ETH, WBTC → BTC), and inspiration chains
          (SOL → ETH → BTC).
        </li>
        <li>
          For coins not in the curated graph, we ask Tavily what they were
          forked from / descended from and parse the response.
        </li>
      </ol>
      <p className="text-xs text-ink-tertiary mt-5">
        Built for the CoinMarketCap × DoraHacks API Hackathon · Track: Data &amp;
        Visualisation
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPanel rows={3} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonPanel rows={6} />
        <SkeletonPanel rows={6} />
      </div>
      <SkeletonPanel rows={6} />
    </div>
  );
}