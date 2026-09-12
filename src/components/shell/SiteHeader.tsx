"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthIndicator } from "./AuthIndicator";

const NAV = [
  { href: "/ancestor", label: "Ancestor" },
  { href: "/lab", label: "Market Lab" },
  { href: "/universes", label: "My Universes" },
  { href: "/explore", label: "Explore" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 sm:px-7">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="Who Is My Ancestor — home"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-[3px] bg-ink-primary text-ink-inverse"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="5" cy="18" r="2.2" />
              <circle cx="19" cy="18" r="2.2" />
              <path d="M12 7.2L5 15.8M12 7.2L19 15.8M5 18h14" />
            </svg>
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-md font-medium tracking-tight text-ink-primary">
              Who Is My Ancestor
            </span>
            <span className="hidden text-2xs uppercase tracking-[0.16em] text-ink-tertiary sm:inline">
              Beta
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-[4px] px-2.5 h-8 inline-flex items-center text-sm transition-colors duration-180",
                  active
                    ? "text-ink-primary bg-canvas-sunken"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-canvas-sunken",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <AuthIndicator />
          <Link
            href="/ancestor"
            className="rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 inline-flex items-center hover:bg-[#1c1c1c] transition-colors duration-180"
          >
            Find an ancestor
          </Link>
        </div>
      </div>
    </header>
  );
}