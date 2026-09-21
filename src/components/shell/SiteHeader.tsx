"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth";
import { AccountMenu } from "./AccountMenu";
import { ProtectedLink } from "./ProtectedLink";

const PROTECTED_NAV = [
  { href: "/ancestor", label: "Ancestor" },
  { href: "/market-lab", label: "Market Lab" },
  { href: "/my-universes", label: "My Universes" },
  { href: "/explore", label: "Explore" },
] as const;

/**
 * SiteHeader — auth-aware global nav.
 *
 *   - Signed out: brand mark on the left, "Sign in" link on the right
 *     (rendered by <AccountMenu />), and a "Find an ancestor" CTA that
 *     routes through /login?next=/ancestor. The protected nav items
 *     (Ancestor / Market Lab / My Universes / Explore) are HIDDEN —
 *     a guest who clicks them would just bounce to /login, which is
 *     noisy UX.
 *   - Signed in: brand mark, the full protected nav, the AccountMenu
 *     avatar, and a "Find an ancestor" CTA that goes straight to
 *     /ancestor.
 *   - Loading: render the brand mark + a stable placeholder for the
 *     right-rail slot so the header does not flash between states.
 *
 * The component reads `useAuth()` rather than taking `signedIn` as a
 * prop so the same header works for every route and stays consistent
 * with onAuthStateChange events (sign-in / sign-out).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Hide the right-rail "Find an ancestor" CTA on the login page since
  // it duplicates the auth action and clutters the visual hierarchy.
  const isLoginPage = pathname === "/login";
  // We hide the protected nav items while auth state is loading AND
  // once we know the visitor is signed out. Signed-in users always
  // see the full nav.
  const showProtectedNav = !loading && Boolean(user);

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 sm:px-7">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="My Beginning — home"
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
              My Beginning
            </span>
            <span className="hidden text-2xs uppercase tracking-[0.16em] text-ink-tertiary sm:inline">
              Beta
            </span>
          </div>
        </Link>

        {showProtectedNav && (
          <nav className="flex items-center gap-1" aria-label="Main">
            {PROTECTED_NAV.map((item) => {
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
        )}

        {!isLoginPage && (
          <div className="hidden sm:flex items-center gap-3">
            <AccountMenu />
            {showProtectedNav ? (
              <Link
                href="/ancestor"
                className="rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 inline-flex items-center hover:bg-[#1c1c1c] transition-colors duration-180"
              >
                Find an ancestor
              </Link>
            ) : (
              <ProtectedLink
                to="/ancestor"
                className="rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 inline-flex items-center hover:bg-[#1c1c1c] transition-colors duration-180"
              >
                Find an ancestor
              </ProtectedLink>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
