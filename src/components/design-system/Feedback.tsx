import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton primitive. Use sparingly — surfaces must remain legible.
 */
export function Skeleton({
  className,
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={cn(
        "bg-canvas-sunken rounded-[3px] animate-pulse-soft",
        className,
      )}
      style={{ width, height }}
    />
  );
}

/**
 * Editorial empty/error/loading state container.
 */
export function StateBlock({
  eyebrow,
  title,
  description,
  action,
  tone = "neutral",
  icon,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "warning" | "error";
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start max-w-md">
      {icon && (
        <div
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center mb-3 border",
            tone === "error" && "bg-[#F8E6E2] border-[#ECC9C2] text-signal-negative",
            tone === "warning" && "bg-[#F8F0DC] border-[#E7D7AB] text-[#9B6B12]",
            tone === "neutral" && "bg-canvas-sunken border-line text-ink-secondary",
          )}
        >
          {icon}
        </div>
      )}
      {eyebrow && <div className="heading-eyebrow mb-1">{eyebrow}</div>}
      <h3 className="text-lg font-medium text-ink-primary tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonText({ width = "60%" }: { width?: string | number }) {
  return <Skeleton className="h-3" width={width} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3" width="55%" />
        <Skeleton className="h-2.5" width="35%" />
      </div>
      <Skeleton className="h-3" width="48px" />
    </div>
  );
}

export function SkeletonPanel({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-[6px] border border-line bg-canvas p-5 space-y-1">
      <Skeleton className="h-4 w-1/3 mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}