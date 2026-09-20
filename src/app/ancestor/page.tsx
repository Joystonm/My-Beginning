import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { AncestorExperience } from "./AncestorExperience";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: "Ancestor",
  description:
    "Find a cryptocurrency and discover its market ancestors — calculated transparently across multiple dimensions.",
};

export default async function AncestorPage() {
  // Resolve the current pathname for the post-login redirect target.
  // On the server we don't have usePathname, so we ask Next's headers.
  // Falling back to a literal "/ancestor" keeps the redirect safe.
  let nextPath = "/ancestor";
  try {
    const h = headers();
    const path = h.get("x-invoke-path") || h.get("x-pathname") || h.get("next-url");
    if (path) nextPath = path;
  } catch {
    /* headers() not available — use fallback */
  }

  await requireUser(nextPath);

  return (
    <Suspense fallback={null}>
      <AncestorExperience />
    </Suspense>
  );
}
