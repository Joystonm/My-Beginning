import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "positive" | "negative" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas-sunken text-ink-primary border-line",
  accent: "bg-accent-soft text-accent-hover border-accent/20",
  positive: "bg-[#E7F1EA] text-[#2F7D52] border-[#CFE3D7]",
  negative: "bg-[#F8E6E2] text-[#B8412F] border-[#ECC9C2]",
  muted: "bg-transparent text-ink-secondary border-line",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2 text-2xs font-medium border rounded-full",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "positive" && "bg-signal-positive",
            tone === "negative" && "bg-signal-negative",
            tone === "accent" && "bg-accent",
            tone === "neutral" && "bg-ink-tertiary",
            tone === "muted" && "bg-ink-tertiary",
          )}
        />
      )}
      {children}
    </span>
  );
}