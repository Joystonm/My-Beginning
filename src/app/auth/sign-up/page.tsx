import { redirect } from "next/navigation";

/**
 * Legacy route — `/auth/sign-up` is replaced by the unified `/login`.
 * Deep links with `?next=` still resolve correctly after login.
 */
export default function LegacySignUpRedirect({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next
    ? `?next=${encodeURIComponent(searchParams.next)}`
    : "";
  redirect(`/login${next}`);
}
