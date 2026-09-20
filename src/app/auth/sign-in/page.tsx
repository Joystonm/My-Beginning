import { redirect } from "next/navigation";

/**
 * Legacy route — `/auth/sign-in` is replaced by the unified `/login`.
 * Preserve the `next` query so deep links still work after login.
 */
export default function LegacySignInRedirect({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next
    ? `?next=${encodeURIComponent(searchParams.next)}`
    : "";
  redirect(`/login${next}`);
}
