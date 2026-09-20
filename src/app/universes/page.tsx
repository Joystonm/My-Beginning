import type { Metadata } from "next";
import { UniversesView } from "./UniversesView";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: "My Universes",
  description:
    "Group cryptocurrencies into your own universes. Open any universe in Market Lab for comparison.",
};

export default async function UniversesPage() {
  await requireUser("/universes");
  return <UniversesView />;
}
