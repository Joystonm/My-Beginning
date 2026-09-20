"use client";

import { useEffect, useRef, useState } from "react";
import type { CoinStory } from "@/lib/stories/types";
import { cn } from "@/lib/utils";

interface Props {
  story: CoinStory | null;
  loading: boolean;
  error: string | null;
  /**
   * Where the story came from on the last successful fetch. Used to
   * surface a small "Served from cache" indicator so users understand
   * why a long-tail coin has a story even with thin research.
   */
  source?:
    | "static"
    | "story-cache"
    | "research-cache"
    | "fresh"
    | "fallback"
    | null;
  onRetry?: () => void;
}

/**
 * Editorial "Coin Story" reader.
 *
 * Layout philosophy:
 *
 *   - Generous whitespace. Strong serif-ish display typography for the
 *     title and a single-line hook.
 *   - Short paragraphs. Each paragraph gets a soft reveal animation as
 *     the user scrolls them into view — never a typewriter effect.
 *   - Optional timeline strip sits BELOW the story when there are at
 *     least 2 verifiable dates. Otherwise it stays out of the way.
 *   - Sources sit at the bottom in a subtle, scrollable list. The story
 *     body itself never carries inline citations — that would break the
 *     editorial reading experience.
 */
export function CoinStory({ story, loading, error, source, onRetry }: Props) {
  return (
    <section className="border-t border-line-subtle pt-10 mt-10">
      <header className="max-w-3xl mx-auto text-center mb-8">
        <div className="heading-eyebrow text-ink-tertiary mb-3 flex items-center justify-center gap-3">
          <span>The Story</span>
          {story && source && source !== "fresh" && <SourceBadge source={source} />}
        </div>
        {story ? (
          <>
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-ink-primary leading-tight">
              {story.title}
            </h2>
            <p className="mt-4 text-md text-ink-secondary italic leading-relaxed">
              {story.hook}
            </p>
          </>
        ) : loading ? (
          <>
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-ink-primary">
              Tracing the story…
            </h2>
            <p className="mt-4 text-md text-ink-secondary">
              Finding the moments that shaped this coin.
            </p>
          </>
        ) : error ? (
          <>
            <h2 className="text-2xl font-medium tracking-tight text-ink-primary">
              The story couldn&apos;t be generated right now.
            </h2>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 text-sm text-accent hover:underline"
              >
                Try again
              </button>
            )}
          </>
        ) : null}
      </header>

      {loading && !story && <StorySkeleton />}

      {story && (
        <div className="max-w-3xl mx-auto">
          <article className="space-y-7">
            {story.paragraphs.map((p, i) => (
              <StoryParagraph key={i} text={p} index={i} />
            ))}
          </article>

          {story.timeline.length >= 2 && (
            <StoryTimeline story={story} />
          )}

          {story.sources.length > 0 && (
            <StorySources sources={story.sources} fallback={story.fallback} />
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Paragraph + reveal animation
// ---------------------------------------------------------------------------

function StoryParagraph({ text, index }: { text: string; index: number }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [visible, setVisible] = useState(index === 0);

  useEffect(() => {
    if (index === 0) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <p
      ref={ref}
      className={cn(
        "text-lg leading-[1.7] text-ink-primary tracking-[-0.005em]",
        "transition-opacity duration-slow ease-editorial",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
      )}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function StoryTimeline({ story }: { story: CoinStory }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <div className="mt-12 mb-10 border-t border-line-subtle pt-8">
      <div className="heading-eyebrow mb-4">Timeline</div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-3 h-px bg-line" />
        <div className="flex items-start justify-between gap-2 overflow-x-auto pb-2">
          {story.timeline.map((t, i) => (
            <button
              key={`${t.date}-${i}`}
              type="button"
              onClick={() => setActiveIdx(activeIdx === i ? null : i)}
              className="group relative shrink-0 text-left"
              aria-label={`${t.date}: ${t.label}`}
            >
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full border mx-auto transition-colors duration-180",
                  activeIdx === i
                    ? "bg-accent border-accent"
                    : "bg-canvas border-line-strong group-hover:border-accent",
                )}
              />
              <div className="mt-2 text-2xs font-mono text-ink-secondary tracking-tight whitespace-nowrap">
                {t.date}
              </div>
              <div
                className={cn(
                  "mt-1 text-2xs leading-snug text-ink-tertiary max-w-[120px] line-clamp-2 transition-colors duration-180",
                  activeIdx === i && "text-ink-primary",
                )}
              >
                {t.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function StorySources({
  sources,
  fallback,
}: {
  sources: NonNullable<CoinStory["sources"]>;
  fallback: boolean;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-10 border-t border-line-subtle pt-6">
      <div className="heading-eyebrow mb-3">Sources</div>
      <p className="text-xs text-ink-tertiary mb-3">
        {fallback
          ? "Only a brief fallback sketch was available. The trusted sources we checked couldn't support a fuller story yet."
          : "Grounded in the following sources. Every claim in the story traces back to one of them."}
      </p>
      <ul className="space-y-1.5">
        {sources.slice(0, 8).map((s) => (
          <li key={s.url} className="text-xs">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-secondary hover:text-ink-primary underline-offset-4 hover:underline"
            >
              <span className="font-medium">{s.title || s.domain || s.url}</span>
              {s.domain ? (
                <span className="ml-2 text-ink-tertiary">{s.domain}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StorySkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="h-4 bg-canvas-sunken rounded animate-pulse-soft w-11/12" />
      <div className="h-4 bg-canvas-sunken rounded animate-pulse-soft w-10/12" />
      <div className="h-4 bg-canvas-sunken rounded animate-pulse-soft w-9/12" />
      <div className="h-4 bg-canvas-sunken rounded animate-pulse-soft w-10/12" />
      <div className="h-4 bg-canvas-sunken rounded animate-pulse-soft w-7/12" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceBadge — small indicator showing whether the story was served
// from cache. Hidden when the story was generated fresh this visit.
// ---------------------------------------------------------------------------

function SourceBadge({
  source,
}: {
  source: NonNullable<Props["source"]>;
}) {
  const label =
    source === "static"
      ? "From the archive"
      : source === "story-cache"
        ? "Served from cache"
        : source === "research-cache"
          ? "Reused research"
          : source === "fallback"
            ? "Short sketch"
            : null;
  if (!label) return null;
  return (
    <span
      title={
        source === "static"
          ? "This story was hand-written from verified public sources — served from the project archive."
          : source === "story-cache"
            ? "This story was generated once and is being reused for everyone — saves Tavily + LLM credits."
            : source === "research-cache"
              ? "The research behind this story was cached from an earlier visit — only the LLM was re-run."
              : "Not enough verified history was found to write a longer story."
      }
      className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.14em] text-ink-tertiary border border-line rounded-full px-2 py-0.5"
    >
      <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
      {label}
    </span>
  );
}