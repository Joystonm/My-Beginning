import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * A panel is a structured surface — used to group content.
 * Cards are NOT used decoratively here; they appear only when they help.
 */
export function Panel({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-canvas border border-line rounded-[6px] shadow-panel",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line-subtle",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="heading-eyebrow mb-1">{eyebrow}</div>}
        <h2 className="text-md font-medium tracking-tight text-ink-primary truncate">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-ink-secondary mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}