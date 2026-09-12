import type { Metadata } from "next";
import { getGlobalMetrics, getListingsLatest } from "@/lib/cmc/client";
import { isApiKeyConfigured } from "@/lib/cmc";
import { MarketLab } from "@/components/lib/lab/MarketLab";
import { Eyebrow } from "@/components/design-system";

export const metadata: Metadata = {
  title: "Market Lab",
  description:
    "Professional analytics workspace for the cryptocurrency universe. Global metrics, asset comparison, data explorer and API evidence.",
};

export const dynamic = "force-dynamic";

export default async function LabPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  let universe: Awaited<ReturnType<typeof getListingsLatest>> = [];
  let global = null;
  let universeError: string | null = null;
  let globalError: string | null = null;

  if (isApiKeyConfigured()) {
    try {
      universe = await getListingsLatest({ limit: 250 });
    } catch (err) {
      universeError = err instanceof Error ? err.message : "CMC request failed.";
    }
    try {
      global = await getGlobalMetrics();
    } catch (err) {
      globalError = err instanceof Error ? err.message : "CMC request failed.";
    }
  } else {
    universeError = "CMC_API_KEY is not configured.";
    globalError = "CMC_API_KEY is not configured.";
  }

  return (
    <div className="py-10 sm:py-14">
      <Eyebrow>Market Lab</Eyebrow>
      <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary max-w-xl">
          A workspace for the data
        </h1>
        <p className="text-sm text-ink-secondary max-w-md">
          Overview, comparison, data explorer and API evidence — all powered by
          the same CoinMarketCap data the Ancestor engine uses.
        </p>
      </div>

      <div className="mt-8">
        <MarketLab
          initialTab={searchParams.tab}
          universe={universe}
          global={global}
          globalError={globalError}
          universeError={universeError}
        />
      </div>
    </div>
  );
}