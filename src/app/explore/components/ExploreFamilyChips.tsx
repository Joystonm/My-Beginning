"use client";

import { cn } from "@/lib/utils";
import { FAMILIES, type FamilyId } from "../lib/families";

interface Props {
  value: FamilyId | string;
  onChange: (id: FamilyId) => void;
  /** Live count per family id, computed by the orchestrator. */
  counts: Record<string, number>;
}

/**
 * Chip row above the /explore table.
 *
 * One click filters the table to that family — the curated lineage
 * graph becomes reachable in one tap. Each chip shows the live count
 * of listings in that family so judges can see, at a glance, how
 * many assets descend from BTC vs how many are memecoins.
 */
export function ExploreFamilyChips({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Family filter">
      {FAMILIES.map((f) => {
        const active = value === f.id || (value === "" && f.id === "");
        const count = counts[f.id] ?? 0;
        return (
          <button
            key={f.id || "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f.id as FamilyId)}
            className={cn(
              "group inline-flex items-center gap-2 h-8 pl-3 pr-2.5 rounded-full border transition-colors duration-180",
              active
                ? "bg-ink-primary text-ink-inverse border-ink-primary"
                : "bg-canvas text-ink-secondary border-line hover:border-line-strong hover:text-ink-primary",
            )}
            title={f.description}
          >
            <span className="text-sm">{f.label}</span>
            <span
              className={cn(
                "text-2xs font-mono tnum px-1.5 py-0.5 rounded-full",
                active
                  ? "bg-ink-inverse/15 text-ink-inverse/85"
                  : "bg-canvas-sunken text-ink-tertiary group-hover:bg-canvas",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
