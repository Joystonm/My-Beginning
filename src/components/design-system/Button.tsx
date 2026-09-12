"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium tracking-tight select-none " +
  "transition-[background,color,border-color,box-shadow] duration-180 ease-editorial " +
  "disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap rounded-[4px]";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-primary text-ink-inverse hover:bg-[#1c1c1c] active:bg-[#2a2a2a] " +
    "border border-ink-primary",
  secondary:
    "bg-canvas text-ink-primary hover:bg-canvas-sunken border border-line-strong",
  ghost:
    "bg-transparent text-ink-primary hover:bg-canvas-sunken border border-transparent",
  destructive:
    "bg-signal-negative text-ink-inverse hover:bg-[#a13628] border border-signal-negative",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[0.9375rem]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leading,
      trailing,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <span
            className="h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin"
            aria-hidden
          />
        ) : (
          leading
        )}
        {children}
        {!loading && trailing}
      </button>
    );
  },
);