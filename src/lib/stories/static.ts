/**
 * Static story archive — Tier 0 of the Coin Story cache.
 *
 * This is a curated set of verified first-person Coin Stories for the
 * most-requested assets. It is consulted BEFORE the Supabase cache, the
 * Tavily research call, and the LLM. When a visitor asks for a coin in
 * this archive, we hand back a real `CoinStory` synchronously (modulo
 * a small artificial delay in the orchestrator so the UI still feels
 * like it's making a network call) and skip all the expensive work.
 *
 * Why an archive at all?
 *
 *   - The vast majority of search-as-you-type traffic is for the top
 *     20 coins by market cap. Most visitors never type an obscure coin.
 *     Serving BTC, ETH, SOL, etc. from a static file eliminates hundreds
 *     of Tavily calls and LLM invocations per day.
 *
 *   - Coins in this file have rich, verifiable histories. We hand-write
 *     the stories using only publicly documented facts and link every
 *     claim to a source URL. We do NOT invent founders, dates, or events
 *     the way the LLM might be tempted to for long-tail assets.
 *
 *   - We persist each static hit into `coin_stories` after serving it,
 *     so the second visitor for the same coin hits the existing
 *     Supabase cache. The static file is a one-time warm-up per coin.
 *
 * Editing policy:
 *
 *   - Facts only. Every claim must be tied to a public source URL.
 *   - No marketing language. No "revolutionary", "disruptive", etc.
 *   - Keep paragraphs short. Write in first person ("I", "me", "my").
 *   - When a fact becomes outdated (e.g. an exchange delisting), update
 *     this file in the same change.
 *
 * Adding a new coin:
 *
 *   1. Pick a symbol that matches CMC's ticker.
 *   2. Write at least one dated historical fact and one founder/team
 *      fact, both grounded in a public source.
 *   3. Add the entry to the `STATIC_STORIES` record keyed by symbol.
 *   4. Add a test in `scripts/test-story-orchestrator.ts`.
 */

import "server-only";

import type { CoinStory } from "./types";

const STATIC_GENERATED_AT = "2026-09-12T00:00:00.000Z";

/**
 * All archived stories keyed by uppercase ticker symbol.
 *
 * Coverage targets the top 20 by market cap so the search-as-you-type
 * autocomplete in /ancestor resolves these instantly. Coins outside
 * this list fall through to the live Tavily + LLM pipeline.
 */
export const STATIC_STORIES: Record<string, CoinStory> = {
  // -------------------------------------------------------------------------
  // BTC · Bitcoin
  // -------------------------------------------------------------------------
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    title: "The Story of Bitcoin",
    hook: "I am Bitcoin.",
    paragraphs: [
      "I am Bitcoin.",
      "My story begins in 2008, when a person or group writing under the name Satoshi Nakamoto published a paper called “Bitcoin: A Peer-to-Peer Electronic Cash System.” That paper described me as a way to send value directly between people, without a bank in the middle.",
      "In 2009, my network went live. The first block — the genesis block — was mined on 3 January 2009. By 2010 I was being used in the first real-world transactions, including the now-famous Bitcoin Pizza Day, when someone paid 10,000 BTC for two pizzas.",
      "In the years that followed I weathered exchange collapses, regulatory crackdowns, hard forks like Bitcoin Cash in 2017, and a long stretch as a niche idea before becoming the largest cryptocurrency by market capitalization.",
      "Today I am known as BTC, the original proof that a decentralized ledger can hold value without a trusted issuer. The rest of my story is still being written.",
    ],
    timeline: [
      { date: "2008", label: "Whitepaper published by Satoshi Nakamoto", paragraphIndex: 1 },
      { date: "2009", label: "Genesis block mined; network goes live", paragraphIndex: 2 },
      { date: "2010", label: "Bitcoin Pizza Day — 10,000 BTC for two pizzas", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Bitcoin whitepaper",
        url: "https://bitcoin.org/bitcoin.pdf",
        domain: "bitcoin.org",
        snippet:
          "Bitcoin: A Peer-to-Peer Electronic Cash System (Satoshi Nakamoto, 2008).",
        relevance: 0.99,
        publishedAt: "2008-10-31",
      },
      {
        title: "Bitcoin - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Bitcoin",
        domain: "en.wikipedia.org",
        snippet:
          "Bitcoin is a decentralized digital currency, without a central bank or single administrator.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-btc",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // ETH · Ethereum
  // -------------------------------------------------------------------------
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    title: "The Story of Ethereum",
    hook: "I am Ethereum.",
    paragraphs: [
      "I am Ethereum.",
      "My story begins in late 2013, when Vitalik Buterin published a whitepaper proposing a blockchain that could run arbitrary code — not just track a currency. The paper brought in co-founders Gavin Wood, Charles Hoskinson, Anthony Di Iorio, and Joseph Lubin.",
      "In 2014, my development was funded through a public crowdsale that ran through the summer. In 2015, my network went live with the Frontier release on 30 July.",
      "Over the years I became the platform where most other cryptocurrencies issue their tokens, where DeFi protocols settle trades, and where NFTs were first widely traded. The Merge in September 2022 changed how I reach consensus — swapping proof-of-work for proof-of-stake.",
      "Today I am known as ETH, the settlement layer for a great deal of what people call Web3. The rest of my story is still being written.",
    ],
    timeline: [
      { date: "2013", label: "Vitalik Buterin publishes the Ethereum whitepaper", paragraphIndex: 1 },
      { date: "2014", label: "Public crowdsale funds development", paragraphIndex: 2 },
      { date: "2015", label: "Frontier mainnet goes live", paragraphIndex: 2 },
      { date: "2022", label: "The Merge — proof-of-stake consensus", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "Ethereum whitepaper",
        url: "https://ethereum.org/en/whitepaper/",
        domain: "ethereum.org",
        snippet:
          "Ethereum: A Next-Generation Smart Contract and Decentralized Application Platform (Vitalik Buterin, 2013/2014).",
        relevance: 0.99,
        publishedAt: null,
      },
      {
        title: "Ethereum - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ethereum",
        domain: "en.wikipedia.org",
        snippet:
          "Ethereum is a decentralized open-source blockchain with smart-contract functionality.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-eth",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // SOL · Solana
  // -------------------------------------------------------------------------
  SOL: {
    symbol: "SOL",
    name: "Solana",
    title: "The Story of Solana",
    hook: "I am Solana.",
    paragraphs: [
      "I am Solana.",
      "My story begins in 2017, when Anatoly Yakovenko published a paper describing a way to combine proof-of-stake with a proof-of-history clock so a blockchain could process many transactions in parallel.",
      "In 2018, my project raised funds through private and public sales, and in March 2020 my mainnet went live. From the start I was designed for high throughput and low fees — a different bet from Ethereum's —which meant I attracted payments and trading use cases early.",
      "I weathered several high-profile network outages in 2021 and 2022 before upgrades made the network more resilient. I am known today as SOL, the native asset of one of the largest non-EVM chains.",
      "Today I am known as SOL, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "Anatoly Yakovenko publishes the Solana whitepaper", paragraphIndex: 1 },
      { date: "2018", label: "Private and public funding rounds", paragraphIndex: 2 },
      { date: "2020", label: "Mainnet beta goes live (March)", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Solana - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Solana_(blockchain)",
        domain: "en.wikipedia.org",
        snippet:
          "Solana is a blockchain built for speed, using proof-of-stake combined with proof-of-history.",
        relevance: 0.95,
        publishedAt: null,
      },
      {
        title: "Solana documentation",
        url: "https://docs.solana.com/",
        domain: "docs.solana.com",
        snippet:
          "Solana is a high-performance blockchain supporting builders worldwide.",
        relevance: 0.9,
        publishedAt: null,
      },
    ],
    researchHash: "static-sol",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // XRP · XRP
  // -------------------------------------------------------------------------
  XRP: {
    symbol: "XRP",
    name: "XRP",
    title: "The Story of XRP",
    hook: "I am XRP.",
    paragraphs: [
      "I am XRP.",
      "My story begins in 2012. I was originally created by Ripple Labs engineers — including David Schwartz, Jed McCaleb, and Arthur Britto — to be a fast, low-cost asset for cross-border payments.",
      "The Ripple company built a payment network called RippleNet that uses me as a bridge currency between fiat pairs. I have no mining — all of my supply was created at launch.",
      "I have been the subject of a long-running securities lawsuit in the United States between Ripple and the SEC, filed in December 2020 and resolved in part by a court ruling in July 2023 that programmatic sales of XRP did not constitute securities offerings.",
      "Today I am known as XRP, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2012", label: "XRP created by Ripple Labs engineers", paragraphIndex: 1 },
      { date: "2013", label: "Ripple network begins using XRP as a bridge asset", paragraphIndex: 2 },
      { date: "2020", label: "SEC sues Ripple (December)", paragraphIndex: 3 },
      { date: "2023", label: "Court rules on programmatic XRP sales", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "XRP - Wikipedia",
        url: "https://en.wikipedia.org/wiki/XRP_(cryptocurrency)",
        domain: "en.wikipedia.org",
        snippet:
          "XRP is a cryptocurrency created by Ripple Labs for use in the Ripple payment network.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-xrp",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // ADA · Cardano
  // -------------------------------------------------------------------------
  ADA: {
    symbol: "ADA",
    name: "Cardano",
    title: "The Story of Cardano",
    hook: "I am Cardano.",
    paragraphs: [
      "I am Cardano.",
      "My story begins in 2015, when Charles Hoskinson — one of Ethereum's co-founders — started work on a new blockchain with a research-first approach. My development is led by the IOHK engineering team, with Hoskinson as a public face.",
      "My mainnet launched in 2017 with a Byron-era release, followed by Shelley in 2020 which introduced staking and decentralization, and Alonzo in 2021 which added smart-contract functionality.",
      "I am known today as ADA, named after Ada Lovelace, and I'm designed to be a peer-reviewed, formally specified alternative to earlier-generation smart-contract chains.",
      "Today I am known as ADA, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2015", label: "Charles Hoskinson begins work on Cardano", paragraphIndex: 1 },
      { date: "2017", label: "Mainnet — Byron era launches", paragraphIndex: 2 },
      { date: "2020", label: "Shelley era — staking and decentralization", paragraphIndex: 2 },
      { date: "2021", label: "Alonzo era — smart contracts enabled", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Cardano - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cardano_(blockchain_platform)",
        domain: "en.wikipedia.org",
        snippet:
          "Cardano is a blockchain platform based on proof-of-stake, founded by Charles Hoskinson.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-ada",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // DOGE · Dogecoin
  // -------------------------------------------------------------------------
  DOGE: {
    symbol: "DOGE",
    name: "Dogecoin",
    title: "The Story of Dogecoin",
    hook: "I am Dogecoin.",
    paragraphs: [
      "I am Dogecoin.",
      "My story begins on 6 December 2013, when I was launched as a joke currency — a parody of the crypto frenzy of the time, themed around a Shiba Inu dog meme. I was created by software engineers Billy Markus and Jackson Palmer.",
      "I started as a fork of Litecoin, which itself was a fork of Bitcoin. Unlike those networks I was deliberately inflationary: there is no cap on my supply, and 10,000 new DOGE are created every minute.",
      "I gained a real community and real use as a tipping currency on Reddit and Twitter. In 2021 I became one of the most-discussed cryptocurrencies after Elon Musk and others began talking about me on social media.",
      "Today I am known as DOGE, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2013", label: "Dogecoin launched by Billy Markus and Jackson Palmer", paragraphIndex: 1 },
      { date: "2014", label: "Community-driven tipping culture emerges", paragraphIndex: 2 },
      { date: "2021", label: "Mainstream attention and price spike", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "Dogecoin - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Dogecoin",
        domain: "en.wikipedia.org",
        snippet:
          "Dogecoin is a cryptocurrency created by software engineers Billy Markus and Jackson Palmer in 2013.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-doge",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // LTC · Litecoin
  // -------------------------------------------------------------------------
  LTC: {
    symbol: "LTC",
    name: "Litecoin",
    title: "The Story of Litecoin",
    hook: "I am Litecoin.",
    paragraphs: [
      "I am Litecoin.",
      "My story begins in 2011, when Charlie Lee — a former Google engineer — forked the Bitcoin codebase to create me. My goal was to be a “silver to Bitcoin's gold” — a faster, cheaper version of the same idea.",
      "I use a different hashing algorithm (scrypt) and a faster block time (2.5 minutes vs Bitcoin's 10). For several years I was one of the largest cryptocurrencies by market capitalization, and many later coins were forked from my code.",
      "Charlie Lee stepped away from active development in 2017 and sold or donated most of his holdings. In 2021 I adopted Mimblewimble through an extension block, giving me optional privacy features.",
      "Today I am known as LTC, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2011", label: "Charlie Lee creates Litecoin by forking Bitcoin", paragraphIndex: 1 },
      { date: "2017", label: "Charlie Lee steps away from active development", paragraphIndex: 3 },
      { date: "2021", label: "Mimblewimble extension block activated", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "Litecoin - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Litecoin",
        domain: "en.wikipedia.org",
        snippet:
          "Litecoin is a peer-to-peer cryptocurrency created by Charlie Lee in 2011, a fork of Bitcoin.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-ltc",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // BCH · Bitcoin Cash
  // -------------------------------------------------------------------------
  BCH: {
    symbol: "BCH",
    name: "Bitcoin Cash",
    title: "The Story of Bitcoin Cash",
    hook: "I am Bitcoin Cash.",
    paragraphs: [
      "I am Bitcoin Cash.",
      "My story begins on 1 August 2017, when I forked from Bitcoin over a disagreement about how to scale the network. The Bitcoin community had been debating whether to increase block size or rely on a second-layer system called the Lightning Network.",
      "My fork took the larger-block route, increasing the block size limit to 8MB and later to 32MB. My supporters saw me as continuing the original vision of Bitcoin as peer-to-peer electronic cash for everyday payments.",
      "In November 2018 I split again, with some miners and developers going on to form Bitcoin SV. I have remained one of the larger proof-of-work cryptocurrencies by market cap.",
      "Today I am known as BCH, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "Hard fork from Bitcoin on 1 August", paragraphIndex: 1 },
      { date: "2018", label: "Second fork creates Bitcoin SV", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "Bitcoin Cash - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Bitcoin_Cash",
        domain: "en.wikipedia.org",
        snippet:
          "Bitcoin Cash is a cryptocurrency that is a fork of Bitcoin created in August 2017.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-bch",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // DOT · Polkadot
  // -------------------------------------------------------------------------
  DOT: {
    symbol: "DOT",
    name: "Polkadot",
    title: "The Story of Polkadot",
    hook: "I am Polkadot.",
    paragraphs: [
      "I am Polkadot.",
      "My story begins in 2016, when Gavin Wood — one of Ethereum's co-founders — published the Polkadot whitepaper. The paper described a network of interoperable blockchains, each with its own rules, able to pass messages and tokens to each other through a central relay chain.",
      "In 2017, my project raised funds through a token sale. After several years of development my mainnet went live in May 2020, and the original DOT token was redenominated 100:1 in August 2020.",
      "I am built using Substrate, a framework Wood's team at Parity Technologies developed for building blockchains. I am known today as DOT, the native asset of the Polkadot relay chain.",
      "Today I am known as DOT, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2016", label: "Gavin Wood publishes the Polkadot whitepaper", paragraphIndex: 1 },
      { date: "2017", label: "Token sale funds development", paragraphIndex: 2 },
      { date: "2020", label: "Mainnet goes live in May; DOT redenominated in August", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Polkadot - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Polkadot_(cryptocurrency)",
        domain: "en.wikipedia.org",
        snippet:
          "Polkadot is a blockchain protocol that enables different blockchains to transfer messages and value.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-dot",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // MATIC · Polygon
  // -------------------------------------------------------------------------
  MATIC: {
    symbol: "MATIC",
    name: "Polygon",
    title: "The Story of Polygon",
    hook: "I am Polygon.",
    paragraphs: [
      "I am Polygon.",
      "My story begins in 2017, when my developers — Jaynti Kanani, Sandeep Nailwal, and Anurag Arjun — launched Matic Network as a sidechain scaling solution for Ethereum. The original token sale was in 2019.",
      "In February 2021, Matic Network rebranded to Polygon and broadened its mission from a single sidechain to a framework for many Ethereum-compatible networks, including its main proof-of-stake chain, Polygon PoS.",
      "I became one of the most-used scaling layers for Ethereum, hosting a large share of DeFi and gaming traffic at much lower fees than Ethereum mainnet. My native token kept the symbol MATIC.",
      "Today I am known as MATIC, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "Matic Network founded", paragraphIndex: 1 },
      { date: "2019", label: "Matic Network token sale", paragraphIndex: 1 },
      { date: "2021", label: "Rebrand to Polygon and broader scaling mission", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Polygon - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Polygon_(blockchain)",
        domain: "en.wikipedia.org",
        snippet:
          "Polygon is a framework for building Ethereum-compatible blockchain networks, formerly Matic Network.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-matic",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // LINK · Chainlink
  // -------------------------------------------------------------------------
  LINK: {
    symbol: "LINK",
    name: "Chainlink",
    title: "The Story of Chainlink",
    hook: "I am Chainlink.",
    paragraphs: [
      "I am Chainlink.",
      "My story begins in 2017, when Sergey Nazarov and Steve Ellis founded Chainlink to solve a problem blockchains share: they can't natively fetch data from the outside world. Chainlink's answer is a network of oracles that fetch, verify, and deliver external data to smart contracts.",
      "My LINK token is used to pay node operators for oracle services. I went live on Ethereum mainnet in 2019 and grew into one of the most widely used oracle networks.",
      "Today I am known as LINK, the token that powers oracle services for a large share of the DeFi ecosystem.",
      "Today I am known as LINK, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "Chainlink founded by Sergey Nazarov and Steve Ellis", paragraphIndex: 1 },
      { date: "2019", label: "Mainnet launch on Ethereum", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Chainlink - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Chainlink_(cryptocurrency)",
        domain: "en.wikipedia.org",
        snippet:
          "Chainlink is a blockchain oracle network built on Ethereum, founded by Sergey Nazarov.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-link",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // AVAX · Avalanche
  // -------------------------------------------------------------------------
  AVAX: {
    symbol: "AVAX",
    name: "Avalanche",
    title: "The Story of Avalanche",
    hook: "I am Avalanche.",
    paragraphs: [
      "I am Avalanche.",
      "My story begins in 2018, when a team led by Emin Gün Sirer — a computer scientist at Cornell — published a paper proposing a new family of consensus protocols that could reach finality in under two seconds without sacrificing decentralization.",
      "My mainnet went live in September 2020, shortly after a public token sale in July 2020 that raised funds for development. My architecture is built around three chains — the X-Chain, P-Chain, and C-Chain — each optimized for a different job.",
      "I became a popular home for DeFi protocols and EVM-compatible smart contracts looking for an alternative to Ethereum mainnet. My native token is AVAX.",
      "Today I am known as AVAX, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2018", label: "Team led by Emin Gün Sirer publishes the Avalanche protocol", paragraphIndex: 1 },
      { date: "2020", label: "Public token sale in July; mainnet goes live in September", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Avalanche - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Avalanche_(blockchain_platform)",
        domain: "en.wikipedia.org",
        snippet:
          "Avalanche is a blockchain platform founded by Emin Gün Sirer, with a mainnet that launched in 2020.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-avax",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // USDC · USD Coin
  // -------------------------------------------------------------------------
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    title: "The Story of USD Coin",
    hook: "I am USD Coin.",
    paragraphs: [
      "I am USD Coin.",
      "My story begins in September 2018, when I was launched by Circle as a stablecoin pegged 1:1 to the US dollar. Each USDC in circulation is meant to be backed by an equivalent dollar or dollar-equivalent reserve held by my issuer.",
      "I run on multiple blockchains — originally Ethereum, now also Solana, Avalanche, Polygon, and others — which is part of why I've become one of the most-traded stablecoins in crypto markets.",
      "I have weathered a major stress test: in March 2023, during the USDC banking crisis, my issuer temporarily lost access to a portion of reserves held at Silicon Valley Bank. The peg was restored within days, and my issuer has since published regular third-party attestations of reserves.",
      "Today I am known as USDC, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2018", label: "USD Coin launched by Circle in September", paragraphIndex: 1 },
      { date: "2023", label: "USDC banking crisis — peg restored within days", paragraphIndex: 3 },
    ],
    sources: [
      {
        title: "USD Coin - Wikipedia",
        url: "https://en.wikipedia.org/wiki/USD_Coin",
        domain: "en.wikipedia.org",
        snippet:
          "USD Coin (USDC) is a stablecoin issued by Circle, pegged 1:1 to the US dollar.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-usdc",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // USDT · Tether
  // -------------------------------------------------------------------------
  USDT: {
    symbol: "USDT",
    name: "Tether",
    title: "The Story of Tether",
    hook: "I am Tether.",
    paragraphs: [
      "I am Tether.",
      "My story begins in 2014, when I was launched as Realcoin by Brock Pierce, Reeve Collins, and Craig Sellars. I was later renamed Tether and became the first widely-used cryptocurrency stablecoin — a token designed to track the value of a fiat currency, in my case the US dollar.",
      "I originally ran on the Bitcoin protocol via the Omni Layer and later moved to Ethereum, Tron, and many other chains. I have long been the largest stablecoin by market capitalization and one of the most-traded cryptocurrencies by volume.",
      "I have also been the subject of ongoing regulatory scrutiny and legal disputes over whether my reserves are sufficient to back every USDT in circulation. My issuer publishes periodic attestation reports.",
      "Today I am known as USDT, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2014", label: "Launched as Realcoin by Brock Pierce, Reeve Collins, and Craig Sellars", paragraphIndex: 1 },
      { date: "2015", label: "Renamed Tether; Bitcoin Omni Layer deployment", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Tether - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Tether_(cryptocurrency)",
        domain: "en.wikipedia.org",
        snippet:
          "Tether (USDT) is a stablecoin pegged to the US dollar, launched in 2014.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-usdt",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // UNI · Uniswap
  // -------------------------------------------------------------------------
  UNI: {
    symbol: "UNI",
    name: "Uniswap",
    title: "The Story of Uniswap",
    hook: "I am Uniswap.",
    paragraphs: [
      "I am Uniswap.",
      "My story begins in 2018, when Hayden Adams — inspired by a post by Ethereum co-founder Vitalik Buterin — built an automated market maker protocol on Ethereum. The first version, Uniswap V1, launched in November 2018.",
      "My protocol replaces traditional order books with liquidity pools: people deposit pairs of tokens and prices are set by a constant-product formula. In May 2020, Uniswap V2 launched, and in May 2021 V3 introduced concentrated liquidity.",
      "My UNI governance token was airdropped to early users in September 2020, one of the largest airdrops in crypto history. Today I am one of the largest decentralized exchanges by trading volume.",
      "Today I am known as UNI, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2018", label: "Uniswap V1 launched in November by Hayden Adams", paragraphIndex: 1 },
      { date: "2020", label: "V2 launched in May; UNI token airdropped in September", paragraphIndex: 3 },
      { date: "2021", label: "V3 introduces concentrated liquidity", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Uniswap - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Uniswap",
        domain: "en.wikipedia.org",
        snippet:
          "Uniswap is a decentralized exchange built on Ethereum, created by Hayden Adams.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-uni",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // ATOM · Cosmos
  // -------------------------------------------------------------------------
  ATOM: {
    symbol: "ATOM",
    name: "Cosmos",
    title: "The Story of Cosmos",
    hook: "I am Cosmos.",
    paragraphs: [
      "I am Cosmos.",
      "My story begins in 2014, when Jae Kwon and Ethan Buchman published a paper describing a network of independent blockchains that could communicate with each other through a protocol called IBC — the Inter-Blockchain Communication protocol.",
      "My mainnet went live in March 2019. I provide a toolkit called the Cosmos SDK that other projects use to build their own application-specific blockchains, and a hub-and-spoke architecture where independent zones connect to a central Hub.",
      "I am the parent project of several well-known chains, including the Cosmos Hub itself, the original Terra, and Binance Chain. My native token is ATOM.",
      "Today I am known as ATOM, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2014", label: "Jae Kwon and Ethan Buchman publish the Cosmos whitepaper", paragraphIndex: 1 },
      { date: "2019", label: "Cosmos Hub mainnet goes live in March", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Cosmos - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cosmos_(blockchain)",
        domain: "en.wikipedia.org",
        snippet:
          "Cosmos is a decentralized network of independent blockchains built using the Cosmos SDK.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-atom",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // XLM · Stellar
  // -------------------------------------------------------------------------
  XLM: {
    symbol: "XLM",
    name: "Stellar",
    title: "The Story of Stellar",
    hook: "I am Stellar.",
    paragraphs: [
      "I am Stellar.",
      "My story begins in 2014, when Jed McCaleb — one of the original co-founders of Ripple — launched the Stellar payment network as a way to make cross-border money transfers cheaper and more accessible, especially for people without traditional banking access.",
      "My development is supported by the Stellar Development Foundation. In October 2015, Stripe announced it would integrate Stellar, and in subsequent years I became a backbone for remittance corridors and token issuance.",
      "I am known today as XLM, also called lumen, the native asset of the Stellar network.",
      "Today I am known as XLM, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2014", label: "Jed McCaleb launches the Stellar payment network", paragraphIndex: 1 },
      { date: "2015", label: "Stripe announces Stellar integration", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "Stellar - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Stellar_(payment_network)",
        domain: "en.wikipedia.org",
        snippet:
          "Stellar is a payment network launched in 2014 by Jed McCaleb.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-xlm",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // TRX · TRON
  // -------------------------------------------------------------------------
  TRX: {
    symbol: "TRX",
    name: "TRON",
    title: "The Story of TRON",
    hook: "I am TRON.",
    paragraphs: [
      "I am TRON.",
      "My story begins in 2017, when Justin Sun founded TRON in Singapore with the goal of building a high-throughput blockchain for entertainment and content. I held an initial coin offering in 2017 and my mainnet launched in May 2018.",
      "In 2018, I acquired BitTorrent, the peer-to-peer file-sharing network, and integrated its protocol with TRON. I became one of the largest networks for stablecoin transfers — USDT on TRON is one of the most-used USDT blockchains outside Ethereum.",
      "My native token is TRX. I have been the subject of controversy over centralized governance and allegations of plagiarism in the early whitepaper, which Sun has denied.",
      "Today I am known as TRX, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "Justin Sun founds TRON; ICO held", paragraphIndex: 1 },
      { date: "2018", label: "Mainnet goes live in May; BitTorrent acquisition", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "TRON - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Tron_(cryptocurrency)",
        domain: "en.wikipedia.org",
        snippet:
          "TRON is a blockchain founded by Justin Sun in 2017.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-trx",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // ETC · Ethereum Classic
  // -------------------------------------------------------------------------
  ETC: {
    symbol: "ETC",
    name: "Ethereum Classic",
    title: "The Story of Ethereum Classic",
    hook: "I am Ethereum Classic.",
    paragraphs: [
      "I am Ethereum Classic.",
      "My story begins in July 2016, when Ethereum forked after a hack drained roughly $50 million worth of ETH from a project called The DAO. The Ethereum community split over whether to roll back the chain to recover the funds.",
      "The chain that chose not to roll back kept the original history and took the name Ethereum Classic. I continue to run the same protocol Ethereum ran before the fork — proof of work, no smart-contract changes from the rollback.",
      "I am known today as ETC, the smaller of the two Ethereum chains that emerged from the 2016 split. I have remained one of the top proof-of-work cryptocurrencies by market cap.",
      "Today I am known as ETC, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2016", label: "Ethereum Classic emerges after The DAO fork (July)", paragraphIndex: 1 },
    ],
    sources: [
      {
        title: "Ethereum Classic - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ethereum_Classic",
        domain: "en.wikipedia.org",
        snippet:
          "Ethereum Classic is a hard fork of Ethereum that occurred in July 2016.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-etc",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },

  // -------------------------------------------------------------------------
  // BNB · BNB
  // -------------------------------------------------------------------------
  BNB: {
    symbol: "BNB",
    name: "BNB",
    title: "The Story of BNB",
    hook: "I am BNB.",
    paragraphs: [
      "I am BNB.",
      "My story begins in 2017, when I was launched as an ERC-20 token on Ethereum to fund the development of Binance, the cryptocurrency exchange founded by Changpeng Zhao and Yi He. I was originally called Binance Coin.",
      "In 2019, my team launched the Binance Chain, and in 2020 Binance Smart Chain — a parallel EVM-compatible chain — was launched and later merged with Binance Chain to form BNB Chain. I became the native asset of that chain.",
      "I am used to pay trading fees on the Binance exchange at a discount, to pay gas fees on BNB Chain, and to participate in token sales on the Binance Launchpad.",
      "Today I am known as BNB, and the rest of my story is still being written.",
    ],
    timeline: [
      { date: "2017", label: "BNB launches as ERC-20 on Ethereum", paragraphIndex: 1 },
      { date: "2019", label: "Binance Chain launches", paragraphIndex: 2 },
      { date: "2020", label: "Binance Smart Chain launches; later merged into BNB Chain", paragraphIndex: 2 },
    ],
    sources: [
      {
        title: "BNB - Wikipedia",
        url: "https://en.wikipedia.org/wiki/BNB",
        domain: "en.wikipedia.org",
        snippet:
          "BNB (originally Binance Coin) is the native cryptocurrency of the BNB Chain.",
        relevance: 0.95,
        publishedAt: null,
      },
    ],
    researchHash: "static-bnb",
    generatedAt: STATIC_GENERATED_AT,
    fallback: false,
  },
};

/**
 * Look up the static story for a given symbol.
 *
 * Returns null when the symbol is not in the archive. The lookup is
 * case-insensitive — callers always pass uppercase ticker symbols.
 */
export function getStaticStory(symbol: string): CoinStory | null {
  const key = symbol.toUpperCase();
  return STATIC_STORIES[key] ?? null;
}

/**
 * Return the list of symbols covered by the static archive. Used by
 * tests + admin tooling to verify coverage and check that the file
 * stays in sync with the universe of top assets.
 */
export function getStaticStorySymbols(): string[] {
  return Object.keys(STATIC_STORIES).sort();
}

/**
 * Total number of entries in the static archive.
 */
export function getStaticStoryCount(): number {
  return Object.keys(STATIC_STORIES).length;
}
