import type { Metadata } from "next";
import { ExploreView } from "./ExploreView";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse the CoinMarketCap universe — search, sort, filter.",
};

export default function ExplorePage() {
  return <ExploreView />;
}