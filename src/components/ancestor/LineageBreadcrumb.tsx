"use client";

interface Crumb {
  symbol: string;
  name?: string;
}

interface Props {
  /** Root-first lineage stack, e.g. ["BTC", "ETH", "ARB"]. */
  stack: Crumb[];
  current: string;
  onJump: (symbol: string) => void;
  className?: string;
}

/**
 * Clickable lineage history. Each crumb is a previous base asset;
 * clicking pops the navigation back to that point.
 */
export function LineageBreadcrumb({ stack, current, onJump, className }: Props) {
  if (stack.length === 0) return null;

  return (
    <nav
      aria-label="Lineage history"
      className={[
        "flex items-center gap-1.5 flex-wrap text-xs",
        className ?? "",
      ].join(" ")}
    >
      <span className="heading-eyebrow mr-1">Lineage</span>
      {stack.map((c, i) => {
        const isCurrent = c.symbol.toUpperCase() === current.toUpperCase();
        return (
          <span key={`${c.symbol}-${i}`} className="flex items-center gap-1.5">
            <button
              onClick={() => onJump(c.symbol)}
              disabled={isCurrent}
              className={
                isCurrent
                  ? "font-medium text-ink-primary"
                  : "text-ink-secondary hover:text-ink-primary underline-offset-4 hover:underline transition-colors duration-180"
              }
            >
              {c.symbol}
            </button>
            <span className="text-ink-tertiary" aria-hidden>
              →
            </span>
          </span>
        );
      })}
      <span className="font-medium text-ink-primary">{current}</span>
    </nav>
  );
}
