import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "./ExploreView";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Browse the CoinMarketCap universe — search, sort, filter, with lineage-aware family chips.",
};

export default async function ExplorePage() {
  await requireUser("/explore");
  // useSearchParams() in ExploreView forces this view into a Suspense
  // boundary — without it Next.js bails out of static generation.
  return (
    <Suspense fallback={null}>
      <ExploreView />
    </Suspense>
  );
}
