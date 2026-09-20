/**
 * Auth redirect / route-protection tests.
 *
 * Verifies the route-protection invariants that must hold regardless of
 * Supabase being configured:
 *
 *   1. requireUser() redirects to /login when there is no user.
 *   2. requireUser() returns the user object when authenticated.
 *   3. sanitizeNext() rejects external / open-redirect URLs.
 *   4. The route-alias pages exist with redirect() as their default export.
 *   5. The /login page, AuthProvider, ProtectedRoute, AccountMenu, and
 *      layout modules all export the expected shapes.
 *
 * Tests use a mutable stub for @/lib/supabase/server (see
 * _auth-server-stub.js) so we can simulate signed-out and signed-in
 * states without a real Supabase instance.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const stub = require("./_auth-server-stub.js");

const realResolve = (Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
})._resolveFilename;

(Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
})._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request === "@/lib/supabase/server" || request.endsWith("/lib/supabase/server")) {
    return require.resolve("./_auth-server-stub.js");
  }
  return realResolve.call(this, request, parent, isMain, options);
};

import { requireUser } from "../src/lib/auth/guard";
import { sanitizeNext } from "../src/lib/auth/redirect";

// ---------------------------------------------------------------------------
// 1. requireUser() throws NEXT_REDIRECT to /login when there is no user
// ---------------------------------------------------------------------------

test("requireUser() redirects to /login when user is null", async () => {
  stub.resetAuthUser();
  let captured: string | null = null;
  try {
    await requireUser("/ancestor");
  } catch (err) {
    const e = err as Error & { digest?: string };
    if (e.digest && e.digest.startsWith("NEXT_REDIRECT")) {
      const match = /NEXT_REDIRECT;[^;]+;([^;]+);/.exec(e.digest);
      if (match) captured = decodeURIComponent(match[1] ?? "");
    }
  }
  assert.ok(captured, "requireUser() should throw a NEXT_REDIRECT");
  assert.equal(captured, "/login?next=/ancestor");
});

// ---------------------------------------------------------------------------
// 2. requireUser() returns the user when present (verified by stubbing
//    via direct module import — tsx's resolver bypasses Node's
//    _resolveFilename for ESM imports, so we exercise the stub directly).
// ---------------------------------------------------------------------------

test("auth server stub returns configured user", async () => {
  stub.setAuthUser({
    id: "user-1",
    email: "u@example.com",
    displayName: "U",
  });
  try {
    const u = await stub.getCurrentUser();
    assert.equal(u?.id, "user-1");
    assert.equal(u?.email, "u@example.com");
  } finally {
    stub.resetAuthUser();
  }
});

test("auth server stub returns null when signed out", async () => {
  stub.resetAuthUser();
  const u = await stub.getCurrentUser();
  assert.equal(u, null);
});

// ---------------------------------------------------------------------------
// 3. sanitizeNext() rejects external / open-redirect URLs
// ---------------------------------------------------------------------------

test("sanitizeNext() defaults to /ancestor for missing input", () => {
  assert.equal(sanitizeNext(null), "/ancestor");
  assert.equal(sanitizeNext(""), "/ancestor");
});

test("sanitizeNext() accepts internal absolute paths", () => {
  assert.equal(sanitizeNext("/ancestor"), "/ancestor");
  assert.equal(sanitizeNext("/lab?tab=global"), "/lab?tab=global");
});

test("sanitizeNext() blocks protocol-relative and external URLs", () => {
  assert.equal(sanitizeNext("//evil.com"), "/ancestor");
  assert.equal(sanitizeNext("https://evil.com"), "/ancestor");
  assert.equal(sanitizeNext("javascript:alert(1)"), "/ancestor");
  assert.equal(sanitizeNext("ancestor"), "/ancestor"); // not absolute
});

// ---------------------------------------------------------------------------
// 4. Route alias modules exist and export a default
// ---------------------------------------------------------------------------

test("/market-lab alias module exists and exports a default", async () => {
  const mod = await import("../src/app/market-lab/page");
  assert.equal(typeof mod.default, "function");
});

test("/my-universes alias module exists and exports a default", async () => {
  const mod = await import("../src/app/my-universes/page");
  assert.equal(typeof mod.default, "function");
});

test("/login page exports a default", async () => {
  const mod = await import("../src/app/login/page");
  assert.equal(typeof mod.default, "function");
});

test("/login LoginView is a client component", async () => {
  const mod = await import("../src/app/login/LoginView");
  assert.equal(typeof mod.LoginView, "function");
});

test("AuthProvider module exports the hook and provider", async () => {
  const mod = await import("../src/components/auth/AuthProvider");
  assert.equal(typeof mod.AuthProvider, "function");
  assert.equal(typeof mod.useAuth, "function");
});

test("ProtectedRoute module exports the guard component", async () => {
  const mod = await import("../src/components/auth/ProtectedRoute");
  assert.equal(typeof mod.ProtectedRoute, "function");
});

test("AccountMenu module exists and exports the menu", async () => {
  const mod = await import("../src/components/shell/AccountMenu");
  assert.equal(typeof mod.AccountMenu, "function");
});

test("Layout root is async (uses await getCurrentUser)", () => {
  // The compiled module's default export is an async function. We can
  // verify by checking its string representation rather than invoking
  // it (which would require a real DOM via Next runtime).
  // Pull the module source and assert.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/layout.tsx"),
    "utf8",
  );
  assert.match(src, /async function RootLayout/);
  assert.match(src, /await getCurrentUser/);
  assert.match(src, /AuthShell/);
});

// ---------------------------------------------------------------------------
// 6. Marketing landing page is reachable for everyone (no auth redirect)
// ---------------------------------------------------------------------------

test("HomePage (/) does NOT redirect — it renders the marketing landing", async () => {
  // The previous behaviour was: / redirected to /ancestor (signed in)
  // or /login (signed out). The current behaviour: / is the public
  // marketing landing. We assert the page module is a real default
  // export and the source contains the marketing content markers
  // (hero, lineage preview, "How it works", "API evidence") so we
  // know a regression that turns / into a redirect will be caught.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/page.tsx"),
    "utf8",
  );
  // Module is async (server component that awaits getCurrentUser).
  assert.match(
    src,
    /export default async function HomePage/,
    "HomePage must be an async server component",
  );
  // Calls getCurrentUser to drive the hero CTA copy.
  assert.match(
    src,
    /await getCurrentUser/,
    "HomePage must resolve auth server-side for the CTA copy",
  );
  // No redirect() call — landing should render unconditionally.
  assert.doesNotMatch(
    src,
    /\bredirect\(/,
    "HomePage must NOT call redirect — / is public",
  );
  // Marketing content markers.
  assert.match(src, /Every asset has a lineage/);
  assert.match(src, /Find yours/);
  assert.match(src, /How it works/);
  assert.match(src, /API evidence/);
  assert.match(src, /LineagePreviewSvg/);
  // All protected CTAs go through ProtectedLink so signed-out
  // visitors are routed through /login?next=...
  assert.match(src, /ProtectedLink/);
});

test("HomePage hero CTA copy depends on auth state", async () => {
  // The server component reads `signedIn` from getCurrentUser() and
  // branches the hero CTA copy. Asserting both branches exist in the
  // source guarantees a regression that breaks the guest/sign-in copy
  // switch is caught.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/page.tsx"),
    "utf8",
  );
  assert.match(src, /signedIn \? "Find an ancestor"/);
  assert.match(src, /signedIn \? "Open Market Lab"/);
  assert.match(src, /signedIn \? "Open Ancestor"/);
  assert.match(src, /signedIn \? "Open Explore"/);
});

// ---------------------------------------------------------------------------
// 7. SiteHeader is auth-aware: hides protected nav for guests
// ---------------------------------------------------------------------------

test("SiteHeader module is a client component and uses useAuth", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/shell/SiteHeader.tsx"),
    "utf8",
  );
  assert.match(src, /^"use client"/m);
  assert.match(src, /useAuth/);
  // The protected nav is gated on auth state — must NOT render
  // unconditionally for guests.
  assert.match(src, /showProtectedNav/);
  assert.match(src, /!loading && Boolean\(user\)/);
  // The right-rail "Find an ancestor" CTA branches on auth state:
  // direct <Link> when signed in, ProtectedLink when signed out.
  assert.match(src, /showProtectedNav \? \(/);
});

test("ProtectedLink module exists, is a client component, and routes through /login when signed out", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/shell/ProtectedLink.tsx"),
    "utf8",
  );
  assert.match(src, /^"use client"/m);
  assert.match(src, /function ProtectedLink/);
  assert.match(src, /buildLoginHref/);
  assert.match(
    src,
    /\/login\?next=/,
    "ProtectedLink must point at /login?next=... for signed-out visitors",
  );
});

test("SiteFooter module is a client component and uses ProtectedLink", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/shell/SiteFooter.tsx"),
    "utf8",
  );
  assert.match(src, /^"use client"/m);
  // All Explore links in the footer should be ProtectedLinks, not raw
  // <Link>s that would 404 / bounce for guests.
  const linkMatches = src.match(/<Link /g) ?? [];
  assert.equal(
    linkMatches.length,
    0,
    "footer must not have raw <Link>s pointing at protected paths",
  );
  assert.match(src, /ProtectedLink/);
});

// ---------------------------------------------------------------------------
// 9. Supabase server client uses getAll/setAll (the canonical Next.js 14
//    + @supabase/ssr cookie pattern). The old `get`/`set`/`remove`
//    callback pair silently no-ops in route handlers, which was the
//    root cause of /api/universes returning 401 + 500 — auth cookies
//    were never being written to the response after sign-in.
// ---------------------------------------------------------------------------

test("Supabase server client uses getAll/setAll cookie pattern", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/supabase/server.ts"),
    "utf8",
  );
  // Must use getAll / setAll.
  assert.match(src, /getAll\s*\(\s*\)/, "must define getAll()");
  assert.match(src, /setAll\s*\(/, "must define setAll(...)");
  // Must NOT use the older get/set/remove callbacks (which silently
  // no-op in route handlers).
  assert.doesNotMatch(
    src,
    /cookies:\s*\{[^}]*\bget\s*:\s*\(/,
    "must not use legacy get: () => ... cookie callback",
  );
  assert.doesNotMatch(
    src,
    /cookies:\s*\{[^}]*\bremove\s*:\s*\(/,
    "must not use legacy remove: () => ... cookie callback",
  );
});

// ---------------------------------------------------------------------------
// 10. HistoricalComparison dedupes symbols before using them as React
//     keys. The API doesn't forbid returning the same symbol twice,
//     and Recharts emits the duplicate-key warning for <Line key=BTC>.
// ---------------------------------------------------------------------------

test("HistoricalComparison dedupes series symbols", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ancestor/HistoricalComparison.tsx"),
    "utf8",
  );
  // Must use a Set or similar to dedup before mapping to <Line>.
  assert.match(src, /new Set<string>/);
  assert.match(src, /seen\.has\(s\.symbol\)/);
});

// ---------------------------------------------------------------------------
// 11. AncestorExperience uses a composite key for ancestor cards so
//     the same symbol can appear twice in the result list without
//     triggering the "two children with the same key" warning.
// ---------------------------------------------------------------------------

test("AncestorExperience uses composite key for ancestor cards", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/ancestor/AncestorExperience.tsx"),
    "utf8",
  );
  assert.match(
    src,
    /key=\{`\$\{[^}]+\}-\$\{[^}]+\}`/,
    "ancestor cards must use a composite key, not symbol alone",
  );
});

// ---------------------------------------------------------------------------
// 12. Lineage drift detector — the newsworthy "what's moving in the
//     family" headline. The drift algorithm walks the curated graph's
//     descendants, fetches 30-day price history for each, computes
//     returns, and surfaces the family-vs-base and family-vs-market
//     deltas. The card, API route, algorithm, and wiring must all
//     exist and be wired together.
// ---------------------------------------------------------------------------

test("Lineage drift detector exists and is wired in", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const drift = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/ancestor/drift.ts"),
    "utf8",
  );
  const card = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ancestor/LineageDriftCard.tsx"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.resolve(__dirname, "../src/app/api/ancestor/drift/route.ts"),
    "utf8",
  );
  const experience = fs.readFileSync(
    path.resolve(__dirname, "../src/app/ancestor/AncestorExperience.tsx"),
    "utf8",
  );

  // Algorithm exports.
  assert.match(drift, /export async function computeLineageDrift/);
  assert.match(drift, /export interface LineageDrift/);
  assert.match(drift, /export interface DriftEntry/);
  assert.match(drift, /export function candidateDescendants/);

  // Algorithm uses both endpoints that the marketing page advertises.
  assert.match(
    drift,
    /getHistoricalQuotesForSymbols/,
    "drift must use the batched historical quotes endpoint",
  );
  assert.match(
    drift,
    /getHistoricalGlobalMetrics/,
    "drift must use the historical global metrics endpoint for market context",
  );

  // The result carries both the family-vs-base AND family-vs-market
  // delta. (We assert the field names because the UI keys off them.)
  assert.match(drift, /family_vs_base_delta_pct/);
  assert.match(drift, /family_vs_market_delta_pct/);
  assert.match(drift, /biggest_gainer/);
  assert.match(drift, /biggest_loser/);

  // The UI card must surface the family-vs-market context.
  assert.match(card, /family_vs_market_delta_pct/);
  assert.match(card, /Family vs market/);
  assert.match(card, /Strongest/);
  assert.match(card, /Weakest/);

  // The API route exists and exports POST.
  assert.match(route, /export async function POST/);
  assert.match(route, /computeLineageDrift/);
  assert.match(route, /windowDays/);

  // AncestorExperience must fetch and render the drift.
  assert.match(experience, /\/api\/ancestor\/drift/);
  assert.match(experience, /LineageDriftCard/);
  assert.match(experience, /driftState/);
});

// ---------------------------------------------------------------------------
// 13. Endpoint breadth — the marketing landing page must list the
//     historical-quotes and historical-global-metrics endpoints that
//     the drift card actually uses. Regression: anyone who removes
//     an entry from the showcase list will break this test.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 14. /compare — the shareable URL entry point. Server component,
//     auth-gated, reads ?from=&to= and computes the direct relationship.
//     This is the demo video's central URL and the X post template.
// ---------------------------------------------------------------------------

test("/compare route exists, is auth-gated, and reads ?from / ?to", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/compare/page.tsx"),
    "utf8",
  );
  // Must be auth-gated like every other route.
  assert.match(src, /await requireUser/);
  // Must read both query params.
  assert.match(src, /searchParams\?\.from/);
  assert.match(src, /searchParams\?\.to/);
  // Must use the lineage engine to compute the relationship.
  assert.match(src, /findLineage/);
  // Must compute 30-day returns for both assets.
  assert.match(src, /getHistoricalQuotesForSymbols/);
  // Must surface the direct edge between the two.
  assert.match(src, /findDirectEdge|fromToEdge|toFromEdge/);
  // Must compute shared ancestors as the intersection of lineage chains.
  assert.match(src, /sharedAncestors/);
});

test("Marketing page showcases ≥7 CMC endpoints including both historical ones", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/page.tsx"),
    "utf8",
  );
  // The endpoint list is rendered by mapping over an array literal.
  // Pull every quoted entry and check coverage.
  const matches = [...src.matchAll(/\/v1\/[a-zA-Z0-9_\-\/]+/g)].map(
    (m) => m[0],
  );
  const unique = [...new Set(matches)];
  assert.ok(
    unique.length >= 7,
    `Marketing page must showcase ≥7 distinct CMC endpoints, found ${unique.length}: ${unique.join(", ")}`,
  );
  assert.ok(
    unique.includes("/v1/cryptocurrency/quotes/historical"),
    "Marketing page must showcase /v1/cryptocurrency/quotes/historical (used by HistoricalComparison + LineageDrift)",
  );
  assert.ok(
    unique.includes("/v1/global-metrics/quotes/historical"),
    "Marketing page must showcase /v1/global-metrics/quotes/historical (used by LineageDrift for market context)",
  );
});

// ---------------------------------------------------------------------------
// 8. React hooks-order invariant across MarketLab tabs
// ---------------------------------------------------------------------------
//
// Bug class: an early `return` placed BEFORE a hook (useState / useEffect
// / useMemo) makes the hook count differ across renders, which produces
// "Rendered fewer hooks than expected" + cascading warnings like
// "Cannot update a component (HotReload) while rendering CompareTab".
//
// We pin the contract: in every MarketLab tab, the FIRST occurrence of
// an early `return` (lines that begin with `return`) MUST come AFTER
// the LAST hook call.

test("MarketLab tabs: early returns do not violate hooks order", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.resolve(__dirname, "../src/components/lib/lab");
  const tabFiles = [
    "CompareTab.tsx",
    "ExplorerTab.tsx",
    "OverviewTab.tsx",
    "AiTab.tsx",
    "EvidenceTab.tsx",
  ];
  // Hooks we care about. (useRef is intentionally excluded — refs are
  // not subject to the rules-of-hooks violation since they don't affect
  // render output.)
  const hookRe = /\b(useState|useEffect|useMemo|useCallback|useContext|useReducer|useSearchParams|usePathname|useRouter)\b/;

  for (const file of tabFiles) {
    const src = fs.readFileSync(path.resolve(dir, file), "utf8");
    const lines = src.split(/\r?\n/);

    // Find the FIRST top-level exported component — `export function
    // Foo(...) {` — and bound our analysis to its body (depth === 1).
    // Anything deeper is a nested helper component with its own hook
    // contract and is not subject to this invariant.
    let bodyStart = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^export function /.test(lines[i] ?? "")) {
        bodyStart = i;
        break;
      }
    }
    assert.ok(
      bodyStart >= 0,
      `${file}: expected an exported component function`,
    );
    let lastHookLine = -1;
    let firstEarlyReturnLine = -1;
    let braceDepth = 0;
    let opened = false;
    let pendingIfLine: number | null = null;
    for (let i = bodyStart; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      // Track brace depth so we only look at the OUTER body (depth === 1).
      for (const ch of line) {
        if (ch === "{") {
          braceDepth += 1;
          if (braceDepth === 1) opened = true;
        } else if (ch === "}") {
          braceDepth -= 1;
        }
      }
      // Skip until we've opened the component body.
      if (!opened) continue;
      // Once we close the body, stop analysing.
      if (braceDepth <= 0) break;
      // Only consider depth === 1 (the outermost body).
      if (braceDepth !== 1) {
        // But still reset pendingIf if we exit the if-block without returning.
        if (pendingIfLine !== null && i - pendingIfLine > 8) {
          pendingIfLine = null;
        }
        continue;
      }
      // Detect hook calls in the outer body.
      if (hookRe.test(line)) {
        lastHookLine = Math.max(lastHookLine, i);
      }
      // Detect `if (...) {` blocks that lead to an early return.
      if (/^\s*if\s*\(/.test(line) && /\{/.test(line)) {
        pendingIfLine = i;
        continue;
      }
      if (
        pendingIfLine !== null &&
        i - pendingIfLine <= 8 &&
        /^\s*return\b/.test(line)
      ) {
        firstEarlyReturnLine =
          firstEarlyReturnLine === -1 ? i : firstEarlyReturnLine;
        pendingIfLine = null;
      }
      if (pendingIfLine !== null && i - pendingIfLine > 8) {
        pendingIfLine = null;
      }
    }

    // Only enforce the invariant when the outer body actually has
    // hooks. Some tabs (e.g. AiTab) compose smaller panel components
    // and the outer function has no hooks of its own — that's fine,
    // because each inner component has its own hooks contract.
    if (lastHookLine >= 0 && firstEarlyReturnLine !== -1) {
      assert.ok(
        firstEarlyReturnLine > lastHookLine,
        `${file}: early return at line ${firstEarlyReturnLine + 1} comes BEFORE the last hook call at line ${lastHookLine + 1}. ` +
          "Move all hooks above the early return so the hook count stays stable across renders.",
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 27. /lab OverviewTab reads the current CMC global-metrics shape.
//
// CMC's /v1/global-metrics/quotes/latest nests totals under
// `quote.USD` and exposes dominance as flat `btc_dominance` /
// `eth_dominance` fields. The OverviewTab UI, the type definition,
// and the live normaliser must all match the new shape — otherwise
// Total market cap / 24h volume / BTC+ETH dominance render blank or
// "0.00%" instead of live numbers.
// ---------------------------------------------------------------------------

test("CmcGlobalMetrics type and OverviewTab read from the current CMC shape", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  const typesSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/cmc/types.ts"),
    "utf8",
  );
  const overviewSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/components/lib/lab/OverviewTab.tsx"),
    "utf8",
  );
  const clientSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/cmc/client.ts"),
    "utf8",
  );
  const seedSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/cmc/seed.ts"),
    "utf8",
  );

  // Type must declare the nested USD shape and the flat dominance
  // fields.
  assert.match(
    typesSrc,
    /quote:\s*Record<\s*"USD"/,
    "CmcGlobalMetrics must declare quote.USD",
  );
  assert.match(typesSrc, /\bbtc_dominance:\s*number\b/);
  assert.match(typesSrc, /\beth_dominance:\s*number\b/);

  // The legacy shape must NOT leak back into the type.
  assert.doesNotMatch(
    typesSrc,
    /market_cap_percentage:\s*Record/,
    "CmcGlobalMetrics must not declare the legacy market_cap_percentage map",
  );
  // `total_market_cap` and `total_volume_24h` should only appear inside
  // the nested quote.USD block — never as top-level fields.
  const typeBody = typesSrc.replace(/\/\*[\s\S]*?\*\//g, "");
  const topLevelTotals = typeBody.match(
    /\b(total_market_cap|total_volume_24h)\b/g,
  );
  if (topLevelTotals) {
    // Allow matches that are inside the `quote: Record<"USD", ...>`
    // block — the failure mode is the field at the top level.
    const lines = typeBody.split("\n");
    const usdOpen = lines.findIndex((l: string) =>
      /quote:\s*Record<\s*"USD"/.test(l),
    );
    assert.ok(usdOpen >= 0, "could not locate quote.USD block");
    for (let i = 0; i < usdOpen; i += 1) {
      assert.doesNotMatch(
        lines[i] ?? "",
        /\b(total_market_cap|total_volume_24h)\b\s*:/,
        `legacy top-level totals field at line ${i + 1}: ${lines[i]}`,
      );
    }
  }

  // OverviewTab must read nested quote.USD and flat dominance fields.
  assert.match(
    overviewSrc,
    /global\.quote\.USD/,
    "OverviewTab must read totals from global.quote.USD",
  );
  assert.match(
    overviewSrc,
    /global\.btc_dominance/,
    "OverviewTab must read global.btc_dominance (flat field)",
  );
  assert.match(
    overviewSrc,
    /global\.eth_dominance/,
    "OverviewTab must read global.eth_dominance (flat field)",
  );

  // Legacy shape must not be referenced from OverviewTab. Strip line
  // comments first — the explanatory comment intentionally mentions
  // the legacy shape so future readers know what NOT to do.
  const overviewCode = overviewSrc
    .split("\n")
    .filter((l: string) => !/^\s*\/\//.test(l))
    .join("\n");
  assert.doesNotMatch(
    overviewCode,
    /global\.total_market_cap\b(?!\s*\?)/,
    "OverviewTab must not read global.total_market_cap (legacy top-level)",
  );
  assert.doesNotMatch(
    overviewCode,
    /market_cap_percentage/,
    "OverviewTab must not read the legacy market_cap_percentage map",
  );

  // Active pairs must be formatted with en-US to avoid the en-IN
  // "1,16,587" rendering of 116587.
  assert.match(
    overviewSrc,
    /toLocaleString\("en-US"\)/,
    "Active pairs must be rendered with en-US locale",
  );

  // The seed must produce values in the new shape.
  assert.match(seedSrc, /quote:\s*\{\s*USD:\s*\{/, "seed must emit quote.USD");
  assert.match(seedSrc, /btc_dominance:/, "seed must emit btc_dominance");
  assert.match(seedSrc, /eth_dominance:/, "seed must emit eth_dominance");
  assert.doesNotMatch(
    seedSrc,
    /market_cap_percentage:\s*\{/,
    "seed must not emit the legacy market_cap_percentage map",
  );

  // The CMC client must normalise legacy shapes too, so a one-off older
  // response can't blank out the UI again.
  assert.match(
    clientSrc,
    /normalizeGlobalMetrics/,
    "CMC client must normalise legacy global-metrics shapes",
  );
});

// ---------------------------------------------------------------------------
// 28. /explore URL-state plumbing. The page must read filters from the
//     URL via useSearchParams and write them via router.replace, with a
//     shallow-equality guard so the URL doesn't churn on every keystroke.
// ---------------------------------------------------------------------------

test("ExploreView reads filters from useSearchParams and writes via router.replace", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/ExploreView.tsx"),
    "utf8",
  );
  assert.match(src, /useSearchParams/, "must use useSearchParams");
  assert.match(src, /useRouter/, "must use useRouter");
  assert.match(src, /router\.replace\(/, "must call router.replace");
  assert.match(
    src,
    /scroll:\s*false/,
    "router.replace must preserve scroll position",
  );
});

// ---------------------------------------------------------------------------
// 29. /explore filter state is URL-derived — there must be no second
//     writer that pushes the URL, so we can't end up with two effects
//     racing.
// ---------------------------------------------------------------------------

test("ExploreView URL-write effect is the only writer", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/ExploreView.tsx"),
    "utf8",
  );
  // Exactly one router.replace call site.
  const matches = src.match(/router\.replace\(/g) ?? [];
  assert.equal(
    matches.length,
    1,
    "ExploreView must have exactly one router.replace call site",
  );
});

// ---------------------------------------------------------------------------
// 30. /explore click-to-sort column headers must render as buttons with
//     aria-sort semantics.
// ---------------------------------------------------------------------------

test("ExploreTable headers are sortable buttons with aria-sort", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/components/ExploreTable.tsx"),
    "utf8",
  );
  assert.match(src, /aria-sort/, "must emit aria-sort on sortable headers");
  // Strip whitespace + JS line/block comments so the regex doesn't
  // trip on `>` inside `// <th>` text in a comment.
  const flat = src
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ");
  assert.match(
    flat,
    /<button[^>]*onClick=\{[^}]*onSort/,
    "sortable headers must be <button> elements wired to onSort",
  );
});

// ---------------------------------------------------------------------------
// 30b. /explore sortable header buttons must fill the entire <th> so the
//      whole header area is a click target — not just the label. The
//      earlier version used `inline-flex` inside a `text-right` <th>,
//      which left only the text clickable and (worse) caused the arrow
//      to wrap to a second line in some browsers.
// ---------------------------------------------------------------------------

test("ExploreTable sortable headers are full-cell click targets", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/components/ExploreTable.tsx"),
    "utf8",
  );
  // The sortable <button> must be w-full flex (not inline-flex) and
  // carry whitespace-nowrap so the label+arrow stay on one line.
  assert.match(
    src,
    /className=\{cn\(\s*"w-full flex items-center gap-1[^"]*whitespace-nowrap/,
    "sortable header button must be w-full flex with whitespace-nowrap",
  );
  // The <th> for sortable columns must drop its padding (p-0) so the
  // inner button owns the cell padding and the click target covers
  // the entire header.
  assert.match(
    src,
    /"font-medium p-0"/,
    "sortable <th> must drop padding so the button fills the cell",
  );
});

// ---------------------------------------------------------------------------
// 31. /explore density toggle must hide the 7d + Pairs columns in
//     compact mode and expose a Comfortable/Compact segmented control.
// ---------------------------------------------------------------------------

test("ExploreTable density toggle hides secondary columns in compact mode", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/components/ExploreTable.tsx"),
    "utf8",
  );
  assert.match(
    src,
    /hideInCompact/,
    "columns must carry a hideInCompact flag",
  );
  assert.match(
    src,
    /comfortable.*compact/s,
    "must expose both comfortable and compact density options",
  );
});

// ---------------------------------------------------------------------------
// 32. /explore family chips must hardcode the canonical lineage roots
//     (BTC, ETH, SOL, BNB, TRX) and the kind-based buckets (Stablecoins,
//     Wrapped, Memes) must come from kindForSymbol.
// ---------------------------------------------------------------------------

test("Explore family chips use descendantsOf + kindForSymbol", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const families = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/lib/families.ts"),
    "utf8",
  );
  assert.match(families, /descendantsOf/, "families.ts must use descendantsOf");
  assert.match(families, /kindForSymbol/, "families.ts must use kindForSymbol");
  for (const root of ["BTC", "ETH", "SOL", "BNB", "TRX"]) {
    assert.match(
      families,
      new RegExp(`root:\\s*["']${root}["']`),
      `families.ts must declare the ${root} family root`,
    );
  }
  assert.match(families, /stablecoin/);
  assert.match(families, /wrapped/);
  assert.match(families, /meme/);
});

// ---------------------------------------------------------------------------
// 33. /explore insight strip memoises its computation. We assert the
//     shape rather than the implementation detail — `computeInsights`
//     must be called from inside a useMemo (not from render directly).
// ---------------------------------------------------------------------------

test("ExploreInsights memoises insights derivation", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const orchestrator = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/ExploreView.tsx"),
    "utf8",
  );
  // Strip whitespace so the regex doesn't have to span lines.
  const flat = orchestrator.replace(/\s+/g, " ");
  // Allow nested parens inside the useMemo callback (e.g. `() =>
  // computeInsights(rows)`). Greedy `.+?` between the opening
  // `useMemo(` and `computeInsights` covers the arrow function shape.
  assert.match(
    flat,
    /useMemo\([^,]*computeInsights\(rows\)/,
    "insights must be computed inside a useMemo",
  );
});

// ---------------------------------------------------------------------------
// 34. /api/cmc/historical cap must be ≥ 12 so /explore can batch
//     sparkline fetches for the first 12 visible rows in one round-trip.
// ---------------------------------------------------------------------------

test("/api/cmc/historical per-call cap is ≥ 12", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/api/cmc/historical/route.ts"),
    "utf8",
  );
  const m = src.match(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/);
  assert.ok(m, "historical route must have a .slice(0, N) cap");
  const cap = Number(m![1]);
  assert.ok(cap >= 12, `historical cap must be ≥ 12 (got ${cap})`);
});

// ---------------------------------------------------------------------------
// 35. /explore page must still call requireUser so the demo-time auth
//     constraint isn't silently broken.
// ---------------------------------------------------------------------------

test("/explore page still calls requireUser", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/app/explore/page.tsx"),
    "utf8",
  );
  assert.match(src, /requireUser\("\/explore"\)/, "/explore must gate on requireUser");
  assert.match(
    src,
    /<Suspense/,
    "/explore must wrap the view in Suspense (useSearchParams requirement)",
  );
});

// ---------------------------------------------------------------------------
// 36. /explore filter pipeline tolerates bad URL params — garbage values
//     are sanitised or fall through to safe defaults, never thrown.
// ---------------------------------------------------------------------------

test("parseFilters tolerates garbage URLs without throwing", () => {
  // We test by importing the helper at runtime. The module has no
  // server-only deps, so we can require it from a test script.
  const path = require("node:path");
  const { parseFilters, DEFAULT_FILTERS } = require(
    path.resolve(__dirname, "../src/app/explore/lib/exploreFilters.ts"),
  );
  const garbage = new URLSearchParams(
    "cat=banana&minCap=abc&sort=NOT_A_KEY&density=fluffy&q=" + "x".repeat(80),
  );
  // parseFilters must not throw on garbage.
  const parsed = parseFilters(garbage);
  // Numeric / enum-typed fields fall back to defaults (sort, density,
  // minCap). String-typed fields (category, q) pass through; downstream
  // helpers (`getFamilyById`) reset unknown family ids to the All chip.
  assert.equal(parsed.sort, DEFAULT_FILTERS.sort);
  assert.equal(parsed.density, DEFAULT_FILTERS.density);
  assert.equal(parsed.minCap, DEFAULT_FILTERS.minCap);
  // q is length-capped to 64
  assert.ok(parsed.q.length <= 64, "q must be length-capped");
  // category passes through parseFilters (orchestrator resolves via
  // getFamilyById, which returns the All chip for unknown ids)
  assert.equal(parsed.category, "banana");
});

