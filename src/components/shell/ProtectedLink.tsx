"use client";

/**
 * ProtectedLink — auth-aware <Link> wrapper.
 *
 * Use this anywhere a public page (marketing landing, login page,
 * error pages) needs to point a visitor at a protected destination
 * like /ancestor or /lab.
 *
 *   - When the visitor is signed in, this renders a plain <Link> to
 *     the destination. No extra hop, no flicker.
 *   - When the visitor is signed out, this renders a <Link> to
 *     `/login?next=<destination>` so the post-login redirect takes
 *     them where they wanted to go.
 *   - While auth state is loading (first paint before the session
 *     fetch resolves), we conservatively route through /login so
 *     signed-out users never see a flash of protected content if they
 *     try to navigate. Signed-in users get a single redirect through
 *     /login, which is acceptable during the brief loading window.
 *
 * The component is intentionally lightweight — it does NOT fetch auth
 * state on its own. It reads `useAuth()` from the AuthProvider mounted
 * in the root layout, which is hydrated from the SSR-resolved
 * `initialUser` and refreshed client-side. This means the very first
 * render already knows whether the visitor is signed in.
 */

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useAuth } from "@/components/auth";

interface Props extends Omit<ComponentProps<typeof Link>, "href"> {
  /** The destination inside the protected area. */
  to: string;
  href?: never;
  children: ReactNode;
}

function buildLoginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function ProtectedLink({ to, children, ...rest }: Props) {
  const { user, loading } = useAuth();

  // While auth state is loading we cannot safely assume the user is
  // signed in, so route through /login. The server-rendered `initialUser`
  // in AuthProvider means this branch only matters for the very first
  // client tick before /api/auth/session resolves.
  const isSignedIn = !loading && Boolean(user);
  const href = isSignedIn ? to : buildLoginHref(to);

  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
