import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "@/lib/supabase/server";

/**
 * Server-side auth guard for protected pages.
 *
 * Pages call this at the top of their default server export. If the
 * visitor has no session, we redirect to /login (preserving the
 * intended destination via ?next=...).
 *
 * Pair this with <ProtectedRoute> on the client side for a flicker-
 * free experience: the server ensures no protected content is ever
 * sent to the wire; the client guard prevents a flash of content
 * before a client-side navigation can be redirected.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath
      ? `?next=${encodeURIComponent(nextPath)}`
      : "";
    redirect(`/login${next}`);
  }
  return user;
}

/** Same as requireUser, but returns null instead of redirecting. */
export async function maybeUser(): Promise<AuthUser | null> {
  return await getCurrentUser();
}
