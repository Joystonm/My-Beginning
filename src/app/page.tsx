import Link from "next/link";
import { Eyebrow, Panel, PanelHeader } from "@/components/design-system";

export default function HomePage() {
  return (
    <div className="py-14 sm:py-20">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 xl:col-span-7 max-w-2xl">
          <Eyebrow>CoinMarketCap × DoraHacks · Data & Visualisation</Eyebrow>
          <h1 className="heading-display text-4xl sm:text-5xl mt-3 text-ink-primary">
            Every asset has a lineage.
            <br />
            <span className="text-ink-secondary">Find yours.</span>
          </h1>
          <p className="mt-5 text-md text-ink-secondary leading-relaxed max-w-xl">
            Who Is My Ancestor traces a cryptocurrency's real lineage — code
            forks, native tokens on other chains, wrapped versions, and
            inspiration chains — calculated from a curated ancestor graph and
            enriched with live web lookups via Tavily.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/ancestor"
              className="inline-flex items-center gap-2 rounded-[4px] bg-ink-primary text-ink-inverse text-md h-11 px-5 hover:bg-[#1c1c1c] transition-colors duration-180"
            >
              Find an ancestor
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-[4px] bg-canvas text-ink-primary text-md h-11 px-5 border border-line-strong hover:bg-canvas-sunken transition-colors duration-180"
            >
              Open Market Lab
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-x-6 gap-y-2 max-w-md text-sm">
            <Stat label="Endpoints used" value="6" />
            <Stat label="Relations" value="5" />
            <Stat label="Universe" value="Top 250" />
          </div>
        </div>

        {/* Right column — static lineage preview */}
        <div className="lg:col-span-6 xl:col-span-5">
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Lineage preview · SOL"
              title="Solana → Ethereum → Bitcoin"
              description="Real lineage, traced through the curated ancestor graph."
            />
            <div className="p-5 bg-canvas-sunken/40">
              <LineagePreviewSvg />
              <p className="mt-5 text-xs text-ink-tertiary leading-relaxed">
                Illustrative preview. Real results are computed live from
                CoinMarketCap&apos;s <code className="font-mono">/v1/cryptocurrency/listings/latest</code>{" "}
                endpoint and enriched with Tavily web lookups.
              </p>
            </div>
          </Panel>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-section">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="heading-display text-2xl sm:text-3xl mt-2 max-w-2xl">
          A transparent engine — no invented ancestors.
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line rounded-[6px] overflow-hidden">
          <Step
            n="01"
            title="Ingest CMC market data"
            body="Top assets, quotes, market pairs, exchanges and global metrics are pulled server-side from the CoinMarketCap API."
          />
          <Step
            n="02"
            title="Walk the ancestor graph"
            body="A curated graph of code forks, platform tokens, wrapped versions, inspiration chains and conceptual lineage. Tavily fills the long tail."
          />
          <Step
            n="03"
            title="Trace & explain"
            body="Every edge is labeled with its relation type (fork, platform, wrapped, inspiration) and a confidence in the claim. No statistical similarity, no peer conflation."
          />
        </div>
      </section>

      {/* Product sections */}
      <section className="mt-section">
        <Eyebrow>The product</Eyebrow>
        <h2 className="heading-display text-2xl sm:text-3xl mt-2 max-w-2xl">
          Four surfaces. One coherent idea.
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Feature
            href="/ancestor"
            label="Ancestor"
            title="The flagship experience"
            body="Find a cryptocurrency and walk its lineage. Every edge is labeled with its relation type and the confidence in the claim."
          />
          <Feature
            href="/lab"
            label="Market Lab"
            title="A professional analytics workspace"
            body="Global metrics, side-by-side asset comparison, custom metric builder, and a data explorer — all driven by the same CoinMarketCap data."
          />
          <Feature
            href="/universes"
            label="My Universes"
            title="Your collections of assets"
            body="Group assets by theme, narrative or experiment. Open any universe in Market Lab to compare what matters to you."
          />
          <Feature
            href="/explore"
            label="Explore"
            title="The CMC universe at a glance"
            body="Search, sort and filter the broader market. A discovery surface for finding new lineages."
          />
        </div>
      </section>

      {/* CMC evidence */}
      <section className="mt-section">
        <Panel>
          <PanelHeader
            eyebrow="API evidence"
            title="Built on real CoinMarketCap data"
            description="Every market number on this site comes from a live API call to coinmarketcap.com. The endpoints used are visible inside Market Lab."
          />
          <div className="p-5">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-mono">
              {[
                "/v1/cryptocurrency/listings/latest",
                "/v1/cryptocurrency/quotes/latest",
                "/v1/cryptocurrency/info",
                "/v1/cryptocurrency/market-pairs/latest",
                "/v1/global-metrics/quotes/latest",
                "/v1/exchange/listings/latest",
              ].map((e) => (
                <li
                  key={e}
                  className="rounded-[4px] border border-line bg-canvas-sunken/50 px-3 py-2 text-ink-secondary truncate"
                >
                  GET {e}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-ink-secondary">
                API keys never leave the server. The /api/cmc/evidence route
                shows a sanitized call log so judges can verify usage.
              </p>
              <Link
                href="/lab?tab=evidence"
                className="shrink-0 text-sm text-accent hover:underline"
              >
                See evidence →
              </Link>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="heading-eyebrow">{label}</div>
      <div className="text-lg tnum text-ink-primary mt-1">{value}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-canvas p-6">
      <div className="heading-eyebrow mb-2">{n}</div>
      <h3 className="text-md font-medium text-ink-primary mb-1.5">{title}</h3>
      <p className="text-sm text-ink-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({
  href,
  label,
  title,
  body,
}: {
  href: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[6px] border border-line bg-canvas p-6 hover:border-line-strong hover:bg-canvas-sunken/30 transition-colors duration-180"
    >
      <div className="heading-eyebrow">{label}</div>
      <h3 className="text-md font-medium text-ink-primary mt-2 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-ink-secondary leading-relaxed">{body}</p>
      <div className="mt-4 text-sm text-accent">Open →</div>
    </Link>
  );
}

/**
 * Static SVG preview of the lineage chain — drawn inline so we don't
 * depend on the interactive LineageGraph component (which is wired to
 * the full LineageResult shape).
 */
function LineagePreviewSvg() {
  return (
    <svg
      viewBox="0 0 360 200"
      className="w-full h-auto"
      role="img"
      aria-label="Lineage preview: SOL descends from ETH, which descends from BTC"
    >
      {/* Vertical connector */}
      <line
        x1={180}
        y1={32}
        x2={180}
        y2={170}
        stroke="#E5E2DA"
        strokeWidth={1.5}
        strokeDasharray="3 4"
      />
      {/* Arrows */}
      <path
        d="M 180 80 L 180 96"
        stroke="#CFCCC3"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
        fill="none"
      />
      <path
        d="M 180 144 L 180 160"
        stroke="#CFCCC3"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
        fill="none"
      />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#CFCCC3" />
        </marker>
      </defs>

      {/* SOL node */}
      <g transform="translate(120, 16)">
        <rect width={120} height={48} rx={5} fill="#0E0E0E" />
        <text x={60} y={22} textAnchor="middle" fill="#FAF8F4" fontSize={14} fontWeight={600}>
          SOL
        </text>
        <text x={60} y={38} textAnchor="middle" fill="#B4B4AE" fontSize={10}>
          Solana
        </text>
      </g>
      {/* Relation label: inspired by */}
      <text x={200} y={92} fill="#5C8A88" fontSize={10} fontWeight={500}>
        Inspired by
      </text>

      {/* ETH node */}
      <g transform="translate(120, 100)">
        <rect width={120} height={48} rx={5} fill="#FFFFFF" stroke="#CFCCC3" />
        <text x={60} y={22} textAnchor="middle" fill="#0E0E0E" fontSize={14} fontWeight={600}>
          ETH
        </text>
        <text x={60} y={38} textAnchor="middle" fill="#5C5C58" fontSize={10}>
          Ethereum
        </text>
      </g>
      {/* Relation label: spiritual descendant of */}
      <text x={200} y={156} fill="#5C8A88" fontSize={10} fontWeight={500}>
        Spiritual descendant of
      </text>

      {/* BTC node */}
      <g transform="translate(120, 164)">
        <rect width={120} height={32} rx={4} fill="#FFFFFF" stroke="#CFCCC3" />
        <text x={60} y={20} textAnchor="middle" fill="#0E0E0E" fontSize={13} fontWeight={600}>
          BTC · Bitcoin
        </text>
      </g>
    </svg>
  );
}
