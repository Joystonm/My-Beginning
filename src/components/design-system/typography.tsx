import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("heading-eyebrow", className)}>{children}</div>;
}

export function Metric({
  value,
  label,
  hint,
  align = "left",
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col gap-1", align === "right" && "items-end")}>
      <div className="heading-eyebrow">{label}</div>
      <div className="text-xl tnum tracking-tight text-ink-primary">{value}</div>
      {hint && <div className="text-xs text-ink-tertiary">{hint}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line-subtle", className)} />;
}

export function NumberValue({
  value,
  className,
  size = "md",
}: {
  value: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "tnum tracking-tight",
        size === "sm" && "text-sm",
        size === "md" && "text-md",
        size === "lg" && "text-xl",
        className,
      )}
    >
      {value}
    </span>
  );
}