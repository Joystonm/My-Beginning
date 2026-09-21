import type { Metadata } from "next";
import { UniversesView } from "./UniversesView";
import { requireUser } from "@/lib/auth/guard";
import { isApiKeyConfigured } from "@/lib/cmc/env";

export const metadata: Metadata = {
  title: "My Universes",
  description:
    "Group cryptocurrencies into your own universes. Open any universe in Market Lab for comparison.",
};

export default async function UniversesPage() {
  await requireUser("/universes");
  // Read server-side: non-NEXT_PUBLIC env vars are undefined in client bundles,
  // so the client component must receive this as a prop rather than call
  // isApiKeyConfigured() directly.
  return <UniversesView cmcConfigured={isApiKeyConfigured()} />;
}
