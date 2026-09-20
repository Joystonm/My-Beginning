# Project: Who Is My Ancestor

A lineage engine for the CoinMarketCap universe. Pick any cryptocurrency
and discover the family tree it sits in — code forks, platform tokens,
wrapped versions, inspiration chains — plus a 30-day "what's moving in
the family" headline across every descendant.

Built for the **CoinMarketCap × DoraHacks API Hackathon** (Sep 2026).
Track: **Data & Visualisation**. See [`hackathon.md`](./hackathon.md) for
the brief; [`docs/deploy-and-submit.md`](./docs/deploy-and-submit.md) for
the shipping playbook.

---

## 1. What the product does

The product answers one question for any CMC-tracked asset:

> **What is this asset descended from, and what's the rest of its
> family tree doing right now?**

Concretely:

- **`/ancestor?symbol=BTC`** — shows the lineage graph walking up from
  BTC (which has no ancestors — it is the spiritual origin of all
  altcoins) plus the **lineage drift** card: every direct descendant
  of BTC, ranked by 30-day price return, with the family median
  compared to BTC's own return and to the broader crypto market.
- **`/ancestor?symbol=ETH`** — shows BTC as ETH's inspiration ancestor
  (confidence 1.0), then walks down to every ERC-20 token, EVM L2,
  wrapped BTC, etc. that ETH is the platform for. Lineage drift shows
  which ETH-family assets are the strongest and weakest movers.
- **`/compare?from=BTC&to=ETH`** — a single dense page answering "how
  are these two related?". Direct edge (BTC → ETH, inspiration),
  shared ancestors, side-by-side 30-day returns. This is the
  shareable URL — the demo video's central artifact and the X post
  template.
- **`/lab?tab=evidence`** — an inspectable log of every CMC call the
  app makes. Endpoint, parameters, timing, credit cost, tier-safe
  sample. The judges' "did you actually use the API?" question has a
  one-click answer.
- **`/lab?tab=global`** — live global market metrics with the same
  source-of-truth UI. The headline number on the marketing landing
  page is rendered from this endpoint.
- **`/lab?tab=compare`** — side-by-side asset analysis across 6
  dimensions (market cap tier, turnover, momentum, volatility, pair
  breadth, supply) with a radar chart and a percentile-rank table.

The product is intentionally **not** "another dashboard of charts." The
flagship experience is the lineage question; everything else supports
it.

---

## 2. Pages — what each route does

Every route lives in `src/app/`. Two rules apply across the board:

1. **The marketing landing (`/`) is the only public page.** Everything
   else runs `await requireUser(nextPath)` at the top of its server
   component — unauthenticated visitors are redirected to
   `/login?next=<original-path>`.
2. **Routes ending in `page.tsx` are server components.** Heavy lifting
   (CMC calls, lineage walks, drift fetches) happens server-side; the
   browser only sees the rendered HTML and a small client bundle for
   interactivity.

### 2.1. `/` — Marketing landing (public)

`src/app/page.tsx`. The first thing every visitor sees — including
guests and search-engine crawlers.

- **Hero**: "Every asset has a lineage. Find yours." The CTA copy
  branches on auth state: guests see "Find an ancestor" (linked
  through `ProtectedLink`), signed-in users see "Open Ancestor" (a
  direct `<Link>` to `/ancestor`).
- **Lineage preview SVG**: a static illustration of a 3-tier
  ancestor/descendant tree, no data behind it — pure visual hook.
- **"How it works"**: 3-step explanation (fetch CMC universe → walk
  curated lineage graph → render the family tree).
- **"The product"**: 4 feature cards (Ancestor engine, Lineage drift,
  Compare, Evidence log).
- **API evidence section**: the eight CMC endpoint chips
  (`GET /v1/cryptocurrency/listings/latest` etc.) — visible proof of
  which endpoints the app uses.
- **Footer**: editorial links + protected routes via `ProtectedLink`.

### 2.2. `/login` — Sign in / sign up

`src/app/login/page.tsx` + `LoginView.tsx`. Single page that toggles
between "sign in" and "create account" modes. Reads `?next=` from the
URL and redirects there after successful auth. The `sanitizeNext()`
helper blocks open-redirect attempts (`//evil.com`,
`javascript:alert(1)`, etc.) — locked in by a regression test.

When Supabase env vars are missing, the page renders an "auth not
configured" empty state instead of the form.

### 2.3. `/auth/sign-in` and `/auth/sign-up` — Aliases

`src/app/auth/sign-in/page.tsx` and `src/app/auth/sign-up/page.tsx`.
Both currently `redirect()` to `/login`. The aliases exist so that
Supabase's default email-template links (which use `/auth/sign-in`)
don't 404.

### 2.4. `/ancestor` — The flagship experience

`src/app/ancestor/page.tsx` + `AncestorExperience.tsx`. The single
most important page in the app.

What the user sees (in order, top to bottom):

1. **Hero**: "Who is my ancestor?" + a search box (`AssetSearch`).
   Placeholder suggests "Try BTC, ETH, SOL, DOGE, USDT…"
2. **Breadcrumb of drilled-down symbols** (if you've drilled into an
   ancestor's lineage).
3. **Base profile panel** (`BaseProfilePanel`): name, price, market
   cap, 24h change, rank, "Save to universe" button.
4. **Coin Story** (`CoinStory.tsx`): the first-person "I am
   <Name>" narrative. Tier 0 = static archive (20 coins), Tier 1 =
   persisted cache, Tier 2 = fresh Tavily + LLM, Tier 3 = fallback
   sketch.
5. **Lineage panel**: walks the curated graph up from the base.
   Renders an interactive `LineageGraph` (the curated edges,
   direction-labelled). Each ancestor card below shows relation type,
   confidence, and the one-sentence note.
6. **Radar profile + Universe context**: side-by-side
   `RadarProfile` (base's fingerprint across 6 dimensions vs the
   universe median) and `UniverseContext` (the same fingerprint vs
   the broader 250-asset universe).
7. **Historical comparison** (`HistoricalComparison.tsx`): 30-day
   normalised price chart for the base vs its closest relatives.
   Series symbols are deduped with a `Set` — regression-tested.
8. **Lineage drift card** (`LineageDriftCard.tsx`): the
   newsworthy headline. Family median 30d return, base 30d return,
   family-vs-base delta, family-vs-market delta, biggest gainer,
   biggest loser, and a bar list of every evaluated descendant.
9. **Ancestor cards**: one card per direct ancestor edge, with
   relation, confidence, notes. Cards use composite
   `${symbol}-${index}` keys — regression-tested.
10. **API evidence footer** link: "See the API evidence →" jumps to
    `/lab?tab=evidence`.

URL contract: `/ancestor?symbol=BTC`, `/ancestor?symbol=ETH`, etc. The
symbol is uppercased server-side.

### 2.5. `/compare?from=A&to=B` — The shareable URL

`src/app/compare/page.tsx` + `CompareView.tsx`. Server-rendered,
auth-gated. One URL, one decision — the demo video's central
artifact and the X post template.

URL examples:
- `/compare?from=BTC&to=ETH` — "Bitcoin descends from nothing; Ethereum
  descends from Bitcoin via inspiration (confidence 100%). Shared
  ancestor: BTC. Family median returns over 30d: BTC +X%, ETH +Y%."
- `/compare?from=ETH&to=SOL` — "SOL descends from ETH via inspiration
  (95%). Shared ancestors: BTC. SOL is the stronger performer."
- `/compare?from=BTC&to=DOGE` — "DOGE descends from BTC via the
  BTC→LTC→Luckycoin→DOGE chain. Shared ancestors: BTC, LTC."

What the user sees:

1. **Title**: "<FromName> <FROMSYM> vs <ToName> <TOSYM>" with a
   "share this URL" affordance.
2. **Direct relationship**: the curated edge (or "no direct edge"
   state if neither direction has one in the graph).
3. **Side-by-side 30-day returns**: two `AssetPanel`s with price,
   market cap, and 30d return.
4. **Shared ancestors**: the intersection of both assets'
   `lineage_chain` sets, clickable to drill into any of them.
5. **Source footer**: the four endpoints used (`/listings/latest`,
   `/quotes/latest`, `/quotes/historical`,
   `/global-metrics/quotes/historical`).

Validation: invalid symbol format → 400; symbol not in top 250 → 404
with explanation; same symbol on both sides → "pick two different".

### 2.6. `/lab` — Market Lab (5 tabs)

`src/app/lab/page.tsx` + `components/lib/lab/MarketLab.tsx`. A
workspace for the underlying data. Tabs are URL-driven via
`?tab=<id>`.

#### 2.6.1. `/lab?tab=overview` — `OverviewTab.tsx`

The macro picture. Renders global market metrics from
`/v1/global-metrics/quotes/latest`:

- Total market cap, 24h volume, 24h change
- BTC dominance, ETH dominance, and the rest of the top-10 by
  dominance share
- A sparkline of recent activity

This is the "what's the market doing right now" surface — the
headline number on the marketing landing is fed from here.

#### 2.6.2. `/lab?tab=compare` — `CompareTab.tsx`

Side-by-side asset analysis.

- Search-and-add up to 5 assets (defaults to `["BTC", "ETH"]`).
- **Radar chart** — 6 dimensions (market cap tier, turnover,
  momentum 7d, volatility, market pairs, listing maturity), each
  scored as a percentile within the top-250 universe (handles
  different scales by log-rank normalisation).
- **Per-asset metrics table** — price, market cap, 24h volume,
  turnover %, 24h/7d/30d performance, market pairs, listing year.
- URL shareable: `/lab?tab=compare&symbols=BTC,ETH,SOL`.

Locked in by the hooks-order regression test (`useMemo(radarData)`
must run before any early return).

#### 2.6.3. `/lab?tab=explorer` — `ExplorerTab.tsx`

The data explorer. Browse and filter the top-250 universe:

- Sortable table (rank, name, price, 24h change, 7d change, market
  cap, volume, supply, pairs, listing date).
- Free-text filter across symbol + name.
- Click any row → jump to that asset's `/ancestor` page.

This is the "show me what's actually in the universe" surface — the
table view of the same data that powers the lineage engine.

#### 2.6.4. `/lab?tab=evidence` — `EvidenceTab.tsx`

The credibility tab. Renders the sanitized CMC call log from
`/api/cmc/evidence`:

- Endpoint, parameters, requested-at timestamp, duration, credit
  cost.
- Tier-safe response sample (truncated, no API key, no internal
  fields).
- A "did you actually use the API?" answer that judges can verify
  in one click.

This is the technical-objection closer. If a judge wonders whether
the lineage data is real, this tab proves it.

#### 2.6.5. `/lab?tab=ai` — `AiTab.tsx`

Natural-language interface over the same data.

- **Ask panel**: "Top 100 by market cap, ranked by 7d change" →
  deterministic NL parser converts to a structured query → renders
  a sorted, filtered table.
- **Explain panel**: pick any asset → "Explain why SOL and ETH are
  similar" → runs the lineage engine and produces a prose
  explanation grounded in actual graph edges.

Runs deterministically without any LLM. When `ANTHROPIC_API_KEY` is
set, the explainer can be refined by Claude — but the source of
truth is always the pre-calculated graph.

### 2.7. `/explore` — Browse the universe

`src/app/explore/page.tsx` + `ExploreView.tsx`. A simpler, single-
purpose version of the explorer tab — no tabs, no overlays, just the
top-250 table with sort + filter. The lighter-weight entry point for
users who want to browse without the full Market Lab UI.

### 2.8. `/universes` — My universes

`src/app/universes/page.tsx` + `UniversesView.tsx`. User-created
asset collections.

- Create a universe ("Layer 1", "My portfolio", "DePIN summer").
- Add assets by symbol or by browsing.
- Open any universe in Market Lab's compare tab to see them
  side-by-side.
- **Persistence**: when Supabase env vars are set, universes are
  stored in the `universes` / `universe_assets` tables (RLS
  enforced). When they're not, universes degrade to
  `localStorage` — the UI shows a small "not synced" badge.

### 2.9. `/my-universes` — Alias

`src/app/my-universes/page.tsx`. Same as `/universes` — just an
alias for users who type the more verbose path.

### 2.10. `/market-lab` — Alias

`src/app/market-lab/page.tsx`. Same as `/lab`. Some users type this
from habit (older products often used "market-lab" as a path); the
alias keeps the link working.

### 2.11. The `/api/*` routes

All server-side, all auth-checked. The browser never sees the API
key.

| Route | What it does |
|---|---|
| `POST /api/ancestor` | Compute the lineage for a base symbol |
| `POST /api/ancestor/drift` | Compute the lineage drift (30-day family moves) |
| `POST /api/cmc/listings` | Proxy to `/v1/cryptocurrency/listings/latest` |
| `POST /api/cmc/quote` | Proxy to `/v1/cryptocurrency/quotes/latest` |
| `POST /api/cmc/historical` | Proxy to `/v1/cryptocurrency/quotes/historical` |
| `GET /api/cmc/global` | Proxy to `/v1/global-metrics/quotes/latest` |
| `GET /api/cmc/evidence` | Sanitized CMC call log for the Evidence tab |
| `POST /api/story` | Run the story orchestrator for a base symbol |
| `POST /api/market-lab/compare` | Server-side variant of the compare-tab radar math |
| `POST /api/ai/explain` | LLM-refined lineage explanation (optional) |
| `POST /api/ai/parse` | NL → structured query for the Ask panel |
| `GET /api/universes` | List the current user's universes |
| `POST /api/universes` | Create a new universe |
| `PATCH /api/universes/[id]` | Rename / describe a universe |
| `DELETE /api/universes/[id]` | Delete a universe |
| `POST /api/universes/[id]/assets` | Add an asset to a universe |
| `DELETE /api/universes/[id]/assets` | Remove an asset |
| `POST /api/auth/login` | Sign in |
| `POST /api/auth/signup` | Create account |
| `POST /api/auth/logout` | Sign out |
| `GET /api/auth/session` | Current session |

---

## 3. The eight CMC endpoints

Every call goes server-side through `src/lib/cmc/client.ts`. The API key
never reaches the browser. In-memory cache with tier-aware TTLs
(90s for `/listings`, 5min for `/info`); exponential backoff retries;
sanitized call records exposed at `/api/cmc/evidence`.

| Endpoint | Used for |
|---|---|
| `GET /v1/cryptocurrency/listings/latest` | Universe of top 250 assets (Ancestor, Lab, Explore, /compare) |
| `GET /v1/cryptocurrency/quotes/latest` | On-demand quotes for a symbol set |
| `GET /v1/cryptocurrency/quotes/historical` | 30-day price history (HistoricalComparison + LineageDrift) |
| `GET /v1/cryptocurrency/info` | Metadata: date added, tags, description |
| `GET /v1/cryptocurrency/market-pairs/latest` | Market-pair breadth signal |
| `GET /v1/global-metrics/quotes/latest` | Market Lab Overview tab |
| `GET /v1/global-metrics/quotes/historical` | Family-vs-market return delta in LineageDrift |
| `GET /v1/exchange/listings/latest` | Exchange-presence signal |

All eight are visible on the marketing landing page as a literal list
of `GET /v1/...` chips under "Built on real CoinMarketCap data".

---

## 4. How the lineage engine works

The engine lives in `src/lib/ancestor/`. Algorithm version `2.0.0`
(there was a `1.x` statistical-similarity engine; it was deliberately
replaced — see "Technical decisions" below).

### 3.1. The curated graph (`lineage.ts`)

~90 hand-reviewed edges covering the top 100 assets, each with:

- `parent` / `child` (a directed edge: child descended from parent)
- `relation`: `fork` | `platform` | `wrapped` | `inspiration` | `conceptual`
- `confidence` (0..1)
- `notes` (a one-sentence human-readable explanation)
- `source: "curated"` (vs `"tavily"` for the long tail)

Examples:
- `BTC → LTC` (fork, 1.0) — Litecoin forked Bitcoin's code in 2011.
- `BTC → ETH` (inspiration, 1.0) — Ethereum (2015) extended Bitcoin's
  blockchain concept with a Turing-complete VM.
- `ETH → USDT` (platform, 1.0) — Tether is issued as an ERC-20 on
  Ethereum.
- `BTC → DOGE` (chain: BTC → LTC → Luckycoin → DOGE).
- `ETH → WBTC` (platform, 1.0) — wrapped Bitcoin on Ethereum.
- `SOL → BONK` (platform, 1.0) — SPL meme token on Solana.

### 3.2. Engine invariants (enforced at resolution time)

1. The selected asset is **always the root**. It is never its own
   ancestor, never its own descendant.
2. A descendant of the selected asset **can never appear as one of its
   ancestors** (direction is determined independently from where the
   node sits on screen).
3. The graph **must be acyclic**. If a cycle is detected, the
   offending edge is dropped at resolution and a warning is logged;
   the rest of the graph still renders.
4. Each relationship carries an **explicit direction** from the base's
   perspective — never inferred from visual position. The UI labels
   every section by that direction.

### 3.3. Tavily enrichment for the long tail

The curated graph covers the top 100. For coins outside it (e.g. an
emerging L1 or a long-tail alt), the engine asks Tavily what the asset
was forked from / descended from and parses the response. This keeps
the lineage answer useful even when the curated graph doesn't have an
explicit edge.

### 3.4. Lineage drift (`drift.ts`)

A separate algorithm that answers "what's moving in the family?".

For a base asset, it:
1. Walks direct descendants from the curated graph.
2. Filters to those in the top 100 by current rank.
3. Fetches 30-day price history from `/quotes/historical` for each
   descendant + the base itself (batched).
4. Fetches 30-day total market cap from
   `/global-metrics/quotes/historical` for the family-vs-market delta.
5. Computes simple percent return over the window for every entry.
6. Surfaces the biggest gainer, biggest loser, family median return,
   base return, family-vs-base delta, and family-vs-market delta.

The headline that ends up on the page is a sentence built from these
six numbers, e.g. *"ETH's strongest descendant in 30 days is SOL
(+18.3%). The weakest is BCH (-4.1%). Family median is +3.2%. Family
outperformed ETH by 1.4 points and beat the broader market by 2.1
points."*

This is the demo's "wow" — newsworthy, screenshot-bait, X-postable.

---

## 5. Architecture

```
                  ┌─────────────────────────────────────────────┐
                  │           Next.js (App Router)              │
                  │                                             │
   Browser ────▶  │   /        /ancestor   /compare   /lab      │
                  │   /explore /universes  /login              │
                  │                                             │
                  │   /api/*  ─┬─▶ CMC client (server, cached)  │
                  │            ├─▶ Lineage engine (curated+Tav) │
                  │            ├─▶ Lineage drift (30d history)  │
                  │            ├─▶ Story orchestrator           │
                  │            └─▶ AI explainer (opt., LLM)     │
                  │                                             │
                  └────┬──────────────────────────┬────────────┘
                       │                          │
                       ▼                          ▼
              ┌────────────────┐         ┌─────────────────┐
              │  CoinMarketCap │         │  Supabase       │
              │  API (8 endp.) │         │  (Auth, users,  │
              └────────────────┘         │   universes)    │
                       │                 └─────────────────┘
                       ▼
              ┌────────────────────────────┐
              │  In-memory cache + retry   │
              │  Sanitized call records →  │
              │     /api/cmc/evidence      │
              └────────────────────────────┘
```

### 4.1. Project layout

```
src/
  app/                          # Next.js App Router
    page.tsx                    # Marketing landing
    ancestor/                   # Flagship experience
    compare/                    # /compare?from=A&to=B
    lab/                        # Market Lab tabs
    universes/                  # User asset collections
    explore/                    # CMC universe browser
    auth/                       # Sign in / sign up
    api/                        # Server routes
      ancestor/                 # POST /api/ancestor
      ancestor/drift/           # POST /api/ancestor/drift
      auth/                     # login, logout, session, signup
      cmc/                      # listings, quote, historical, evidence, global
      market-lab/compare/
      story/                    # Coin story generator
      universes/                # CRUD for user collections
      ai/                       # explain, parse (LLM-backed)
  components/
    design-system/              # Primitives (Button, Input, Panel, …)
    shell/                      # Header, footer, ProtectedLink, AccountMenu
    ancestor/                   # AssetSearch, LineageGraph, AncestorCard,
                                # HistoricalComparison, LineageDriftCard, …
    lib/lab/                    # Market Lab tabs (Compare, Explorer, …)
    auth/                       # AuthProvider, ProtectedRoute
  lib/
    cmc/                        # Server-only CMC client
    ancestor/                   # Lineage engine + drift
    stories/                    # Story orchestrator + static archive
    supabase/                   # Browser + server clients (getAll/setAll)
    universes/                  # Local + Supabase storage
    ai/                         # Deterministic NL parser + explainer
    auth/                       # guard, redirect, getCurrentUser
    tavily/                     # Tavily research client
  types/
supabase/
  migrations/                   # SQL migrations
docs/
  deploy-and-submit.md          # Submission playbook
scripts/
  test-auth-redirect.ts         # 26 route-protection + regression tests
  test-story-orchestrator.ts    # Story orchestrator tests
  test-hierarchy.ts             # Hierarchy / lineage tests
```

---

## 6. The Coin Story feature

When the user opens `/ancestor?symbol=BTC`, below the lineage graph
they see a first-person story written **as if the asset were speaking
about itself**. The story generator is a three-tier cascade:

1. **Tier 0 — static archive** (`src/lib/stories/static.ts`). 20
   hand-written verified stories for BTC, ETH, SOL, XRP, ADA, DOGE,
   LTC, BCH, DOT, MATIC, LINK, AVAX, USDC, USDT, UNI, ATOM, XLM, TRX,
   ETC, BNB. Each entry has verified timeline dates, real public
   source URLs, and a research hash. This absorbs 95% of search-as-
   you-type traffic without burning Tavily or LLM credits.
2. **Tier 1 — persisted cache**. If a previous visitor's research was
   saved, reuse it.
3. **Tier 2 — fresh research**. Tavily lookup → LLM write (using
   Anthropic if `ANTHROPIC_API_KEY` is set) → persist.
4. **Tier 3 — fallback**. If neither LLM nor research produces a story,
   render a deterministic "I am <Name>. I was created in <year> by
   <founder>. I exist to <purpose>." sketch from the verified facts
   only — never invented.

The orchestrator is `src/lib/stories/orchestrator.ts`. The static
archive is the highest-impact piece: it makes the "I am Bitcoin"
feature feel fetched-from-the-internet even for the top 20 coins,
without spending a single API credit.

---

## 7. Authentication & data model

### 6.1. Auth (Supabase + `@supabase/ssr`)

- Every protected route runs `await requireUser(nextPath)` at the top
  of its server component. Unauthenticated visitors are redirected to
  `/login?next=<original-path>`.
- `/` (the marketing landing) is public. Sign-in link is visible in
  the header; full nav is shown only when authenticated.
- The Supabase server client uses the **canonical `getAll` / `setAll`
  cookie pattern** (Next.js 14 + `@supabase/ssr`). The older `get` /
  `set` / `remove` callback pattern silently no-ops in route handlers,
  which was a 401/500 bug in v0 — fixed and locked in by a
  regression test.
- `CMC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`,
  `ANTHROPIC_API_KEY` are server-only. None are exposed to the
  browser.

### 6.2. Supabase data model (with RLS)

```
profiles                  extends auth.users (display_name, preferences)
universes                 user-created asset collections
universe_assets           many-to-many universes ↔ assets
saved_queries             NL prompt → structured query history
ancestor_calculations     pre-computed relationships, versioned by algorithm_version
```

When Supabase env vars are missing, universes degrade to browser-
`localStorage` and the auth pages surface a clear "auth not
configured" empty state.

---

## 8. What makes it different (the pitch)

Most CMC integrations stop at "another dashboard of charts and a chat
box." This product uses CMC data to answer a *new* question — and it
does so in a way that makes the algorithm visible.

- **The lineage question is the flagship.** Not similarity, not
  price — genealogy. What is this asset descended from? The graph
  walks code forks, platform tokens, wrapped versions, inspiration
  chains, and conceptual lineage.
- **The algorithm is inspectable.** Every relationship has a
  relation type, a confidence, and a one-sentence note. Every API
  call is recorded and exposed at `/api/cmc/evidence`. The judges'
  question "did you actually use the API?" has a one-click answer.
- **No invented genealogy.** When no edge exists in the curated
  graph and Tavily can't find one, the engine reports an empty
  lineage rather than guessing.
- **The newsworthy headline.** The lineage drift card turns the
  lineage question into a "what's moving this week?" story: family
  median vs base, family vs market, biggest gainer, biggest loser.
  This is shareable on X and quotable in a pitch.
- **Editorial visual identity.** Light-first, neutral, restrained.
  Inter for UI, JetBrains Mono for numerals, tabular figures
  everywhere data appears. No gradients-as-aesthetic, no glowing
  cards. The AI feature is a thin supporting layer, not the
  product's identity.

---

## 9. Technical decisions

- **Editorial visual identity.** Single accent (deep teal) reserved
  for selection and primary action. No generative-AI styling. The
  product looks like a research tool, not a chat box.
- **Server-only CMC.** `CMC_API_KEY` and all other secrets live in
  env. Calls go through API routes only. Call records are sanitized
  before being exposed at `/api/cmc/evidence` so the browser sees
  endpoint names, parameters, and tier-safe samples — but never the
  API key.
- **Caching with sensible TTLs.** `/listings/latest` and
  `/global-metrics/*` cache for 90 seconds; `/info` and
  `/exchange/listings` for 5 minutes. Stays well within CMC rate
  limits while keeping responses snappy.
- **Tier-0 static archive for stories.** 20 verified stories cover
  the most-queried coins without spending any API credits. The user
  feels a real fetch happened, the wallet doesn't notice.
- **Batched historical fetches.** The drift card needs 30+ descendants'
  price history. The new `getHistoricalQuotesForSymbols()` client
  helper fans out in parallel, reusing the per-symbol cache + retry
  logic. One round-trip, no manual concurrency control.
- **Hooks-order discipline.** A file-level regression test parses
  every Market Lab tab and asserts that no early `return` appears
  before the last hook call. This locks in the fix for the
  "Rendered fewer hooks than expected" cascade that broke
  CompareTab in v0.
- **Composite keys for React lists.** Every list that may contain
  duplicate items uses `${symbol}-${index}` keys, not symbol alone.
  Locked in by regression test.
- **Graceful degradation.** Without Supabase, universes fall back to
  `localStorage`. Without Tavily or the LLM key, the story falls back
  to a deterministic sketch. The lineage answer is always available
  from the curated graph.

---

## 10. Testing

26 route-protection + regression tests in `scripts/test-auth-redirect.ts`,
plus dedicated suites for the story orchestrator and lineage
hierarchy. Run with `npm run test`.

```bash
npm run test:hierarchy    # Lineage graph + drift algorithm
npm run test:stories      # Story orchestrator
npm run test:auth         # Route protection + regression suite (26 tests)
npm run test              # All of the above
```

The regression suite locks in:
- `requireUser()` redirects when signed out
- All routes use `await requireUser()`
- `sanitizeNext()` blocks open redirects
- `/` (marketing) does NOT redirect; renders the landing page
- `SiteHeader` hides protected nav for guests
- `SiteFooter` is a client component using `ProtectedLink`
- `ProtectedLink` exists and routes through `/login?next=...`
- **Supabase server client uses `getAll` / `setAll`** (regression test
  for the 401/500 cookie bug)
- **HistoricalComparison dedupes series symbols** (regression test
  for the duplicate `BTC` `<Line>` key warning)
- **AncestorExperience uses composite keys** for ancestor cards
- **Lineage drift detector is wired in** (algorithm + UI + route +
  AncestorExperience all exist and reference each other)
- **Marketing page showcases ≥7 CMC endpoints** including both
  historical ones
- **`/compare` route exists, is auth-gated, reads `?from` / `?to`**
- **MarketLab tabs don't violate the hooks-order invariant**
  (file-level parser test across all 5 tabs)

---

## 11. Limitations & known gaps

- **Curated graph coverage is the top 100.** Beyond that, the engine
  relies on Tavily. The graph is reviewed before every deploy; new
  edges are added by hand with confidence scores.
- **Drift uses simple price return.** Not risk-adjusted. The headline
  is "who moved", not "who moved best". A Sharpe-adjusted variant is
  a clean follow-up.
- **The lineage graph visualises 2 hops.** The data model supports
  arbitrary depth; the UI stops at 2 hops for legibility.
- **The story generator's Tier 0 archive is 20 coins.** Adding the
  next 100 is mechanical (same verification process).
- **No persistence between deploys of the lineage drift cache.** Each
  cold request refetches 30+ days of history. Acceptable on the
  Startup tier; would need a persisted cache on Basic.

---

## 12. Running locally

```bash
# Install
npm install

# Configure
cp .env.example .env.local
# Fill in CMC_API_KEY at minimum. ANTHROPIC_API_KEY, TAVILY_API_KEY,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY are optional.

# Develop
npm run dev               # http://localhost:3000

# Verify
npm run test              # 30+ tests
rm -rf .next && npm run build

# Deploy
# See docs/deploy-and-submit.md
```

---

## 13. The 60-second pitch

> **Most CMC integrations are dashboards. This one is a question.**
>
> "What is this asset descended from?" Every cryptocurrency has an
> ancestry — code forks (LTC ← BTC), platform tokens (USDT/SHIB →
> ETH), wrapped versions (WBTC → BTC), inspiration chains (SOL →
> ETH → BTC). The lineage engine walks a curated graph plus live
> Tavily enrichment to render the family tree, with a 30-day
> "what's moving in the family" headline across every descendant.
>
> Built on 8 CoinMarketCap endpoints. Every API call is recorded
> and inspectable. No invented genealogy. One shareable URL per
> comparison.
>
> `/compare?from=BTC&to=ETH` is the demo.
