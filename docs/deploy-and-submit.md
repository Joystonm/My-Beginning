# Deploy & Submit — CMC API Hackathon Playbook

This doc is the 90-minute path from "code on my laptop" to "judges can
click a link." If you follow it start to finish, you'll have a deployed
URL, a recorded demo, an X post, and a DoraHacks submission — all before
the 30 Sep 23:59 UTC deadline.

> **Time budget**
> - 30 min: deploy to Vercel
> - 10 min: smoke-test the deployed URL
> - 20 min: record the demo video
> - 15 min: X post + DoraHacks submission
>
> Total: ~75 min. Leave 30 min for hiccups.

---

## 1. Pre-flight checklist

Before deploying, verify locally:

```bash
# Build cleanly
rm -rf .next
npm run build

# Tests all pass
npm run test
```

Both must be green. The build output should show the new `/compare`
route and `/api/ancestor/drift` route in the list of `ƒ (Dynamic)`
entries.

---

## 2. Environment variables

The app needs these on the server. **None of these may be exposed to
the browser** — Supabase service-role key, CMC key, Tavily key,
Anthropic key all live server-side only.

| Variable | Required? | Where it's used |
|---|---|---|
| `CMC_API_KEY` | **Yes** | `/listings/latest`, `/quotes/latest`, `/quotes/historical`, `/info`, `/market-pairs/latest`, `/global-metrics/*`, `/exchange/listings/latest` |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Auth (client-side; safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Auth (client-side; safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-side only — user table writes |
| `TAVILY_API_KEY` | Optional | Long-tail lineage enrichment + coin stories. Without it, the curated graph alone drives the lineage + a deterministic "I am …" sketch stands in for the story. |
| `ANTHROPIC_API_KEY` | Optional | Coin Story generator + AI explainer in Market Lab. Without it, deterministic local templates. |

The app must work without the optional keys — they enhance, they don't
gate. The lineage engine's curated graph covers the top 100 assets
without any Tavily call.

---

## 3. Deploy to Vercel (30 minutes)

### 3.1. One-time setup

1. Go to [vercel.com](https://vercel.com), sign in with the GitHub
   account that owns this repo.
2. Click **Add New → Project** → Import `wima` (or whatever the repo
   is named).
3. Vercel auto-detects Next.js. Leave the build settings alone
   (`next build`, output `.next`).

### 3.2. Environment variables

In **Project Settings → Environment Variables**, paste every variable
from `.env.local`. Apply to **Production** at minimum; **Preview** is
optional.

**Do not** mark `CMC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`TAVILY_API_KEY`, or `ANTHROPIC_API_KEY` as `NEXT_PUBLIC_*` — they
must stay server-side.

### 3.3. Supabase redirect URLs

In Supabase dashboard → **Authentication → URL Configuration**, add
the deployment URL to **Site URL** and **Redirect URLs**:

```
https://wima-xxx.vercel.app
https://wima-xxx.vercel.app/auth/callback
https://wima-xxx.vercel.app/login
```

### 3.4. Deploy

Click **Deploy**. First deploy takes ~2 min. Once it's green, your
hackathon URL is live.

### 3.5. Smoke test (10 min)

Visit the URL in an incognito window:

1. **`/`** — the marketing landing page renders. You should see the
   "Built on real CoinMarketCap data" panel with 8 endpoint chips.
2. **Sign up** with a throwaway email (Supabase Auth sends a magic link
   or accepts password).
3. **`/ancestor?symbol=BTC`** — lineage page loads. BTC shows the
   "no ancestors" state with the explanation that BTC is the spiritual
   origin.
4. **`/ancestor?symbol=ETH`** — ETH loads, shows its ancestors (BTC
   for inspiration), the **Lineage drift card** under the radar with
   the "what's moving in the family" headline, and **LineageDriftCard**
   at the bottom.
5. **`/ancestor?symbol=USDT`** — USDT shows ETH as its platform
   ancestor, and the drift card lists USDC, DAI, WBTC etc. with their
   30-day returns.
6. **`/compare?from=BTC&to=ETH`** — the relationship report renders.
   The "Direct relationship" panel says ETH descends from BTC (via
   inspiration, confidence 1.0). Shared ancestors section shows BTC
   (trivially).
7. **`/compare?from=ETH&to=SOL`** — SOL is inspiration-descendant of
   ETH per the graph; this should show the same relationship but from
   SOL's side.
8. **`/lab?tab=evidence`** — the API evidence log lists every CMC
   endpoint called and a sanitized sample of the response. This is the
   page that demonstrates the **judges' question #1** (which endpoints
   did you use, and what did you get back?).
9. **`/lab?tab=global`** — global metrics render with live numbers.

If anything 404s or 500s, the most common cause is a missing env var —
re-check step 3.2.

---

## 4. Demo video (20 minutes)

Length: **60-90 seconds**. The X algorithm and DoraHacks judging UI
both favour videos under 2 min. Lead with the wow, not the tour.

### 4.1. Script (timed)

> **0:00-0:05** — cold open, no music, just the headline:
>
> *"Most CMC dashboards tell you the price. This one tells you who
> your ancestors are."*
>
> **0:05-0:15** — type `BTC` into the search on `/ancestor`. Show the
> lineage graph expand. Cut.
>
> **0:15-0:30** — type `ETH`. Show the **lineage drift card**: "ETH's
> family — USDC +1.2%, SOL +18%, WBTC -0.4%. The family beat ETH itself
> by 1.4 points this month." Pause on the bar list. This is the
> 20-second screenshot judges will remember.
>
> **0:30-0:45** — navigate to **`/compare?from=ETH&to=SOL`**. Show the
> direct relationship ("ETH is the platform / inspiration for SOL").
> Show the shared ancestors (BTC). Show the 30-day returns side by
> side.
>
> **0:45-0:60** — go to **`/lab?tab=evidence`**. Show the API log:
> every call is recorded, response samples are visible. *"Every number
> on this page is reproducible. Here are the exact endpoints, here
> are the exact responses."*
>
> **0:60-0:75** — end card: your URL, the X handle, `#BuildwithCMC`.

### 4.2. Recording

- **Loom** (free) is the fastest option. Record the screen + mic.
- **OBS** if you want to overlay the URL/handle as a watermark.
- **No music** — the visual identity is editorial; music reads as
  generic AI-generated.

### 4.3. Hosting

Upload the MP4 to YouTube (unlisted is fine) or Loom's own embed.
DoraHacks accepts a YouTube URL; X accepts a Twitter-uploaded video.

---

## 5. X post (5 minutes)

The CMC account has 7.1M followers — if they repost, the submission
gets a permanent audience. Make the post quotable.

### 5.1. Template (≤280 chars)

> Built something for the CMC hackathon: a tool that answers
> "who's your ancestor in crypto?" with a real lineage graph + a
> 30-day drift report across every descendant.
>
> Try: [YOUR_URL]/compare?from=BTC&to=ETH
>
> #BuildwithCMC

### 5.2. The "thread" version (if you want more reach)

Tweet 1: the 280-char template above.

Tweet 2 (reply): "Most dashboards show price. This one shows the
algorithm: code forks, platform tokens, wrapped versions, inspiration
chains. Every claim is traceable to a curated edge or a CMC API
response."

Tweet 3 (reply): "8 CMC endpoints. 30-day history for every member of
the family tree. One shareable URL per comparison. Built on
@coinmarketcap data."

Tweet 4 (reply): "Demo: [YOUTUBE_URL]. Submission: [DORA_URL].
#BuildwithCMC."

### 5.3. Timing

Post on Sep 29 (one day before close). That gives CMC's account time
to see it before they announce the close, and gives any algorithmic
boost 24 hours to compound.

---

## 6. DoraHacks submission (10 minutes)

### 6.1. Registration

Already done if you registered at [dorahacks.io/hackathon/coinmarketcap-api-202609](https://dorahacks.io/hackathon/coinmarketcap-api-202609).
If not: register with the email that matches your CMC API account
(the same email you used to get the Startup-tier upgrade).

### 6.2. Submission form

Track: **Data & Visualisation**.

Required fields and what to paste:

| Field | What to write |
|---|---|
| Project name | `My Beginning` |
| One-line tagline | `A lineage engine for the CoinMarketCap universe. Every asset has a story — and an ancestry.` |
| Description | (see below) |
| Demo URL | Your Vercel URL |
| Video URL | YouTube / Loom link |
| Code URL | GitHub repo |
| Track | Data & Visualisation |
| X post URL | The tweet you posted |

### 6.3. Description (~200 words)

> Every cryptocurrency has a story. My Beginning makes that
> story navigable.
>
> Pick any asset and instantly see its closest market relatives — by
> code fork (LTC ← BTC, DOGE ← LTC), by platform (USDT/USDC/SHIB →
> ETH, BONK/WIF → SOL), by being wrapped (WETH → ETH, WBTC → BTC), by
> being inspired by (SOL ← ETH ← BTC), or by being a spiritual
> descendant of the original cryptocurrency.
>
> The product uses 8 CoinMarketCap endpoints — /listings/latest,
> /quotes/latest, /quotes/historical, /info, /market-pairs/latest,
> /global-metrics/quotes/latest, /global-metrics/quotes/historical,
> and /exchange/listings/latest — to render:
>
> - a lineage graph walking up from any base asset,
> - a per-dimension breakdown for every ancestor edge,
> - a 30-day "what's moving in the family" headline (lineage drift),
> - a shareable /compare?from=A&to=B URL for any two assets,
> - a fully inspectable API evidence log so every number is
>   reproducible.
>
> The lineage engine walks a curated graph (90+ hand-reviewed edges
> across the top 100 assets) plus Tavily enrichment for the long
> tail. There is no invented genealogy. When no edge exists, the
> engine reports an empty lineage rather than guessing.
>
> Built for the CMC × DoraHacks API Hackathon, Sep 2026.

### 6.4. Where the API got in the way (1 honest line)

This is the judges' favourite field — they want honesty.

> The free-tier rate limit on `/quotes/historical` made the lineage
> drift card expensive to compute for a 30+ member family tree. The
> Startup-tier higher credit allowance unlocked batched fetches across
> all descendants in a single round-trip — without it the drift
> headline would be infeasible in real time.

Or, if your experience was different: name the specific endpoint,
rate limit, or shape quirk you hit. Judges reward specificity.

---

## 7. Last-day checklist

24 hours before the deadline (Sep 29, 23:59 UTC):

- [ ] Vercel deployment is green; the URL is live
- [ ] All 8 endpoints visible in `/lab?tab=evidence`
- [ ] `/compare?from=BTC&to=ETH` renders correctly
- [ ] Lineage drift card renders on `/ancestor?symbol=ETH`
- [ ] Demo video uploaded, 60-90 seconds, ≤2 min
- [ ] X post published with `#BuildwithCMC`
- [ ] DoraHacks submission complete with all 4 URLs filled in
- [ ] One last build: `rm -rf .next && npm run build` passes
- [ ] One last test: `npm run test` is green

---

## 8. If something breaks on submission day

**404 on a static asset.** `rm -rf .next && npm run build`, then
trigger a redeploy on Vercel. Don't edit the deployed `.next/`
directly.

**500 on `/api/ancestor/drift`.** Check that `CMC_API_KEY` is set on
Vercel. The drift endpoint calls `/v1/cryptocurrency/quotes/historical`
and `/v1/global-metrics/quotes/historical` — both require the Startup
tier or higher. If your key is on the free tier, the endpoint will
return 401.

**Auth redirect loop.** Make sure the Supabase redirect URLs in step
3.3 are exactly correct (no trailing slash, exact protocol).

**Vercel build fails with "Cannot read properties of undefined
(startTime)".** Stale `.next/` cache. `rm -rf .next` locally, then
trigger a redeploy. Or just delete the `.vercel` cache on Vercel
through the dashboard.

Good luck. The lineage drift card is the wow. The /compare URL is the
demo. The evidence log is what closes the technical objections.
