# My Beginning — demo script

Walkthrough of every section. Read it once, then put it away.

---

## Before you record

Sign in first so the demo doesn't break on the auth redirect.

Tabs to have open, in order:

1. `/compare?from=BTC&to=DOGE` — opener
2. `/ancestor?symbol=DOGE` — Ancestor section
3. `/lab?tab=compare&symbols=BTC,ETH,SOL` — Market Lab section
4. `/lab?tab=evidence` — credibility closer
5. `/universes` — My Universes section
6. `/explore` — Explore section

Quiet room, hide bookmarks, kill notifications.

---

## The script

### Opening (the question)

[On screen: `/compare?from=BTC&to=DOGE`]

> "The thing that started this — half the coins out there are just copies of other coins. DOGE is a fork of Luckycoin, which is a fork of Litecoin, which is a fork of Bitcoin.
>
> That chain is real but it lives in random forum posts from 2014. I wanted it in one place.
>
> So I built My Beginning. You type in a coin, it walks you back through everything it's descended from."

---

### Ancestor

[Switch to `/ancestor?symbol=DOGE`. Let the page load.]

> "This is the Ancestor view. The thing at the top is the lineage — code forks, platform tokens, wrapped assets, inspiration chains. I went through by hand and curated each edge. Every relationship has a confidence score and a one-line note.
>
> The ones I wasn't sure about, I left out. I'd rather say 'I don't know' than guess and look like an idiot later."

[Scroll to the drift card.]

> "But the part that surprised me — there's actual news in here. Every coin has descendants, and some of them are moving every week. So this card shows you the last 30 days in the family. Median, biggest winner, biggest loser, family vs DOGE, family vs the broader market. The line at the bottom is the tweet I'd actually post."

---

### Market Lab

[Switch to `/lab?tab=compare&symbols=BTC,ETH,SOL`.]

> "Once you've found a coin, the next question is usually 'how does it compare?' So there's Market Lab — and this is the compare tab. Side-by-side across six dimensions — momentum, volatility, market pairs, that kind of thing. The radar chart is just the visual summary."

[Switch to `/lab?tab=evidence`.]

> "The other tab worth showing is this one — the evidence log. Every API call the app makes gets recorded with its endpoint, parameters, sample response. If you wanted to check whether I'm actually using CoinMarketCap's API or making numbers up, this is where you look. Eight endpoints. No scraping."

---

### My Universes

[Switch to `/universes`.]

> "Once you've explored enough, you probably want to save some coins. That's My Universes. Make a collection — Layer 1s, AI tokens, whatever — and then drag assets around to set the order you care about. It saves to Supabase so it persists across devices."

[Click into one of the universes, then drag an asset if there are at least two. If not, just narrate the layout.]

> "Each card has a color, a public-private toggle, the asset count, when it was last edited. Click open in Lab and it goes straight back to the compare view with those symbols preloaded."

---

### Explore

[Switch to `/explore`.]

> "And if you don't know what you're looking for yet, there's Explore. Just the top 250 — sortable, filterable. Click any row and it drops you into the Ancestor view for that coin. That's how most of my own session goes — I start browsing, something catches my eye, I click in, I end up reading lineage chains for an hour."

---

### Close

[Back to `/compare?from=BTC&to=DOGE`. Show the URL bar briefly.]

> "Anyway. That's My Beginning. URL's on screen. Try your favorite coin.
>
> Thanks."

---

## Section timing (rough, not strict)

Total is about 2 to 2.5 minutes at a normal pace. Don't worry about hitting these exactly — they're a fallback in case you lose track.

- Opening: ~20s
- Ancestor: ~40s
- Market Lab: ~30s
- My Universes: ~25s
- Explore: ~15s
- Close: ~10s

If you're running long, cut from Explore first — it's the most expendable. Then trim Market Lab to just the evidence tab.

---

## What to do right after you submit

Post on X. `#BuildwithCMC`. Demo URL. If the drift card has a wild number when you post, quote it.

```
Built My Beginning for @coinmarketcap x @daborahacks #BuildwithCMC

every coin has a family tree. DOGE walks back through Luckycoin → Litecoin → Bitcoin.

8 CMC endpoints, every call logged.

[demo-url]/compare?from=BTC&to=DOGE
```

Ship the post within an hour. Don't keep editing it.
