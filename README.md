# My Beginning

A new way to explore relationships inside the cryptocurrency universe.

Built for the **CoinMarketCap × DoraHacks API Hackathon**
([hackathon details](hackathon.md)).
Track: **Data & Visualisation**.

> Select a cryptocurrency and discover its market ancestors — calculated
> transparently across price behaviour, market structure, volume, supply,
> volatility and listing maturity, using CoinMarketCap data.

---

## What is the product?

Every asset has a market story. My Beginning makes that story
navigable.

The flagship experience — the **Ancestor** page — lets a user pick any
asset (BTC, ETH, SOL, …) and instantly see its closest market relatives.
Each relationship comes with:

- an overall similarity percentage,
- a per-dimension breakdown (market cap tier, turnover, momentum,
  volatility, pair breadth, supply, maturity),
- a deterministic narrative explanation of why the relationship exists.

From there, the user can drill down (treat any ancestor as the new base),
or jump into the **Market Lab** to compare assets side-by-side, build a
custom metric from raw CMC fields, or open the **API Evidence** log to
verify exactly which CoinMarketCap endpoints were called.

No fabricated genealogy. No invented prices. Just measurable market
kinship, computed deterministically and explained.

## Why is it different?

Most CMC integrations stop at "another dashboard of charts and a chat box".
This product uses CMC data to answer a *new* question — which assets
behave like which other assets, and why — and it does so in a way that
makes the algorithm visible. Every score is broken down. Every API call
is recorded and inspectable.

The visual identity is editorial and restrained, not generative-AI-styled.
The AI feature is a thin supporting layer, not the product's identity.

## How the Ancestor engine works

The algorithm lives in `src/lib/ancestor/`. Three stages:

1. **Ingest.** Server-side fetch of the top assets via
   `/v1/cryptocurrency/listings/latest`.
2. **Normalize.** Every asset becomes a vector across seven dimensions,
   each scaled to `[0, 1]`:
   - `market_cap_position` — log-bucket of market cap (handles BTC
     dominance without letting it dominate the score).
   - `turnover_position` — log-bucket of 24h volume ÷ market cap.
   - `momentum_7d` — percentile of trailing 7-day price change.
   - `short_volatility` — magnitude of short-term price swings.
   - `market_pair_breadth` — log-bucket of `num_market_pairs`.
   - `supply_scarcity` — `1 - circulating_supply / max_supply`.
   - `maturity` — log-bucket of days since listing.
3. **Compare.** Pairwise similarity is
   `1 − |base − candidate|` per dimension, then a weighted average
   becomes the overall score. Weights are configurable in
   `DEFAULT_DIMENSIONS`.

The algorithm version is stamped into every result and every persisted
relationship (`algorithm_version` field) so future revisions can
recalculate without losing lineage.

## CMC API endpoints used

Every endpoint below is called server-side only. The CMC API key never
reaches the browser.

| Endpoint                                          | Used for                                  |
| ------------------------------------------------- | ----------------------------------------- |
| `GET /v1/cryptocurrency/listings/latest`          | Universe of top assets (Ancestor, Lab, Explore) |
| `GET /v1/cryptocurrency/quotes/latest`            | On-demand quotes for a symbol set         |
| `GET /v1/cryptocurrency/info`                     | Metadata (date added, tags)               |
| `GET /v1/cryptocurrency/market-pairs/latest`     | Market pair breadth signal                |
| `GET /v1/global-metrics/quotes/latest`            | Market Lab Overview tab                   |
| `GET /v1/exchange/listings/latest`                | Exchange presence signal                  |

Sanitized call records — endpoint, parameters, timing, credit cost, tier-
safe sample — are exposed via `/api/cmc/evidence` and rendered in the
**API evidence** tab of Market Lab so judges can verify usage without
seeing secrets.

## Architecture

```
                 ┌──────────────────────────────────────────┐
                 │            Next.js (App Router)          │
                 │                                          │
   Browser ───▶  │   /ancestor  /lab  /universes  /explore  │
                 │                                          │
                 │   /api routes ─┬─▶ CMC client (server)   │
                 │                ├─▶ Ancestor engine       │
                 │                ├─▶ Market Lab service    │
                 │                └─▶ AI explainer (opt.)   │
                 │                                          │
                 └─────┬────────────────────────┬───────────┘
                       │                        │
                       ▼                        ▼
              ┌────────────────┐       ┌─────────────────┐
              │ CoinMarketCap  │       │ Supabase        │
              │ API            │       │ (Postgres, Auth)│
              └────────────────┘       └─────────────────┘
                       │
                       └─▶ In-memory cache (90s TTL)
```

### Project layout

```
src/
  app/                    # Next.js App Router
    page.tsx              # Landing
    ancestor/             # Flagship experience
    lab/                  # Market Lab (overview, compare, explorer, evidence, AI)
    universes/            # User collections (Supabase or browser-local)
    explore/              # CMC universe browser
    auth/                 # Sign in / sign up
    api/                  # Server routes (CMC, ancestor, auth, AI)
  components/
    design-system/        # Primitives (Button, Input, Panel, …)
    shell/                # Header, footer, config banner, auth indicator
    ancestor/             # AssetSearch, AssetHeader, AncestorCard, LineageGraph
    lib/lab/              # Market Lab tabs
  lib/
    cmc/                  # Server-only CMC client (caching, retry, evidence)
    ancestor/             # Engine: types, normalize, scoring
    supabase/             # Browser + server Supabase clients
    universes/            # Local + Supabase universes (dev-safe fallback)
    ai/                   # Deterministic NL parser + explainer
    utils.ts              # Formatting helpers
  types/
supabase/
  migrations/             # SQL migrations (profiles, universes, etc.)
```

## Supabase architecture

Schemas are in `supabase/migrations/`. The 0001 migration creates
`profiles`, `universes`, `universe_assets`, `saved_queries` and
`ancestor_calculations` tables with row-level security enabled.

The app degrades gracefully: when Supabase env vars are missing, universes
are stored in the browser via `localStorage` and the auth pages surface a
clear "auth not configured" empty state. None of the Ancestor experience
is gated behind authentication.

## Data model

```text
profiles                  — extends auth.users (display name, preferences)

universes                 — user-created asset collections
universe_assets           — many-to-many universes ↔ assets (CMC id, symbol, name)

saved_queries             — NL prompt → structured query history (AI explainer)

ancestor_calculations     — pre-computed relationships, indexed by base symbol,
                             versioned by algorithm_version
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in CMC_API_KEY at minimum.

# 3. (Optional) Provision Supabase
#    - Create a project at supabase.com
#    - Run the SQL in supabase/migrations/0001_init.sql
#    - Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#      SUPABASE_SERVICE_ROLE_KEY into .env.local

# 4. Run locally
npm run dev
# Open http://localhost:3000
```

## Environment variables

| Variable                          | Required?     | Description                                       |
| --------------------------------- | ------------- | ------------------------------------------------- |
| `CMC_API_KEY`                     | **Yes** for live data | Server-side CoinMarketCap key (Startup tier or higher recommended) |
| `NEXT_PUBLIC_SUPABASE_URL`        | Optional      | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Optional      | Supabase anon key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`       | Optional      | Supabase service role (server-only)               |
| `ANTHROPIC_API_KEY`               | Optional      | Enables AI-refined ancestor explanations          |

Variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle.
CMC and Anthropic keys are server-only.

## Running locally

```bash
npm run dev        # Next dev server (port 3000)
npm run build      # Production build
npm run start      # Run production build
npm run typecheck  # TypeScript-only check
npm run lint       # Next.js lint
```

## Demo flow (≈ 3 minutes)

1. **Open** the app — landing page shows the Ancestor concept immediately.
2. **Pick a known asset** — `BTC` or `ETH` (top of `/explore`).
3. **Click "Find My Ancestor"** — see the lineage graph and the
   weighted similarity breakdown for each ancestor.
4. **Click an ancestor** — drill into it as the new base. Confirm the
   explanation matches the numbers shown.
5. **Open Market Lab** — switch to the *API evidence* tab. Verify the
   recent call list shows real CMC endpoints with timings and credits.
6. **Build a custom metric** — Data explorer → Custom calculations.
   Pick numerator and denominator, see the formula, see the ranking.
7. **Create a universe** — e.g. "Layer 1". Add 3 assets, then click
   "Open in Lab" to compare them on the radar chart.
8. **Ask in Lab** — try: *"Top 100 by market cap, ranked"*. See the
   structured query the parser produces.

## Technical decisions

- **Editorial visual identity.** Light-first, neutral, restrained. No
  gradients-as-aesthetic, no glowing cards. A single accent (deep teal) is
  reserved for selection and primary action.
- **Editorial typography.** Inter for UI, JetBrains Mono for numerals.
  Tabular figures everywhere data appears.
- **Server-only CMC.** API keys live in `CMC_API_KEY` and never reach the
  browser. Calls are made from Next.js API routes; evidence is sanitized
  before being exposed at `/api/cmc/evidence`.
- **Caching with sensible TTL.** `/listings/latest` and `/global-metrics`
  cache for 90 seconds; `/info` and `/exchange/listings` for 5 minutes.
  This stays well within CMC rate limits while keeping responses snappy.
- **Deterministic algorithm.** Same inputs produce the same scores. The
  version is stamped into every relationship so it can be re-run later
  without breaking lineage.
- **AI as a thin layer.** A rule-based parser converts natural-language
  prompts into structured queries for the Data Explorer. A deterministic
  explainer turns ancestor scores into prose. Both run without any LLM.
  When `ANTHROPIC_API_KEY` is set, the explainer can be refined by
  Claude — but the source of truth is always the pre-calculated scores.
- **Graceful degradation.** When CMC or Supabase keys are missing, the
  UI shows meaningful empty states. The Ancestor experience is never
  blocked behind auth.

## Known limitations

- The 30-second "live" window for `/listings/latest` is conservative; the
  Startup tier allows tighter caching if credits permit.
- The volatility dimension currently uses short-term change magnitudes as
  a proxy. A planned upgrade is to compute true return volatility from
  `/quotes/historical` for top candidates only (avoids a 250-asset
  fan-out).
- The lineage visualization is intentionally compact; on wide screens
  there is room to add a third tier ("descendants of relatives") — left
  out for clarity.
- The Anthropic refinement is opt-in and not part of the deterministic
  demo path. The deterministic explainer is always available.

## Future possibilities

- Persisted ancestor calculations refreshed on a cron, surfaced as
  "trending lineages".
- Embedding the lineage visualization as a public embed for blog posts
  and research notes.
- Cross-chain lineage comparisons using CMC's per-platform tagging.
- A "compare ancestor sets" mode — show two base assets and the union of
  their ancestor sets as a Venn diagram.
- Optional on-chain enrichment (DEX liquidity, holder distribution) as a
  future dimension.

---

Built for the CoinMarketCap API Hackathon by a solo developer in 21 days.
#BuildwithCMC