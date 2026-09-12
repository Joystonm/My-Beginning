"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "block w-full bg-canvas text-ink-primary placeholder:text-ink-tertiary " +
  "border border-line-strong rounded-[4px] transition-colors duration-180 " +
  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, invalid, ...rest },
  ref,
) {
  if (leading || trailing) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 bg-canvas border rounded-[4px] px-3 transition-colors duration-180",
          invalid ? "border-signal-negative" : "border-line-strong focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30",
        )}
      >
        {leading && (
          <span className="text-ink-tertiary shrink-0" aria-hidden>
            {leading}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-ink-tertiary",
            className,
          )}
          {...rest}
        />
        {trailing && (
          <span className="text-ink-tertiary shrink-0" aria-hidden>
            {trailing}
          </span>
        )}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(fieldBase, "h-10 px-3 text-sm", className)}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "px-3 py-2 text-sm min-h-[88px] resize-y", className)}
        {...rest}
      />
    );
  },
);

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        "h-10 pl-3 pr-8 text-sm appearance-none bg-no-repeat",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22 fill=%22none%22 stroke=%22%235C5C5C%22 stroke-width=%221.5%22><path d=%22M2.5 4.5L6 8L9.5 4.5%22/></svg>')] bg-[right_10px_center]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Label({
  htmlFor,
  children,
  hint,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-xs font-medium text-ink-secondary mb-1.5", className)}
    >
      {children}
      {hint && <span className="ml-2 text-ink-tertiary font-normal">{hint}</span>}
    </label>
  );
}