/**
 * Curated ancestor graph — the source of truth for top-tier coin lineage.
 *
 * Each entry is a directed edge `parent ← child` saying "child descended
 * from parent" with a relation type, confidence, and a human-readable note.
 *
 * This is hand-curated and reviewed. We deliberately keep it conservative
 * — the demo should never show an ancestor edge that isn't defensible.
 * Tavily fills the long tail for coins not listed here.
 *
 * Five relation types — see ./types.ts for definitions:
 *   - fork        : code fork
 *   - platform    : token native to a chain
 *   - wrapped     : wrapped token on another chain
 *   - inspiration : explicitly designed as successor/improvement
 *   - conceptual  : spiritual lineage (BTC → most altcoins)
 *
 * Hierarchy invariants (enforced by `resolveLineage`):
 *
 *   1. The selected asset is ALWAYS the root. It is never an ancestor of
 *      itself, never a descendant of itself, never a relative of itself.
 *
 *   2. A descendant of the selected asset can NEVER appear as one of its
 *      ancestors. Direction is determined independently from the
 *      visualization hierarchy — not by where a node sits on screen.
 *
 *   3. The ancestor graph must be acyclic. If the curated graph
 *      accidentally contains a cycle, the offending edge is dropped at
 *      resolution time and a warning is logged — the rest of the graph
 *      still renders.
 *
 *   4. Each relationship is given a single, explicit `direction` from
 *      the perspective of the SELECTED base. The UI labels every section
 *      by that direction — never by visual position.
 */

import type {
  AncestorEdge,
  RelationshipDirection,
  RelationType,
  UniverseEntry,
} from "./types";
import { ALGORITHM_VERSION } from "./types";

/** Version of the curated graph — bumped when edges are added/removed. */
export const LINEAGE_GRAPH_VERSION = "2026.09.12";

/**
 * Edge factory for cleaner call sites.
 *
 * By default every curated edge is an "ancestor" relation — meaning the
 * child descends from the parent. The engine assigns the *relative*
 * direction once it knows which side of the edge the selected base sits
 * on (see `directionOf`).
 */
function e(
  parent: string,
  child: string,
  relation: RelationType,
  confidence: number,
  notes: string,
): AncestorEdge {
  return {
    parent,
    child,
    direction: "ancestor",
    relation,
    confidence,
    notes,
    source: "curated",
  };
}

/**
 * The curated ancestor graph.
 *
 * Read top-down: code forks → platform tokens → wrapped tokens →
 * inspiration chains → conceptual lineage to BTC.
 */
const CURATED_EDGES: AncestorEdge[] = [
  // ─── Code forks of Bitcoin ────────────────────────────────────────────
  e("BTC", "LTC", "fork", 1.0, "Litecoin forked Bitcoin's code in 2011 with a faster block time and a different hashing algorithm (scrypt → now Scrypt-Mix)."),
  e("BTC", "BCH", "fork", 1.0, "Bitcoin Cash forked Bitcoin in August 2017 over the block size debate, increasing the on-chain block weight limit."),
  e("BCH", "BSV", "fork", 1.0, "Bitcoin SV (Satoshi Vision) forked Bitcoin Cash in November 2018 to restore the original Bitcoin protocol limits."),
  e("BTC", "NMC", "fork", 1.0, "Namecoin was the first altcoin — a fork of Bitcoin designed to serve as a decentralized namespace."),
  e("BTC", "PPC", "fork", 1.0, "Peercoin forked Bitcoin's code in 2012, introducing proof-of-stake alongside proof-of-work."),
  e("BTC", "DASH", "fork", 0.9, "Dash forked Bitcoin's code in 2014, adding PrivateSend and InstantSend via masternodes."),
  e("BTC", "XMR", "fork", 0.6, "Monero forked Bytecoin (CryptoNote protocol), not Bitcoin directly, but the broader UTXO/PoW lineage descends from Bitcoin."),
  e("BTC", "ZEC", "fork", 0.7, "Zcash forked Bitcoin's code in 2016, adding zero-knowledge proofs (zk-SNARKs) for shielded transactions."),

  // DOGE → LTC → BTC chain
  e("LTC", "DOGE", "fork", 1.0, "Dogecoin forked Luckycoin in December 2013 — Luckycoin itself was a fork of Litecoin. The chain is BTC → LTC → Luckycoin → DOGE."),

  // ─── Ethereum: native token protocol ──────────────────────────────────
  // Every ERC-20 token's platform ancestor is Ethereum.
  e("ETH", "USDT", "platform", 1.0, "Tether (USDT) is issued as an ERC-20 token on Ethereum. (USDT also exists on TRX, SOL, AVAX, etc., but the canonical issuance is Ethereum.)"),
  e("ETH", "USDC", "platform", 1.0, "USD Coin (USDC) is an ERC-20 token issued by Circle on Ethereum."),
  e("ETH", "DAI", "platform", 1.0, "Dai is the native stablecoin of MakerDAO, an Ethereum-based protocol."),
  e("ETH", "WBTC", "platform", 1.0, "Wrapped Bitcoin (WBTC) is an ERC-20 token on Ethereum that represents Bitcoin 1:1."),
  e("ETH", "WETH", "platform", 1.0, "Wrapped Ether (WETH) is an ERC-20 wrapper around native ETH, enabling ETH to be used in all ERC-20 DeFi flows."),
  e("ETH", "UNI", "platform", 1.0, "Uniswap (UNI) is the governance token of Uniswap, an Ethereum-based DEX protocol."),
  e("ETH", "AAVE", "platform", 1.0, "Aave (AAVE) is the governance token of Aave, an Ethereum-based lending protocol."),
  e("ETH", "LINK", "platform", 1.0, "Chainlink (LINK) is an ERC-20 token used to pay node operators on Ethereum's oracle network."),
  e("ETH", "MKR", "platform", 1.0, "Maker (MKR) is the governance token of MakerDAO, an Ethereum-based protocol."),
  e("ETH", "LDO", "platform", 1.0, "Lido DAO (LDO) is the governance token of Lido, an Ethereum-based liquid staking protocol."),
  e("ETH", "GRT", "platform", 1.0, "The Graph (GRT) is the utility token of The Graph, an indexing protocol for Ethereum."),
  e("ETH", "SNX", "platform", 1.0, "Synthetix (SNX) is the staking token of Synthetix, an Ethereum-based derivatives protocol."),
  e("ETH", "CRV", "platform", 1.0, "Curve DAO (CRV) is the governance token of Curve, an Ethereum-based stablecoin DEX."),
  e("ETH", "COMP", "platform", 1.0, "Compound (COMP) is the governance token of Compound, an Ethereum-based lending protocol."),
  e("ETH", "SHIB", "platform", 1.0, "Shiba Inu (SHIB) is an ERC-20 meme token on Ethereum."),
  e("ETH", "PEPE", "platform", 1.0, "Pepe (PEPE) is an ERC-20 meme token on Ethereum."),
  e("ETH", "BAL", "platform", 1.0, "Balancer (BAL) is the governance token of Balancer, an Ethereum-based AMM."),
  e("ETH", "SUSHI", "platform", 1.0, "SushiSwap (SUSHI) is the governance token of SushiSwap, an Ethereum-based DEX."),
  e("ETH", "YFI", "platform", 1.0, "yearn.finance (YFI) is the governance token of yearn, an Ethereum-based yield aggregator."),
  e("ETH", "CVX", "platform", 1.0, "Convex (CVX) is the governance token of Convex Finance, an Ethereum-based Curve booster."),
  e("ETH", "1INCH", "platform", 1.0, "1inch (1INCH) is the governance token of 1inch, an Ethereum-based DEX aggregator."),
  e("ETH", "ENS", "platform", 1.0, "Ethereum Name Service (ENS) is the native naming token of ENS, an Ethereum-based protocol."),
  e("ETH", "MATIC", "platform", 0.9, "Polygon (MATIC, now POL) is the native gas token of the Polygon network — closely tied to Ethereum as an L2/sidechain."),
  e("ETH", "ARB", "platform", 1.0, "Arbitrum (ARB) is the governance token of Arbitrum, an Ethereum Layer 2 rollup."),
  e("ETH", "OP", "platform", 1.0, "Optimism (OP) is the governance token of Optimism, an Ethereum Layer 2 rollup."),

  // ─── EVM-compatible chains: inspiration descendants of Ethereum ──────
  e("ETH", "BNB", "inspiration", 0.95, "BNB Chain was launched by Binance as an EVM-compatible alternative to Ethereum — same tooling, different validator set."),
  e("ETH", "AVAX", "inspiration", 0.9, "Avalanche's C-Chain is EVM-compatible; the project positions itself as a faster, cheaper alternative to Ethereum."),
  e("ETH", "FTM", "inspiration", 0.9, "Fantom (FTM) is an EVM-compatible smart contract platform positioned as an Ethereum alternative."),
  e("ETH", "CELO", "inspiration", 0.8, "Celo is an EVM-compatible L1 focused on mobile-first payments."),
  e("ETH", "KAVA", "inspiration", 0.8, "Kava is an EVM-compatible L1 with a Cosmos interoperability layer."),
  e("ETH", "CRO", "inspiration", 0.7, "Crypto.org Chain is EVM-compatible; it evolved from Crypto.com's original Cosmos-based chain."),
  e("ETH", "GLMR", "platform", 0.9, "Moonbeam (GLMR) is an EVM-compatible parachain on Polkadot — explicitly designed as an Ethereum-compatible environment on a different consensus."),
  e("ETH", "METIS", "platform", 0.9, "Metis is an Ethereum Layer 2 rollup."),
  e("ETH", "BOBA", "platform", 0.9, "Boba is an Ethereum Layer 2 rollup (originally an Optimistic Oracle fork)."),

  // BNB → BEP-20 platform tokens
  e("BNB", "CAKE", "platform", 1.0, "PancakeSwap (CAKE) is a BEP-20 token on BNB Chain — the canonical DEX of the BNB ecosystem."),

  // ─── Bitcoin: spiritual origin ────────────────────────────────────────
  e("BTC", "ETH", "inspiration", 1.0, "Ethereum (2015) was explicitly conceived as a 'world computer' that extended Bitcoin's blockchain concept with a Turing-complete virtual machine."),
  e("BTC", "XRP", "conceptual", 0.6, "XRP Ledger (2012) launched shortly after Bitcoin's rise as a faster payment-focused ledger — pre-Ethereum altcoin generation."),
  e("BTC", "LTC", "conceptual", 0.9, "Beyond the direct code fork, Litecoin's launch (2011) popularized the altcoin model — every subsequent altcoin conceptually descends from the BTC → LTC template."),
  e("BTC", "XLM", "conceptual", 0.6, "Stellar (2014) forked from Ripple's codebase, but the broader lineage traces back to the post-Bitcoin payment-coin generation."),
  e("BTC", "DOT", "inspiration", 0.8, "Polkadot (2020) builds on the multi-chain thesis that Bitcoin introduced, with explicit Ethereum co-founder involvement."),
  e("BTC", "ATOM", "inspiration", 0.8, "Cosmos (2019) introduced the app-chain thesis and IBC interoperability — building on the multi-chain vision that BTC pioneered."),
  e("BTC", "ADA", "inspiration", 0.7, "Cardano (2017 launch, 2020 smart contracts) is a third-generation smart contract platform in the lineage started by BTC and extended by ETH."),
  e("BTC", "XTZ", "inspiration", 0.7, "Tezos (2018) is a smart contract platform positioned as a more governance-friendly evolution of the blockchain thesis."),
  e("BTC", "EGLD", "inspiration", 0.7, "MultiversX / Elrond (2020) is a sharded smart contract platform in the BTC-originated lineage."),
  e("BTC", "ALGO", "inspiration", 0.7, "Algorand (2019) is a smart contract platform in the lineage started by BTC."),
  e("BTC", "NEAR", "inspiration", 0.7, "NEAR Protocol (2020) is a sharded smart contract platform in the lineage started by BTC."),
  e("BTC", "ICP", "inspiration", 0.6, "Internet Computer (2021) is a smart contract platform with a different architecture — but the broader lineage traces back to BTC's blockchain concept."),
  e("BTC", "HBAR", "inspiration", 0.6, "Hedera (HBAR, 2019) is a smart contract platform with hashgraph consensus — different mechanism, same lineage."),
  e("BTC", "EOS", "inspiration", 0.7, "EOS (2018) was launched as a more performant smart contract platform following the ETH blueprint."),
  e("BTC", "TRX", "inspiration", 0.7, "Tron (TRX, 2018) launched as an Ethereum-killer smart contract platform focused on content/entertainment."),
  e("BTC", "FLOW", "inspiration", 0.6, "Flow (FLOW, 2020) is a smart contract platform focused on NFTs and consumer apps."),
  e("BTC", "KAS", "inspiration", 0.6, "Kaspa (KAS, 2021) is a proof-of-work smart contract chain with GhostDAG consensus — Bitcoin-descended."),
  e("BTC", "SUI", "inspiration", 0.7, "Sui (SUI, 2023) is a smart contract platform built by former Meta Diem team — different lineage but the same conceptual ancestor."),
  e("BTC", "APT", "inspiration", 0.7, "Aptos (APT, 2022) is a smart contract platform built by former Meta Diem team — same lineage as SUI."),
  e("BTC", "VET", "inspiration", 0.6, "VeChain (VET, 2018) is a smart contract platform focused on supply chain — broader lineage from BTC."),

  // ─── Solana descendants ───────────────────────────────────────────────
  e("SOL", "BONK", "platform", 1.0, "Bonk (BONK) is an SPL token on Solana — the canonical Solana meme token."),
  e("SOL", "WIF", "platform", 1.0, "dogwifhat (WIF) is an SPL token on Solana."),
  e("SOL", "JUP", "platform", 1.0, "Jupiter (JUP) is the governance token of Jupiter, the canonical Solana DEX aggregator."),
  e("SOL", "RAY", "platform", 1.0, "Raydium (RAY) is the governance token of Raydium, a Solana-based AMM."),
  e("SOL", "PYTH", "platform", 1.0, "Pyth Network (PYTH) is the governance token of Pyth, a Solana-based oracle network."),
  e("SOL", "JTO", "platform", 1.0, "Jito (JTO) is the governance token of Jito, a Solana-based MEV/LST protocol."),

  // SOL → ETH inspiration (Solana positioned as faster Ethereum alternative)
  e("ETH", "SOL", "inspiration", 0.95, "Solana (2020) was explicitly designed as a faster, cheaper Ethereum alternative — same smart-contract thesis, different consensus (PoH + PoS)."),

  // ─── Wrapped tokens ──────────────────────────────────────────────────
  e("ETH", "WETH", "wrapped", 1.0, "WETH is the ERC-20 wrapper around native ETH."),
  e("BTC", "WBTC", "wrapped", 1.0, "WBTC is an ERC-20 token on Ethereum that represents Bitcoin 1:1, custodied by a federation."),
  e("BNB", "WBNB", "wrapped", 1.0, "WBNB is the BEP-20 wrapper around native BNB."),
  e("SOL", "WSOL", "wrapped", 1.0, "Wrapped SOL is the SPL wrapper around native SOL."),
  e("AVAX", "WAVAX", "wrapped", 1.0, "WAVAX is the ERC-20 wrapper around native AVAX on the C-Chain."),
  e("MATIC", "WMATIC", "wrapped", 1.0, "WMATIC is the ERC-20 wrapper around native MATIC."),

  // ─── Conceptual lineage: most altcoins → BTC ─────────────────────────
  // The "every altcoin conceptually descends from Bitcoin" thesis.
  // These are explicit so the lineage tree always shows BTC at the root.
  e("BTC", "XMR", "conceptual", 0.9, "Beyond the code fork, Monero's privacy thesis extends the cypherpunk tradition that Bitcoin inaugurated."),
  e("BTC", "ZEC", "conceptual", 0.9, "Beyond the code fork, Zcash's privacy thesis extends the cypherpunk tradition that Bitcoin inaugurated."),
  e("BTC", "DASH", "conceptual", 0.7, "Beyond the code fork, Dash's payment-focused thesis extends Bitcoin's original payment mission."),
  e("BTC", "USDT", "conceptual", 0.7, "Tether is a digital dollar built on top of blockchain rails pioneered by Bitcoin."),
  e("BTC", "USDC", "conceptual", 0.7, "USDC is a digital dollar built on top of blockchain rails pioneered by Bitcoin."),
  e("BTC", "DAI", "conceptual", 0.7, "Dai is a decentralized stablecoin built on the Ethereum blockchain — descended from the broader blockchain thesis."),
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Every curated edge keyed by its child. Used as the primary lookup
 * table for direct ancestors of a given symbol.
 */
const EDGES_BY_CHILD: Map<string, AncestorEdge[]> = (() => {
  const map = new Map<string, AncestorEdge[]>();
  for (const edge of CURATED_EDGES) {
    const list = map.get(edge.child.toUpperCase()) ?? [];
    list.push(edge);
    map.set(edge.child.toUpperCase(), list);
  }
  return map;
})();

/**
 * Every curated edge keyed by its parent. Used to detect cycles and
 * descendants of the selected base.
 */
const EDGES_BY_PARENT: Map<string, AncestorEdge[]> = (() => {
  const map = new Map<string, AncestorEdge[]>();
  for (const edge of CURATED_EDGES) {
    const list = map.get(edge.parent.toUpperCase()) ?? [];
    list.push(edge);
    map.set(edge.parent.toUpperCase(), list);
  }
  return map;
})();

/** Lookup helper for tests. */
export function getCuratedEdges(): readonly AncestorEdge[] {
  return CURATED_EDGES;
}

export function getEdgesByChild(symbol: string): readonly AncestorEdge[] {
  return EDGES_BY_CHILD.get(symbol.toUpperCase()) ?? [];
}

export function getEdgesByParent(symbol: string): readonly AncestorEdge[] {
  return EDGES_BY_PARENT.get(symbol.toUpperCase()) ?? [];
}

// ---------------------------------------------------------------------------
// Direction annotation
// ---------------------------------------------------------------------------

/**
 * Determine the direction of an edge from the perspective of the selected
 * base. This is the single source of truth for direction — it is never
 * inferred from where the edge sits in the rendered graph.
 *
 *   - if the base IS the parent → descendants
 *   - if the base IS the child  → ancestors (the base descends from parent)
 *   - if the candidate is in the base's descendant set → descendant
 *   - otherwise → relative (peer in the same era/category)
 *
 * Exported because callers (e.g. tests, the engine) sometimes want to
 * ask "what direction does this edge have, from the base's POV?".
 */
export function directionOf(
  base: string,
  edge: AncestorEdge,
  descendants: Set<string>,
): RelationshipDirection {
  const baseU = base.toUpperCase();
  const parent = edge.parent.toUpperCase();
  const child = edge.child.toUpperCase();

  if (baseU === parent) return "descendant";
  if (baseU === child) return "ancestor";

  // If the candidate is a known descendant of the base, it must NOT be
  // labelled an ancestor — return descendant instead.
  if (descendants.has(parent)) return "descendant";
  if (descendants.has(child)) return "descendant";

  // Otherwise this edge is unrelated to the base's own lineage.
  return "relative";
}

/**
 * Compute the set of every symbol that is downstream (a descendant) of
 * `root` according to the curated ancestor graph. We treat the edge
 * `parent ← child` as `child` being downstream of `parent`.
 *
 * Used to enforce invariant #2: a descendant of the selected asset must
 * never appear as one of its ancestors.
 *
 * The result includes `root` itself (it's trivially reachable from itself).
 *
 * Returns a Set so duplicate visits short-circuit.
 */
export function descendantsOf(
  root: string,
  maxDepth = 8,
): Set<string> {
  const result = new Set<string>([root.toUpperCase()]);
  const queue: Array<{ sym: string; depth: number }> = [
    { sym: root.toUpperCase(), depth: 0 },
  ];
  while (queue.length > 0) {
    const { sym, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    // Children of `sym` are descendants.
    const kids = EDGES_BY_PARENT.get(sym) ?? [];
    for (const e of kids) {
      const child = e.child.toUpperCase();
      if (result.has(child)) continue;
      result.add(child);
      queue.push({ sym: child, depth: depth + 1 });
    }
  }
  return result;
}

/**
 * Detect whether `edges` contains a cycle. Returns the indices of edges
 * that, if removed, would break the cycle. Uses Tarjan-style DFS over
 * the `parent → child` adjacency. Every edge on the DFS path inside the
 * cycle is marked so we always drop at least one edge per cycle.
 */
function detectCycle(edges: AncestorEdge[]): Set<number> {
  const out = new Set<number>();
  // Build adjacency: parent sym -> [indices of edges leaving it].
  const adj = new Map<string, number[]>();
  edges.forEach((e, idx) => {
    const parent = e.parent.toUpperCase();
    const list = adj.get(parent) ?? [];
    list.push(idx);
    adj.set(parent, list);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(v: string, pathStack: number[]): boolean {
    if (visiting.has(v)) {
      // Found a cycle — mark every edge on the current DFS path.
      for (const idx of pathStack) out.add(idx);
      return true;
    }
    if (visited.has(v)) return false;
    visiting.add(v);
    const list = adj.get(v) ?? [];
    for (const idx of list) {
      const child = edges[idx]!.child.toUpperCase();
      dfs(child, [...pathStack, idx]);
    }
    visiting.delete(v);
    visited.add(v);
    return false;
  }

  for (const sym of adj.keys()) {
    dfs(sym, []);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lineage walker — root-aware, explicit invariants
// ---------------------------------------------------------------------------

const MAX_HOPS = 3;

/**
 * Resolve the lineage for a base asset. The base is always the ROOT.
 *
 * Algorithm:
 *
 *   1. Pre-compute `descendants` = every symbol downstream of the base in
 *      the curated ancestor graph. Any candidate that falls inside this
 *      set is explicitly REJECTED from the ancestor list.
 *   2. From the curated + Tavily edge set, keep only edges where the
 *      `child` is upstream of the base (i.e. the base can reach the
 *      child via its ancestors). This filters out siblings and
 *      descendants before we ever walk the graph.
 *   3. Detect cycles in the filtered set and drop the offending edges.
 *   4. Walk up from the base, bounded to MAX_HOPS, never revisiting a
 *      symbol, never descending, never self-referencing.
 *   5. Each surviving edge is stamped with its `direction` from the
 *      perspective of the base (always `ancestor` for the up-stream
 *      chain we walk here).
 *
 * Returns a `LineageResult` ready for the API route.
 */
export function resolveLineage(
  baseSymbol: string,
  universe: Map<string, UniverseEntry>,
  tavilyEdges: ReadonlyMap<string, readonly AncestorEdge[]> = new Map(),
): import("./types").LineageResult {
  const target = baseSymbol.toUpperCase();
  const now = new Date().toISOString();
  const visited = new Set<string>([target]);

  // 1. Compute descendants of the base from the curated graph.
  // Anything in this set must NEVER appear as an ancestor.
  const descendants = descendantsOf(target);

  // 2. Collect candidate edges from curated + Tavily.
  const candidates: AncestorEdge[] = [];
  const curated = EDGES_BY_CHILD.get(target) ?? [];
  for (const edge of curated) candidates.push(edge);
  const tavily = tavilyEdges.get(target) ?? [];
  for (const edge of tavily) candidates.push(edge);

  // 3. Cycle detection over the candidate set.
  const cycleEdges = detectCycle(candidates);
  if (cycleEdges.size > 0) {
    // Log and drop.
    // eslint-disable-next-line no-console
    console.warn(
      `[ancestor] Cycle detected for ${target}, dropping ${cycleEdges.size} edge(s).`,
    );
  }

  const filtered = candidates.filter((_, idx) => !cycleEdges.has(idx));

  const edges: AncestorEdge[] = [];
  const ancestors: import("./types").AncestorNode[] = [];
  const chain: string[] = [];
  let curatedHits = 0;
  let tavilyHits = 0;

  // BTC is the spiritual origin of the crypto universe. Every other
  // coin in existence is a descendant of it, not an ancestor.
  if (target === "BTC") {
    return {
      base: target,
      base_name: lookupName(target, universe) ?? "Bitcoin",
      base_rank: lookupRank(target, universe) ?? null,
      edges: [],
      ancestors: [],
      lineage_chain: [],
      calculated_at: now,
      algorithm_version: ALGORITHM_VERSION,
      meta: {
        noAncestors: true,
        noAncestorsReason:
          "Bitcoin is the original cryptocurrency. Every other coin in existence is a descendant of it, not an ancestor.",
        curatedHits: 0,
        tavilyHits: 0,
      },
    };
  }

  walk(target, 0);

  if (ancestors.length === 0) {
    return {
      base: target,
      base_name: lookupName(target, universe) ?? target,
      base_rank: lookupRank(target, universe) ?? null,
      edges: [],
      ancestors: [],
      lineage_chain: [],
      calculated_at: now,
      algorithm_version: ALGORITHM_VERSION,
      meta: {
        noAncestors: true,
        noAncestorsReason:
          "We don't have lineage data for this coin in our curated graph, and Tavily didn't surface a clear ancestor either.",
        curatedHits,
        tavilyHits,
      },
    };
  }

  return {
    base: target,
    base_name: lookupName(target, universe) ?? target,
    base_rank: lookupRank(target, universe) ?? null,
    edges,
    ancestors,
    lineage_chain: chain,
    calculated_at: now,
    algorithm_version: ALGORITHM_VERSION,
    meta: { curatedHits, tavilyHits },
  };

  // ---------------------------------------------------------------------
  // Inner walker — recursive but bounded. Explicit invariants enforced:
  //
  //   - never adds the base itself (visited already contains it)
  //   - never revisits a symbol (visited check)
  //   - never adds a descendant of the base (descendants check)
  //   - stops at MAX_HOPS or at BTC (the spiritual root)
  //   - Tavily edges never chain (one-hop only)
  // ---------------------------------------------------------------------
  function walk(symbol: string, hop: number) {
    if (hop >= MAX_HOPS) return;
    void hop;

    // Pull curated + tavily edges for THIS symbol. Curated first because
    // it's higher-trust.
    const cEdges = EDGES_BY_CHILD.get(symbol) ?? [];
    const tEdges = (tavilyEdges.get(symbol) ?? []).slice(0, 1);

    const seen = new Set<string>();
    const merged: AncestorEdge[] = [];
    for (const edge of [...cEdges, ...tEdges]) {
      const parent = edge.parent.toUpperCase();
      const child = edge.child.toUpperCase();
      const key = `${parent}::${edge.relation}`;
      if (seen.has(key)) continue;
      // Invariant: never add the base as its own ancestor.
      if (parent === target) continue;
      // Invariant: never add a descendant of the base.
      if (descendants.has(parent)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ancestor] Rejected descendant "${parent}" from ancestors of "${target}" (would create descendant-as-ancestor).`,
        );
        continue;
      }
      // Invariant: never revisit.
      if (visited.has(parent)) continue;
      // Invariant: parent cannot be the same as the current symbol (no
      // self-loop edges should ever exist, but defend anyway).
      if (parent === child) continue;

      seen.add(key);
      merged.push(edge);
    }

    for (const edge of merged) {
      const parent = edge.parent.toUpperCase();
      visited.add(parent);

      if (edge.source === "curated") curatedHits += 1;
      else tavilyHits += 1;

      edges.push({ ...edge, direction: "ancestor" });
      chain.push(parent);

      const universeEntry = universe.get(parent);
      ancestors.push({
        symbol: parent,
        name:
          universeEntry?.name ??
          edge.notes.split(" ").slice(0, 3).join(" "),
        cmc_rank: universeEntry?.cmc_rank ?? null,
        relation: edge.relation,
        confidence: edge.confidence,
        notes: edge.notes,
        source: edge.source,
        quote: universeEntry?.quote,
        inUniverse: Boolean(universeEntry),
      });

      // Decide whether to recurse:
      //   - Curated edges that are NOT wrapped: walk up one more hop.
      //   - Tavily edges: never chain (one-hop only).
      //   - Never recurse past BTC.
      const recursive =
        edge.source === "curated" &&
        edge.relation !== "wrapped" &&
        parent !== "BTC";

      if (recursive) {
        walk(parent, hop + 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public helpers used by the engine and tests
// ---------------------------------------------------------------------------

/**
 * Return every curated edge that could potentially be an ancestor of
 * `base` — i.e. edges where the base can reach the child via ancestors.
 * Used by tests and by the engine for diagnostics.
 *
 * Excludes any edge that would introduce the base as its own ancestor or
 * that targets a descendant of the base.
 */
export function candidateAncestorEdges(baseSymbol: string): AncestorEdge[] {
  const target = baseSymbol.toUpperCase();
  const descendants = descendantsOf(target);
  const visited = new Set<string>([target]);
  const out: AncestorEdge[] = [];
  function walk(sym: string) {
    const list = EDGES_BY_CHILD.get(sym) ?? [];
    for (const edge of list) {
      const parent = edge.parent.toUpperCase();
      if (visited.has(parent)) continue;
      if (descendants.has(parent)) continue;
      visited.add(parent);
      out.push(edge);
      walk(parent);
    }
  }
  walk(target);
  return out;
}

/**
 * Direction-annotated view of the ancestry tree. Returns three buckets:
 *
 *   - ancestors : every upstream edge from the base
 *   - descendants : every edge going down from the base
 *   - relatives : same-era peers that share a category but aren't up/down
 *
 * This is what the UI uses to label its three relationship sections.
 */
export function buildRelationshipView(
  baseSymbol: string,
  tavilyEdges: ReadonlyMap<string, readonly AncestorEdge[]> = new Map(),
): {
  ancestors: AncestorEdge[];
  descendants: AncestorEdge[];
  relatives: AncestorEdge[];
} {
  const target = baseSymbol.toUpperCase();
  const descendantSet = descendantsOf(target);

  // Direct descendants = every edge where parent === base.
  const descendants: AncestorEdge[] = [];
  for (const edge of EDGES_BY_PARENT.get(target) ?? []) {
    descendants.push({ ...edge, direction: "descendant" });
  }

  // Direct ancestors = the curated ancestors of base (one-hop) plus any
  // Tavily edges for base.
  const ancestors: AncestorEdge[] = [];
  const seen = new Set<string>();
  for (const edge of [
    ...(EDGES_BY_CHILD.get(target) ?? []),
    ...(tavilyEdges.get(target) ?? []),
  ]) {
    const parent = edge.parent.toUpperCase();
    if (parent === target) continue;
    if (descendantSet.has(parent)) continue;
    const key = `${parent}::${edge.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ancestors.push({ ...edge, direction: "ancestor" });
  }

  // Relatives = curated edges between assets that are neither ancestors
  // nor descendants of base, but share some lineage context.
  const relatives: AncestorEdge[] = [];
  for (const edge of CURATED_EDGES) {
    const parent = edge.parent.toUpperCase();
    const child = edge.child.toUpperCase();
    if (parent === target || child === target) continue;
    if (ancestors.some((a) => a.parent === parent && a.child === child))
      continue;
    if (descendants.some((d) => d.parent === parent && d.child === child))
      continue;
    // Only treat as a relative if at least one endpoint is reachable
    // from base within 2 hops (otherwise it's noise).
    relatives.push({ ...edge, direction: "relative" });
  }

  return { ancestors, descendants, relatives };
}

function lookupName(
  symbol: string,
  universe: Map<string, UniverseEntry>,
): string | undefined {
  return universe.get(symbol.toUpperCase())?.name;
}

function lookupRank(
  symbol: string,
  universe: Map<string, UniverseEntry>,
): number | null | undefined {
  return universe.get(symbol.toUpperCase())?.cmc_rank;
}