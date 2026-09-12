import type { Metadata } from "next";
import { Suspense } from "react";
import { AncestorExperience } from "./AncestorExperience";

export const metadata: Metadata = {
  title: "Ancestor",
  description:
    "Find a cryptocurrency and discover its market ancestors — calculated transparently across multiple dimensions.",
};

export default function AncestorPage() {
  // The client component reads useSearchParams(), which forces a dynamic
  // boundary. Wrapping in <Suspense> prevents "Suspense Exception" errors
  // during client-side navigations to ?symbol=... URLs.
  return (
    <Suspense fallback={null}>
      <AncestorExperience />
    </Suspense>
  );
}
