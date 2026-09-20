"use client";

import { ProtectedLink } from "./ProtectedLink";

/**
 * SiteFooter — auth-aware footer.
 *
 * All product links route through `/login?next=...` for signed-out
 * visitors via <ProtectedLink>. This way the footer never offers a
 * clickable destination that bounces the visitor through an unauth
 * screen.
 *
 * Note: the footer intentionally does NOT include "Sign in" — the
 * header is the canonical entry point for that — but it does include
 * a single "Browse the markets" link to /login?next=/explore so a
 * signed-out visitor who scrolls all the way down has somewhere to go.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line-subtle mt-section">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-7 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span
                aria-hidden
                className="grid h-6 w-6 place-items-center rounded-[3px] bg-ink-primary text-ink-inverse"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
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
              <span className="text-md font-medium tracking-tight">
                Who Is My Ancestor
              </span>
            </div>
            <p className="text-ink-secondary text-sm leading-relaxed max-w-xs">
              A new way to explore relationships inside the cryptocurrency
              universe — powered by CoinMarketCap data.
            </p>
          </div>

          <div>
            <div className="heading-eyebrow mb-3">Explore</div>
            <ul className="space-y-2 text-ink-secondary">
              <li>
                <ProtectedLink
                  to="/ancestor"
                  className="hover:text-ink-primary"
                >
                  Ancestor
                </ProtectedLink>
              </li>
              <li>
                <ProtectedLink
                  to="/lab"
                  className="hover:text-ink-primary"
                >
                  Market Lab
                </ProtectedLink>
              </li>
              <li>
                <ProtectedLink
                  to="/universes"
                  className="hover:text-ink-primary"
                >
                  My Universes
                </ProtectedLink>
              </li>
              <li>
                <ProtectedLink
                  to="/explore"
                  className="hover:text-ink-primary"
                >
                  Explore
                </ProtectedLink>
              </li>
            </ul>
          </div>

          <div>
            <div className="heading-eyebrow mb-3">Data</div>
            <ul className="space-y-2 text-ink-secondary">
              <li>
                <ProtectedLink
                  to="/lab?tab=evidence"
                  className="hover:text-ink-primary"
                >
                  API Evidence
                </ProtectedLink>
              </li>
              <li>
                <a
                  href="https://coinmarketcap.com/api/documentation/v1"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink-primary"
                >
                  CMC API docs ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="heading-eyebrow mb-3">Hackathon</div>
            <ul className="space-y-2 text-ink-secondary">
              <li>Built for CoinMarketCap × DoraHacks</li>
              <li>Track: Data & Visualisation</li>
              <li className="text-xs text-ink-tertiary pt-1">
                #BuildwithCMC
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line-subtle mt-10 pt-6 text-xs text-ink-tertiary flex flex-wrap items-center justify-between gap-3">
          <span>
            Market data provided by CoinMarketCap. Not financial advice.
          </span>
          <span>
            © {new Date().getFullYear()} Who Is My Ancestor. A hackathon
            project.
          </span>
        </div>
      </div>
    </footer>
  );
}
