"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export function Tabs({
  tabs,
  defaultId,
  value,
  onChange,
  className,
}: {
  tabs: Tab[];
  defaultId?: string;
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultId ?? tabs[0]?.id ?? "");
  const active = value ?? internal;
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  function handle(id: string) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        className="flex items-center gap-0 border-b border-line -mx-1 px-1 overflow-x-auto"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handle(t.id)}
              className={cn(
                "relative h-9 px-3 text-sm transition-colors duration-180 whitespace-nowrap",
                isActive ? "text-ink-primary" : "text-ink-secondary hover:text-ink-primary",
              )}
            >
              {t.label}
              {isActive && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-ink-primary" />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{current?.content}</div>
    </div>
  );
}