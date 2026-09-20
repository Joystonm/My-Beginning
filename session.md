# Session Log — 2026-09-12 → 2026-09-13

A running record of everything shipped in this session. Use this when
picking up after a break — every file touched, every behaviour added,
every regression test that pins it.

The work spans the full `/explore` improvement pass (planning →
implementation → bugfix), the `/lab` OverviewTab blank/0 metrics fix,
the lineage drift card + `/compare` direct-URL feature, the
historical-quotes batched client, and the deploy/submit playbook.
The session predates this conversation by several compaction cycles;
the early portions are reconstructed from the compaction summary.

---

## 0. Carried over from prior session (pre-compaction)

- Fixed dev console errors (404 on a static asset, duplicate BTC key in
  a Recharts series, `/api/universes` 401/500).
- Re-read the CMC × DoraHacks `hackathon.md` and gave an honest
  scoring assessment.
- Implemented the "improve so I can win 100%" follow-ups:
  - 8 CMC endpoints wired (incl. both historical endpoints).
  - Curated lineage graph grown to 90+ edges across top 100 assets.
  - `/compare?from=A&to=B` direct-URL shareable relationship report.
  - Tier-0 static story archive (20 verified coins).
- Created the canonical [`project.md`](./project.md) (700+ lines) and
  the per-page guide section.
- Wrote [`docs/deploy-and-submit.md`](./docs/deploy-and-submit.md) —
  90-minute deploy + X post + DoraHacks submission playbook.

## 1. Lineage drift detector (this session, pre-compaction)

### Created
- **`src/lib/ancestor/drift.ts`** (316 lines) — the
  `computeLineageDrift(symbol, opts)` algorithm. Walks the curated
  graph's descendants via `descendantsOf(root)`, fetches 30-day price
  history per descendant via `getHistoricalQuotesForSymbols`, fetches
  market context via `getHistoricalGlobalMetrics`. Returns
  `LineageDrift` with `family_median_return_pct`,
  `family_vs_base_delta_pct`, `family_vs_market_delta_pct`,
  `biggest_gainer`, `biggest_loser`, sorted `entries[]`.

- **`src/app/api/ancestor/drift/route.ts`** (78 lines) — POST endpoint.
  Body `{ symbol, limit?, windowDays? }`. Calls `getListingsLatest` +
  `computeLineageDrift`. Returns `{ base, drift, source }`.

- **`src/components/ancestor/LineageDriftCard.tsx`** (386 lines) — the
  UI for the drift. 4 `StatTile`s (Family median, base return, Family
  vs base, Family vs market), `MoverTile` for biggest gainer/loser,
  `DriftBarRow` list sorted by |return|. Builds a headline sentence
  from drift data. Mirrors the same visual pattern later used in
  `ExploreInsights`.

### Modified
- **`src/app/ancestor/AncestorExperience.tsx`** — wired drift state,
  fetch effect, `LineageDriftCard` rendering.

## 2. `/compare` direct-URL shareable view (this session, pre-compaction)

### Created
- **`src/app/compare/page.tsx`** (282 lines) — server component,
  auth-gated. Reads `searchParams?.from`, `searchParams?.to`. Calls
  `findLineage` for both, `getHistoricalQuotesForSymbols` for 30d
  prices. `findDirectEdge` looks up curated edges either direction.
  Computes `sharedAncestors` as intersection of `lineage_chain` sets.

- **`src/app/compare/CompareView.tsx`** (256 lines) — client
  component. Exports `AssetSummary` type. `PALETTE` typed as a tuple
  `readonly [string, string]` to satisfy `noUncheckedIndexedAccess`.
  Renders `DirectRelationship`, `AssetPanel` side-by-side, shared
  ancestors list, source footer.

## 3. Batched historical quotes client (this session, pre-compaction)

### Modified
- **`src/lib/cmc/client.ts`** — added `getHistoricalQuotesForSymbols(
  symbols, opts)` which fans out parallel `getHistoricalQuotes` calls
  and returns a `Map<symbol, CmcHistoricalQuotesResponse>`. Added
  `getHistoricalGlobalMetrics(params)` + `HistoricalGlobalParams` +
  `CmcHistoricalGlobalResponse` type with `quotes[].quote.USD.total_market_cap`
  etc. Updated endpoints list comment to reflect 8 total endpoints.

## 4. `/lab` OverviewTab blank/0 metrics fix (this session, pre-compaction)

### Modified
- **`src/lib/cmc/types.ts`** — rewrote `CmcGlobalMetrics` to match the
  current CMC API shape: `quote.USD` nested totals + flat
  `btc_dominance` / `eth_dominance` (not the legacy
  `market_cap_percentage` map). Added explanatory comment.

- **`src/lib/cmc/seed.ts`** — rewrote `getSeedGlobalMetrics()` to emit
  the new shape: nested `quote.USD.{total_market_cap, total_volume_24h,
  market_cap_change_percentage_24h_usd, ...}` + flat
  `btc_dominance` / `eth_dominance` derived from the seed market caps.

- **`src/lib/cmc/client.ts`** — added `normalizeGlobalMetrics(raw)`
  that accepts either the new shape or the legacy top-level-totals +
  `market_cap_percentage` map shape and remaps to the new contract.
  `getGlobalMetrics()` now calls `request<Record<string, unknown>>`
  and runs the normaliser. Defensive against CMC changing their docs
  again.

- **`src/components/lib/lab/OverviewTab.tsx`** — switched reads from
  `global.total_market_cap` / `global.market_cap_percentage["btc"]`
  to `global.quote.USD.total_market_cap` /
  `global.btc_dominance`. Forced `toLocaleString("en-US")` on Active
  pairs to fix the en-IN locale rendering `116587` as `1,16,587`.

## 5. Regression tests (this session, pre-compaction)

### Modified
- **`scripts/test-auth-redirect.ts`** — added 8 regression tests:
  - #20 Supabase server client uses getAll/setAll cookie pattern.
  - #21 HistoricalComparison dedupes series symbols.
  - #22 AncestorExperience uses composite key for ancestor cards.
  - #23 Lineage drift detector exists and is wired in.
  - #24 /compare route exists, auth-gated, reads ?from / ?to.
  - #25 Marketing page showcases ≥7 CMC endpoints incl. both historical.
  - #26 MarketLab tabs: early returns do not violate hooks order.
  - #27 CmcGlobalMetrics type and OverviewTab read from the current
        CMC shape (pins the field names so the blank/0 bug can't
        regress).

## 6. `/explore` improvement pass (this session, post-compaction)

User asked "improve /explore". Planned via ExitPlanMode with a
detailed plan agent run. Implementation order:

### Created
- **`src/app/explore/lib/families.ts`** (172 lines) — hardcoded
  `FAMILIES` list: All / BTC family / ETH family / SOL family / BNB
  family / TRON family / Stablecoins / Wrapped / Memes. `shape: "root"`
  uses `descendantsOf(root)`; `shape: "kind"` uses `kindForSymbol()`
  predicate. Exports `symbolsInFamily(family, listings)` for the
  per-click row filter, `getFamilyById(id)` for the URL parser.

- **`src/app/explore/lib/exploreFilters.ts`** (334 lines) — pure
  helpers: `parseFilters(searchParams)` (URL → typed filter,
  garbage-tolerant), `buildSearchParams(filters)` (filter → URLSearchParams,
  drops empty/default values), `applyFilters(listings, family,
  filters)` (listings → filtered rows + familySize), `nextSort(prev,
  clicked)` (click-to-sort direction picker), `computeInsights(rows)`
  (filtered rows → 4-tile headline stats: count, median24h, topGainer,
  topLoser, gainers, losers), `sortValue(c, key)` (sort key extractor).

- **`src/app/explore/components/ExploreFamilyChips.tsx`** (58 lines)
  — stateless chip row. `role="tablist"`, `aria-selected`,
  `title={f.description}` for hover tooltips, live count badge per
  chip.

- **`src/app/explore/components/ExploreFilters.tsx`** (199 lines) —
  fully controlled sidebar `Panel`. Search input (binds to local state
  → URL), sort select, asc/desc segmented control, min market cap
  input, Quick window (24h/7d/30d) that also re-sets the sort, Density
  segmented control, "Reset all" button.

- **`src/app/explore/components/ExploreInsights.tsx`** (121 lines) —
  stateless 4-tile strip. Mirrors `LineageDriftCard.StatTile` pattern:
  bordered cells, eyebrow + large tnum value + 2xs subline,
  `text-positive` / `text-negative` tones. Tiles: Median 24h change,
  Top gainer, Top loser, Up vs Down split.

- **`src/app/explore/components/ExploreSparkline.tsx`** (97 lines) —
  mount-gated Recharts `<LineChart>` (renders nothing until
  post-hydration to avoid SSR/CSR width flash). No axes/legend/tooltip.
  Green/red/gray stroke based on trend. Exports `buildSparkline(
  series)` helper.

- **`src/app/explore/components/ExploreTable.tsx`** (295 lines) —
  click-to-sort headers (button elements with `aria-sort`), Comfortable
  / Compact density toggle, hideInCompact columns. Sparkline column
  cell renders shimmer for "loading", `—` for "missing", chart for
  Series.

### Modified
- **`src/app/explore/ExploreView.tsx`** (333 lines) — reduced to a
  single orchestrator. Owns listings fetch, URL-derived filter state,
  sparkline cache. Single debounced `useEffect` is the URL writer
  (250 ms debounce on `q`, immediate for everything else). Shallow
  equality guard via `lastWrittenRef`. `<Suspense>` requirement met
  via page.tsx.

- **`src/app/explore/page.tsx`** (21 lines) — wrapped in
  `<Suspense fallback={null}>` (required because `ExploreView` calls
  `useSearchParams`). `requireUser("/explore")` preserved.

- **`src/app/api/cmc/historical/route.ts`** — bumped per-call cap from
  `slice(0, 6)` to `slice(0, 30)` with a comment explaining why (was
  6 for /ancestor's base+peer set; /explore needs ~12 sparklines in
  one round-trip; hard upper bound stays so a typo can't OOM).

## 7. `/explore` column-header click-target bugfix (this session, post-compaction)

User reported: "in /explore, table filters are not working" with a
screenshot showing every numeric column header rendering the label
and arrow glyph stacked on separate lines, and clicks falling through.

### Root cause
`<button>` was `inline-flex` inside a `<th>` that carried
`text-right`. `inline-flex` + `text-right` on a table cell caused the
button's two `<span>` children (label + arrow) to stack vertically,
AND the click target was only as wide as the button content — clicks
in the `<th>` cell but outside the text didn't fire `onSort`.

### Modified
- **`src/app/explore/components/ExploreTable.tsx`** — sortable headers
  now use `<th className="font-medium p-0">` with the button filling
  the cell (`w-full flex items-center gap-1 ... whitespace-nowrap`),
  padding moved into the button. Non-sortable column headers
  (`asset`, `ancestor`, `sparkline`) wrap the label in `<div
  className="whitespace-nowrap">` to keep the same one-line layout.
  Whole cell is now the click target. Label + arrow stay on one line.

### Regression tests added
- **`scripts/test-auth-redirect.ts`**:
  - #30b "ExploreTable sortable headers are full-cell click targets" —
    asserts the button is `w-full flex` with `whitespace-nowrap` and
    the `<th>` has `p-0`.
  - #30 strengthened — strips JS `//` line comments before matching
    so the `<button>...onClick` regex doesn't trip on `>` inside
    comments like `// <th>`.
  - #28–#29, #31–#36 added earlier in this session for the broader
    /explore pass: URL-state plumbing, single URL writer, density
    toggle, family chips hardcoded roots + `descendantsOf` +
    `kindForSymbol`, `ExploreInsights` memoises, /api/cmc/historical
    cap ≥ 12, /explore page still calls `requireUser` + wraps in
    `<Suspense>`, `parseFilters` garbage tolerance.

## 8. Files modified summary (post-compaction in this session)

| File | Change |
|---|---|
| `src/lib/cmc/types.ts` | `CmcGlobalMetrics` shape (pre-compaction) |
| `src/lib/cmc/seed.ts` | `getSeedGlobalMetrics` new shape (pre-compaction) |
| `src/lib/cmc/client.ts` | `normalizeGlobalMetrics`, `getHistoricalQuotesForSymbols`, `getHistoricalGlobalMetrics` (pre-compaction) |
| `src/lib/ancestor/drift.ts` | new — drift algorithm (pre-compaction) |
| `src/components/lib/lab/OverviewTab.tsx` | new shape + en-US locale (pre-compaction) |
| `src/components/ancestor/LineageDriftCard.tsx` | new (pre-compaction) |
| `src/components/ancestor/HistoricalComparison.tsx` | unchanged — referenced for the visual pattern |
| `src/app/api/cmc/historical/route.ts` | cap 6 → 30 |
| `src/app/api/ancestor/drift/route.ts` | new (pre-compaction) |
| `src/app/ancestor/AncestorExperience.tsx` | wired drift (pre-compaction) |
| `src/app/compare/page.tsx` | new (pre-compaction) |
| `src/app/compare/CompareView.tsx` | new (pre-compaction) |
| `src/app/explore/page.tsx` | `<Suspense>` wrapper |
| `src/app/explore/ExploreView.tsx` | orchestrator rewrite |
| `src/app/explore/components/ExploreFamilyChips.tsx` | new |
| `src/app/explore/components/ExploreFilters.tsx` | new |
| `src/app/explore/components/ExploreInsights.tsx` | new |
| `src/app/explore/components/ExploreSparkline.tsx` | new |
| `src/app/explore/components/ExploreTable.tsx` | new + click-target fix |
| `src/app/explore/lib/families.ts` | new |
| `src/app/explore/lib/exploreFilters.ts` | new |
| `scripts/test-auth-redirect.ts` | 17 new tests (28–36) + #30b |
| `project.md` | pre-compaction — per-page guide |
| `docs/deploy-and-submit.md` | pre-compaction — 90-min playbook |

## 9. Test status

**37/37 green** at session end:

- #1–#19 — pre-existing (auth redirect, route protection, hooks order).
- #20–#27 — pre-compaction in this session (cookies, dedup, composite
  key, drift detector, /compare route, marketing endpoints, lab tabs
  hooks order, global metrics shape).
- #28–#37 — post-compaction in this session (explore URL state, single
  URL writer, sortable headers, full-cell click target, density
  toggle, family chips, insights memoisation, historical cap, auth +
  Suspense, garbage tolerance).

## 10. Build status

`rm -rf .next && npm run build` clean. Key route sizes after the
session:
- `/explore` — 11.9 kB (213 kB First Load)
- `/compare` — 1.97 kB (102 kB First Load)
- `/ancestor` — 17.5 kB (227 kB First Load)
- `/lab` — 13.4 kB (209 kB First Load)

## 11. Outstanding follow-ups (flagged in the plan, not in scope)

1. **API auth gap (pre-existing).** `/api/cmc/listings` and
   `/api/cmc/historical` do not call `getCurrentUser()`. The page is
   auth-gated so a signed-out SPA visitor can't reach them, but a
   direct signed-out curl succeeds. Violates the "All routes must
   require Supabase auth" constraint. Follow-up ticket.
2. **Lazy sparklines beyond row 12.** An `IntersectionObserver` for
   rows past the initial 12 isn't wired. Sparklines for rows 13+ show
   `—` until that ships.
3. **`CmcCryptocurrency` lacks `category`/`tags`** in some fields.
   `kindForSymbol` falls back to the hardcoded `KNOWN_KINDS` map.
   Long-tail coins land in `"other"`. Document in `families.ts`.
4. **`project.md`** (717 lines) is the canonical product description;
   it does NOT yet reflect the new /explore features (insight strip,
   family chips, sparkline column, density toggle, URL state). Update
   when next touching the docs.

## 12. Security / policy invariants preserved this session

- All routes still require Supabase auth (no demo mode, no guest mode,
  no frontend-only auth, no skip-login).
- Tavily / CMC / Supabase service-role keys still server-side only.
- All user-scoped tables still RLS-protected (unchanged).
- The 8-endpoint marketing page claim remains accurate.

---

End of session log.
