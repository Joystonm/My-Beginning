import type { Metadata } from "next";
import { UniversesView } from "./UniversesView";

export const metadata: Metadata = {
  title: "My Universes",
  description:
    "Group cryptocurrencies into your own universes. Open any universe in Market Lab for comparison.",
};

export default function UniversesPage() {
  return <UniversesView />;
}