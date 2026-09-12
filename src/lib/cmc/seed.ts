/**
 * Deterministic development seed for the CMC integration.
 *
 * When CMC_API_KEY is not configured, the CMC client falls back to this
 * seed instead of returning 503. The data is realistic but SYNTHETIC.
 *
 * The /api/cmc/evidence route and the ConfigBanner clearly mark the source
 * so seed data is never confused with a real CoinMarketCap call.
 *
 * To use live data, set CMC_API_KEY in .env.local and restart the server.
 */

import type { CmcCryptocurrency, CmcGlobalMetrics } from "./types";

// Stable, hand-picked seed for the top 50 by approximate real-world rank.
// Values are realistic but deterministic — they are not live market data.

interface Seed {
  symbol: string;
  name: string;
  slug: string;
  rank: number;
  /** USD price. */
  price: number;
  /** Market cap in USD. */
  marketCap: number;
  /** 24h volume in USD. */
  volume24h: number;
  /** Number of active market pairs. */
  numMarketPairs: number;
  circulatingSupply: number;
  maxSupply: number | null;
  dateAdded: string; // ISO
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
}

const SEED_RAW: Seed[] = [
  { symbol: "BTC", name: "Bitcoin", slug: "bitcoin", rank: 1, price: 64230.18, marketCap: 1_270_000_000_000, volume24h: 28_400_000_000, numMarketPairs: 1080, circulatingSupply: 19_740_000, maxSupply: 21_000_000, dateAdded: "2013-04-28T00:00:00.000Z", percentChange1h: 0.12, percentChange24h: 1.84, percentChange7d: 3.42, percentChange30d: 9.21 },
  { symbol: "ETH", name: "Ethereum", slug: "ethereum", rank: 2, price: 3287.55, marketCap: 395_000_000_000, volume24h: 14_200_000_000, numMarketPairs: 1542, circulatingSupply: 120_200_000, maxSupply: null, dateAdded: "2015-08-07T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 2.14, percentChange7d: 4.18, percentChange30d: 11.3 },
  { symbol: "USDT", name: "Tether", slug: "tether", rank: 3, price: 1.0001, marketCap: 119_000_000_000, volume24h: 42_000_000_000, numMarketPairs: 8910, circulatingSupply: 119_000_000_000, maxSupply: null, dateAdded: "2015-02-25T00:00:00.000Z", percentChange1h: 0.00, percentChange24h: 0.01, percentChange7d: -0.02, percentChange30d: 0.04 },
  { symbol: "BNB", name: "BNB", slug: "bnb", rank: 4, price: 590.32, marketCap: 86_400_000_000, volume24h: 1_530_000_000, numMarketPairs: 720, circulatingSupply: 146_400_000, maxSupply: 200_000_000, dateAdded: "2017-07-25T00:00:00.000Z", percentChange1h: -0.08, percentChange24h: 0.74, percentChange7d: 2.86, percentChange30d: 6.40 },
  { symbol: "SOL", name: "Solana", slug: "solana", rank: 5, price: 152.34, marketCap: 71_200_000_000, volume24h: 3_120_000_000, numMarketPairs: 412, circulatingSupply: 467_000_000, maxSupply: null, dateAdded: "2020-04-10T00:00:00.000Z", percentChange1h: 0.41, percentChange24h: 3.10, percentChange7d: 7.85, percentChange30d: 22.6 },
  { symbol: "USDC", name: "USD Coin", slug: "usd-coin", rank: 6, price: 0.9999, marketCap: 34_500_000_000, volume24h: 7_800_000_000, numMarketPairs: 1320, circulatingSupply: 34_500_000_000, maxSupply: null, dateAdded: "2018-10-08T00:00:00.000Z", percentChange1h: 0.00, percentChange24h: 0.00, percentChange7d: 0.01, percentChange30d: -0.01 },
  { symbol: "XRP", name: "XRP", slug: "xrp", rank: 7, price: 0.5234, marketCap: 29_100_000_000, volume24h: 1_010_000_000, numMarketPairs: 610, circulatingSupply: 55_600_000_000, maxSupply: 100_000_000_000, dateAdded: "2013-08-04T00:00:00.000Z", percentChange1h: -0.14, percentChange24h: -0.62, percentChange7d: 1.21, percentChange30d: 4.32 },
  { symbol: "DOGE", name: "Dogecoin", slug: "dogecoin", rank: 8, price: 0.1412, marketCap: 20_500_000_000, volume24h: 870_000_000, numMarketPairs: 530, circulatingSupply: 145_200_000_000, maxSupply: null, dateAdded: "2013-12-15T00:00:00.000Z", percentChange1h: 0.05, percentChange24h: 1.20, percentChange7d: 2.10, percentChange30d: 8.45 },
  { symbol: "ADA", name: "Cardano", slug: "cardano", rank: 9, price: 0.4521, marketCap: 16_100_000_000, volume24h: 410_000_000, numMarketPairs: 380, circulatingSupply: 35_600_000_000, maxSupply: 45_000_000_000, dateAdded: "2017-10-01T00:00:00.000Z", percentChange1h: -0.02, percentChange24h: -0.42, percentChange7d: 0.81, percentChange30d: 2.18 },
  { symbol: "TRX", name: "TRON", slug: "tron", rank: 10, price: 0.1284, marketCap: 11_200_000_000, volume24h: 360_000_000, numMarketPairs: 470, circulatingSupply: 87_200_000_000, maxSupply: null, dateAdded: "2017-09-13T00:00:00.000Z", percentChange1h: 0.10, percentChange24h: 0.92, percentChange7d: 1.84, percentChange30d: 3.90 },
  { symbol: "AVAX", name: "Avalanche", slug: "avalanche", rank: 11, price: 28.65, marketCap: 11_000_000_000, volume24h: 320_000_000, numMarketPairs: 280, circulatingSupply: 384_000_000, maxSupply: 720_000_000, dateAdded: "2020-07-22T00:00:00.000Z", percentChange1h: 0.32, percentChange24h: 2.85, percentChange7d: 5.92, percentChange30d: 18.4 },
  { symbol: "LINK", name: "Chainlink", slug: "chainlink", rank: 12, price: 14.21, marketCap: 8_300_000_000, volume24h: 280_000_000, numMarketPairs: 410, circulatingSupply: 584_000_000, maxSupply: 1_000_000_000, dateAdded: "2017-09-19T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.65, percentChange7d: 3.40, percentChange30d: 7.10 },
  { symbol: "TON", name: "Toncoin", slug: "toncoin", rank: 13, price: 5.83, marketCap: 7_900_000_000, volume24h: 240_000_000, numMarketPairs: 180, circulatingSupply: 1_355_000_000, maxSupply: null, dateAdded: "2021-08-26T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 1.98, percentChange7d: 4.62, percentChange30d: 12.4 },
  { symbol: "MATIC", name: "Polygon", slug: "polygon", rank: 14, price: 0.8421, marketCap: 7_800_000_000, volume24h: 260_000_000, numMarketPairs: 320, circulatingSupply: 9_270_000_000, maxSupply: 10_000_000_000, dateAdded: "2019-04-28T00:00:00.000Z", percentChange1h: -0.06, percentChange24h: 0.41, percentChange7d: 1.92, percentChange30d: 4.85 },
  { symbol: "DOT", name: "Polkadot", slug: "polkadot", rank: 15, price: 6.45, marketCap: 7_500_000_000, volume24h: 180_000_000, numMarketPairs: 290, circulatingSupply: 1_162_000_000, maxSupply: null, dateAdded: "2020-08-19T00:00:00.000Z", percentChange1h: 0.05, percentChange24h: 0.62, percentChange7d: 1.84, percentChange30d: 5.20 },
  { symbol: "SHIB", name: "Shiba Inu", slug: "shiba-inu", rank: 16, price: 0.0000218, marketCap: 12_800_000_000, volume24h: 240_000_000, numMarketPairs: 360, circulatingSupply: 589_000_000_000_000, maxSupply: null, dateAdded: "2020-08-01T00:00:00.000Z", percentChange1h: 0.10, percentChange24h: 1.41, percentChange7d: 2.85, percentChange30d: 6.10 },
  { symbol: "LTC", name: "Litecoin", slug: "litecoin", rank: 17, price: 78.21, marketCap: 5_900_000_000, volume24h: 310_000_000, numMarketPairs: 510, circulatingSupply: 75_400_000, maxSupply: 84_000_000, dateAdded: "2013-04-28T00:00:00.000Z", percentChange1h: -0.03, percentChange24h: 0.21, percentChange7d: 1.10, percentChange30d: 2.80 },
  { symbol: "BCH", name: "Bitcoin Cash", slug: "bitcoin-cash", rank: 18, price: 412.30, marketCap: 8_200_000_000, volume24h: 280_000_000, numMarketPairs: 380, circulatingSupply: 19_840_000, maxSupply: 21_000_000, dateAdded: "2017-11-24T00:00:00.000Z", percentChange1h: 0.04, percentChange24h: 0.84, percentChange7d: 2.21, percentChange30d: 5.40 },
  { symbol: "NEAR", name: "NEAR Protocol", slug: "near-protocol", rank: 19, price: 4.85, marketCap: 5_300_000_000, volume24h: 160_000_000, numMarketPairs: 220, circulatingSupply: 1_092_000_000, maxSupply: null, dateAdded: "2020-10-13T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 1.92, percentChange7d: 4.85, percentChange30d: 14.2 },
  { symbol: "ATOM", name: "Cosmos", slug: "cosmos", rank: 20, price: 7.21, marketCap: 2_800_000_000, volume24h: 95_000_000, numMarketPairs: 240, circulatingSupply: 389_000_000, maxSupply: null, dateAdded: "2019-03-14T00:00:00.000Z", percentChange1h: -0.04, percentChange24h: 0.31, percentChange7d: 1.42, percentChange30d: 3.20 },
  { symbol: "UNI", name: "Uniswap", slug: "uniswap", rank: 21, price: 7.92, marketCap: 4_700_000_000, volume24h: 110_000_000, numMarketPairs: 240, circulatingSupply: 593_000_000, maxSupply: 1_000_000_000, dateAdded: "2020-09-16T00:00:00.000Z", percentChange1h: 0.12, percentChange24h: 1.10, percentChange7d: 2.40, percentChange30d: 6.80 },
  { symbol: "ICP", name: "Internet Computer", slug: "internet-computer", rank: 22, price: 8.45, marketCap: 3_900_000_000, volume24h: 90_000_000, numMarketPairs: 180, circulatingSupply: 461_000_000, maxSupply: null, dateAdded: "2021-05-10T00:00:00.000Z", percentChange1h: -0.18, percentChange24h: -1.42, percentChange7d: -2.85, percentChange30d: -5.40 },
  { symbol: "APT", name: "Aptos", slug: "aptos", rank: 23, price: 7.85, marketCap: 3_700_000_000, volume24h: 140_000_000, numMarketPairs: 180, circulatingSupply: 471_000_000, maxSupply: null, dateAdded: "2022-10-18T00:00:00.000Z", percentChange1h: 0.32, percentChange24h: 2.85, percentChange7d: 6.10, percentChange30d: 18.2 },
  { symbol: "ARB", name: "Arbitrum", slug: "arbitrum", rank: 24, price: 0.812, marketCap: 3_300_000_000, volume24h: 180_000_000, numMarketPairs: 220, circulatingSupply: 4_065_000_000, maxSupply: 10_000_000_000, dateAdded: "2023-03-23T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.65, percentChange7d: 4.21, percentChange30d: 11.5 },
  { symbol: "OP", name: "Optimism", slug: "optimism", rank: 25, price: 1.62, marketCap: 1_900_000_000, volume24h: 95_000_000, numMarketPairs: 180, circulatingSupply: 1_172_000_000, maxSupply: null, dateAdded: "2022-05-31T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 1.85, percentChange7d: 4.62, percentChange30d: 13.4 },
  { symbol: "FIL", name: "Filecoin", slug: "filecoin", rank: 26, price: 4.21, marketCap: 2_400_000_000, volume24h: 110_000_000, numMarketPairs: 180, circulatingSupply: 570_000_000, maxSupply: null, dateAdded: "2017-10-04T00:00:00.000Z", percentChange1h: -0.05, percentChange24h: 0.42, percentChange7d: 1.65, percentChange30d: 3.40 },
  { symbol: "HBAR", name: "Hedera", slug: "hedera", rank: 27, price: 0.0842, marketCap: 3_000_000_000, volume24h: 65_000_000, numMarketPairs: 140, circulatingSupply: 35_600_000_000, maxSupply: 50_000_000_000, dateAdded: "2019-09-16T00:00:00.000Z", percentChange1h: 0.04, percentChange24h: 0.85, percentChange7d: 2.10, percentChange30d: 4.62 },
  { symbol: "VET", name: "VeChain", slug: "vechain", rank: 28, price: 0.0321, marketCap: 2_300_000_000, volume24h: 45_000_000, numMarketPairs: 130, circulatingSupply: 72_700_000_000, maxSupply: 86_700_000_000, dateAdded: "2017-08-22T00:00:00.000Z", percentChange1h: -0.02, percentChange24h: 0.21, percentChange7d: 0.84, percentChange30d: 1.92 },
  { symbol: "AAVE", name: "Aave", slug: "aave", rank: 29, price: 92.30, marketCap: 1_400_000_000, volume24h: 85_000_000, numMarketPairs: 240, circulatingSupply: 15_200_000, maxSupply: 16_000_000, dateAdded: "2017-10-08T00:00:00.000Z", percentChange1h: 0.14, percentChange24h: 1.42, percentChange7d: 3.20, percentChange30d: 8.40 },
  { symbol: "ALGO", name: "Algorand", slug: "algorand", rank: 30, price: 0.162, marketCap: 1_300_000_000, volume24h: 38_000_000, numMarketPairs: 160, circulatingSupply: 8_030_000_000, maxSupply: 10_000_000_000, dateAdded: "2019-06-20T00:00:00.000Z", percentChange1h: 0.02, percentChange24h: 0.32, percentChange7d: 1.10, percentChange30d: 2.40 },
  { symbol: "SUI", name: "Sui", slug: "sui", rank: 31, price: 1.42, marketCap: 3_700_000_000, volume24h: 180_000_000, numMarketPairs: 140, circulatingSupply: 2_605_000_000, maxSupply: 10_000_000_000, dateAdded: "2023-05-03T00:00:00.000Z", percentChange1h: 0.42, percentChange24h: 3.85, percentChange7d: 8.62, percentChange30d: 24.2 },
  { symbol: "STX", name: "Stacks", slug: "stacks", rank: 32, price: 2.10, marketCap: 3_100_000_000, volume24h: 65_000_000, numMarketPairs: 110, circulatingSupply: 1_476_000_000, maxSupply: 1_818_000_000, dateAdded: "2019-10-28T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.85, percentChange7d: 4.20, percentChange30d: 10.5 },
  { symbol: "TIA", name: "Celestia", slug: "celestia", rank: 33, price: 5.85, marketCap: 1_300_000_000, volume24h: 95_000_000, numMarketPairs: 130, circulatingSupply: 222_000_000, maxSupply: null, dateAdded: "2023-10-31T00:00:00.000Z", percentChange1h: 0.32, percentChange24h: 2.62, percentChange7d: 5.85, percentChange30d: 16.4 },
  { symbol: "INJ", name: "Injective", slug: "injective", rank: 34, price: 24.50, marketCap: 2_400_000_000, volume24h: 140_000_000, numMarketPairs: 180, circulatingSupply: 97_800_000, maxSupply: 100_000_000, dateAdded: "2020-10-13T00:00:00.000Z", percentChange1h: 0.41, percentChange24h: 3.10, percentChange7d: 7.20, percentChange30d: 22.8 },
  { symbol: "RNDR", name: "Render", slug: "render", rank: 35, price: 7.62, marketCap: 2_800_000_000, volume24h: 95_000_000, numMarketPairs: 140, circulatingSupply: 367_000_000, maxSupply: 530_000_000, dateAdded: "2017-11-08T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 2.10, percentChange7d: 4.85, percentChange30d: 12.4 },
  { symbol: "GRT", name: "The Graph", slug: "the-graph", rank: 36, price: 0.241, marketCap: 2_300_000_000, volume24h: 65_000_000, numMarketPairs: 180, circulatingSupply: 9_540_000_000, maxSupply: 10_800_000_000, dateAdded: "2020-12-17T00:00:00.000Z", percentChange1h: 0.10, percentChange24h: 1.20, percentChange7d: 2.85, percentChange30d: 7.20 },
  { symbol: "FTM", name: "Fantom", slug: "fantom", rank: 37, price: 0.521, marketCap: 1_500_000_000, volume24h: 110_000_000, numMarketPairs: 220, circulatingSupply: 2_880_000_000, maxSupply: 3_175_000_000, dateAdded: "2018-10-03T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.65, percentChange7d: 4.10, percentChange30d: 10.8 },
  { symbol: "THETA", name: "Theta Network", slug: "theta-network", rank: 38, price: 1.21, marketCap: 1_200_000_000, volume24h: 38_000_000, numMarketPairs: 95, circulatingSupply: 992_000_000, maxSupply: 1_000_000_000, dateAdded: "2018-01-08T00:00:00.000Z", percentChange1h: -0.04, percentChange24h: 0.42, percentChange7d: 1.85, percentChange30d: 4.10 },
  { symbol: "MKR", name: "Maker", slug: "maker", rank: 39, price: 2480, marketCap: 2_300_000_000, volume24h: 65_000_000, numMarketPairs: 120, circulatingSupply: 925_000, maxSupply: null, dateAdded: "2017-01-29T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 1.85, percentChange7d: 4.20, percentChange30d: 10.4 },
  { symbol: "LDO", name: "Lido DAO", slug: "lido-dao", rank: 40, price: 1.84, marketCap: 1_600_000_000, volume24h: 95_000_000, numMarketPairs: 180, circulatingSupply: 869_000_000, maxSupply: 1_000_000_000, dateAdded: "2020-12-17T00:00:00.000Z", percentChange1h: 0.10, percentChange24h: 1.20, percentChange7d: 2.85, percentChange30d: 7.40 },
  { symbol: "RUNE", name: "Thorchain", slug: "thorchain", rank: 41, price: 4.85, marketCap: 1_700_000_000, volume24h: 65_000_000, numMarketPairs: 110, circulatingSupply: 350_000_000, maxSupply: 500_000_000, dateAdded: "2019-07-23T00:00:00.000Z", percentChange1h: 0.32, percentChange24h: 2.85, percentChange7d: 5.62, percentChange30d: 18.4 },
  { symbol: "PEPE", name: "Pepe", slug: "pepe", rank: 42, price: 0.0000118, marketCap: 5_000_000_000, volume24h: 320_000_000, numMarketPairs: 130, circulatingSupply: 420_000_000_000_000, maxSupply: null, dateAdded: "2023-04-17T00:00:00.000Z", percentChange1h: 0.42, percentChange24h: 3.85, percentChange7d: 7.10, percentChange30d: 19.2 },
  { symbol: "WIF", name: "dogwifhat", slug: "dogwifhat", rank: 43, price: 1.85, marketCap: 1_800_000_000, volume24h: 140_000_000, numMarketPairs: 110, circulatingSupply: 998_000_000, maxSupply: null, dateAdded: "2023-11-21T00:00:00.000Z", percentChange1h: 0.32, percentChange24h: 2.85, percentChange7d: 5.20, percentChange30d: 14.2 },
  { symbol: "BONK", name: "Bonk", slug: "bonk", rank: 44, price: 0.0000234, marketCap: 1_700_000_000, volume24h: 95_000_000, numMarketPairs: 100, circulatingSupply: 68_400_000_000_000, maxSupply: null, dateAdded: "2022-12-25T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.65, percentChange7d: 3.40, percentChange30d: 8.20 },
  { symbol: "SEI", name: "Sei", slug: "sei", rank: 45, price: 0.412, marketCap: 1_500_000_000, volume24h: 110_000_000, numMarketPairs: 130, circulatingSupply: 3_640_000_000, maxSupply: 10_000_000_000, dateAdded: "2023-08-15T00:00:00.000Z", percentChange1h: 0.21, percentChange24h: 1.85, percentChange7d: 4.20, percentChange30d: 11.8 },
  { symbol: "JUP", name: "Jupiter", slug: "jupiter", rank: 46, price: 0.95, marketCap: 1_300_000_000, volume24h: 95_000_000, numMarketPairs: 110, circulatingSupply: 1_350_000_000, maxSupply: null, dateAdded: "2024-01-31T00:00:00.000Z", percentChange1h: 0.18, percentChange24h: 1.65, percentChange7d: 3.85, percentChange30d: 9.40 },
  { symbol: "IMX", name: "Immutable", slug: "immutable", rank: 47, price: 1.62, marketCap: 1_900_000_000, volume24h: 65_000_000, numMarketPairs: 120, circulatingSupply: 1_172_000_000, maxSupply: 2_000_000_000, dateAdded: "2021-08-31T00:00:00.000Z", percentChange1h: 0.10, percentChange24h: 1.20, percentChange7d: 2.85, percentChange30d: 7.20 },
  { symbol: "QNT", name: "Quant", slug: "quant", rank: 48, price: 102.50, marketCap: 1_500_000_000, volume24h: 38_000_000, numMarketPairs: 95, circulatingSupply: 14_600_000, maxSupply: null, dateAdded: "2018-06-26T00:00:00.000Z", percentChange1h: 0.04, percentChange24h: 0.85, percentChange7d: 1.92, percentChange30d: 4.62 },
  { symbol: "EGLD", name: "MultiversX", slug: "multiversx", rank: 49, price: 38.20, marketCap: 1_100_000_000, volume24h: 38_000_000, numMarketPairs: 95, circulatingSupply: 28_800_000, maxSupply: null, dateAdded: "2019-07-31T00:00:00.000Z", percentChange1h: 0.04, percentChange24h: 0.92, percentChange7d: 2.10, percentChange30d: 5.20 },
  { symbol: "FLOW", name: "Flow", slug: "flow", rank: 50, price: 0.682, marketCap: 1_000_000_000, volume24h: 38_000_000, numMarketPairs: 110, circulatingSupply: 1_466_000_000, maxSupply: null, dateAdded: "2020-10-01T00:00:00.000Z", percentChange1h: -0.02, percentChange24h: 0.32, percentChange7d: 1.10, percentChange30d: 2.40 },
];

// Synthesize the remaining entries (51–250) deterministically by degrading ranks.
const SYNTHETIC_COUNT = 200;

function buildSynthetic(): Seed[] {
  const result: Seed[] = [];
  for (let i = 0; i < SYNTHETIC_COUNT; i++) {
    const rank = 51 + i;
    // Pseudo-stable name.
    const seed = (i * 7919) % 1000;
    const priceBase = 0.0001 + (seed % 9999) / 100;
    const marketCapBase = 800_000_000 - i * 3_800_000;
    const volumeRatio = 0.05 + (seed % 100) / 1000;
    const pairs = 80 + (seed % 200);
    const circ = 100_000_000 + (seed % 9_000_000_000);
    const hasMax = seed % 2 === 0;
    const max = hasMax ? circ * (1 + (seed % 5) / 10) : null;
    const date = new Date(2018 + ((seed % 7)), (seed % 12), ((seed % 27) + 1));
    const ch1h = ((seed % 200) - 100) / 100; // ±1%
    const ch24 = ((seed % 1000) - 500) / 50; // ±10%
    const ch7 = ((seed % 2000) - 1000) / 25; // ±40%
    const ch30 = ((seed % 4000) - 2000) / 16; // ±125%
    result.push({
      symbol: `SYN${(i + 51).toString().padStart(3, "0")}`,
      name: `Synthetic Asset ${rank}`,
      slug: `synthetic-asset-${rank}`,
      rank,
      price: priceBase,
      marketCap: Math.max(50_000_000, marketCapBase),
      volume24h: Math.max(1_000_000, marketCapBase * volumeRatio),
      numMarketPairs: pairs,
      circulatingSupply: circ,
      maxSupply: max,
      dateAdded: date.toISOString(),
      percentChange1h: ch1h,
      percentChange24h: ch24,
      percentChange7d: ch7,
      percentChange30d: ch30,
    });
  }
  return result;
}

const ALL_SEED: Seed[] = [...SEED_RAW, ...buildSynthetic()];

function seedToCmc(s: Seed, id: number): CmcCryptocurrency {
  return {
    id,
    name: s.name,
    symbol: s.symbol,
    slug: s.slug,
    num_market_pairs: s.numMarketPairs,
    circulating_supply: s.circulatingSupply,
    total_supply: s.circulatingSupply,
    max_supply: s.maxSupply,
    platform: null,
    cmc_rank: s.rank,
    last_updated: new Date().toISOString(),
    date_added: s.dateAdded,
    quote: {
      USD: {
        price: s.price,
        volume_24h: s.volume24h,
        volume_change_24h: 0,
        percent_change_1h: s.percentChange1h,
        percent_change_24h: s.percentChange24h,
        percent_change_7d: s.percentChange7d,
        percent_change_30d: s.percentChange30d,
        market_cap: s.marketCap,
        market_cap_dominance: undefined,
        fully_diluted_market_cap: s.maxSupply ? s.price * s.maxSupply : s.marketCap,
        tvl_ratio: null,
        last_updated: new Date().toISOString(),
      },
    },
  };
}

export function getSeedListings(opts: {
  limit?: number;
  start?: number;
} = {}): CmcCryptocurrency[] {
  const start = Math.max(1, opts.start ?? 1);
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const slice = ALL_SEED.slice(start - 1, start - 1 + limit);
  return slice.map((s, i) => seedToCmc(s, start + i));
}

export function getSeedQuotes(symbols: string[]): CmcCryptocurrency[] {
  if (symbols.length === 0) return [];
  const upper = new Set(symbols.map((s) => s.toUpperCase()));
  return ALL_SEED.filter((s) => upper.has(s.symbol)).map((s, i) =>
    seedToCmc(s, i + 100000),
  );
}

export function getSeedGlobalMetrics(): CmcGlobalMetrics {
  const total_market_cap = ALL_SEED.reduce(
    (s, c) => s + c.marketCap,
    0,
  );
  const total_volume_24h = ALL_SEED.reduce(
    (s, c) => s + c.volume24h,
    0,
  );
  return {
    active_cryptocurrencies: ALL_SEED.length,
    active_exchanges: 220,
    active_market_pairs: ALL_SEED.reduce((s, c) => s + c.numMarketPairs, 0),
    total_volume_24h,
    total_volume_24h_reported: total_volume_24h,
    total_market_cap,
    market_cap_percentage: {
      btc: ALL_SEED.find((s) => s.symbol === "BTC")!.marketCap / total_market_cap * 100,
      eth: ALL_SEED.find((s) => s.symbol === "ETH")!.marketCap / total_market_cap * 100,
    },
    market_cap_change_percentage_24h_usd: 1.42,
    volume_change_percentage_24h_usd: -0.85,
    updated_at: new Date().toISOString(),
  };
}

export const SEED_INFO = {
  source: "seed",
  message:
    "Synthetic development data. Set CMC_API_KEY in .env.local and restart for live CoinMarketCap data.",
  count: ALL_SEED.length,
  handCurated: SEED_RAW.length,
} as const;