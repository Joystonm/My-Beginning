"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { cn, formatUsd } from "@/lib/utils";

interface Props {
  /** Pre-fetched universe (top assets) to power instant search. */
  universe: CmcCryptocurrency[];
  className?: string;
  large?: boolean;
  placeholder?: string;
}

export function AssetSearch({ universe, className, large, placeholder }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return universe.slice(0, 8);
    return universe
      .filter(
        (c) =>
          c.symbol.toUpperCase().startsWith(q) ||
          c.name.toUpperCase().startsWith(q),
      )
      .slice(0, 8);
  }, [query, universe]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function navigate(symbol: string) {
    setOpen(false);
    setQuery("");
    router.push(`/ancestor?symbol=${encodeURIComponent(symbol)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice = matches[highlight] ?? matches[0];
      if (choice) navigate(choice.symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-3 bg-canvas border border-line-strong rounded-[6px] transition-all duration-180",
          large ? "h-14 px-4" : "h-11 px-3",
          open && "border-accent ring-1 ring-accent/30",
        )}
      >
        <svg
          viewBox="0 0 16 16"
          className={cn("shrink-0 text-ink-tertiary", large ? "h-4 w-4" : "h-3.5 w-3.5")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "flex-1 bg-transparent outline-none placeholder:text-ink-tertiary",
            large ? "text-md" : "text-sm",
          )}
          placeholder={placeholder ?? "Search a cryptocurrency — BTC, ETH, SOL…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-ink-tertiary hover:text-ink-secondary"
            aria-label="Clear search"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
        <kbd className="hidden sm:inline-flex h-6 px-1.5 items-center text-2xs text-ink-tertiary border border-line rounded">
          ↵
        </kbd>
      </div>

      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-canvas border border-line rounded-[6px] shadow-lg overflow-hidden z-30 max-h-[60vh] overflow-y-auto">
          {matches.map((m, idx) => (
            <button
              key={m.id}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(m.symbol);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors duration-180",
                idx === highlight ? "bg-canvas-sunken" : "bg-transparent",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 rounded-full bg-canvas-sunken border border-line flex items-center justify-center text-2xs font-medium text-ink-secondary shrink-0">
                  {m.symbol.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-primary truncate">{m.name}</div>
                  <div className="text-2xs uppercase tracking-[0.1em] text-ink-tertiary">{m.symbol}</div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-sm tnum text-ink-primary">
                  {formatUsd(m.quote.USD?.price, { precise: true })}
                </div>
                {m.cmc_rank && (
                  <div className="text-2xs text-ink-tertiary">CMC #{m.cmc_rank}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}