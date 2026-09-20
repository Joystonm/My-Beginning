import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server-side Supabase client bound to the current request cookies.
 * Returns null when env vars are missing (dev-safe fallback).
 *
 * IMPORTANT — Next.js 14 cookie semantics:
 *
 *   In Next.js 14, mutating cookies inside a route handler ONLY works
 *   through the `cookies().set(...)` call that Next.js observes.
 *   `cookies().set()` throws if the response has already started, so
 *   the only safe pattern is to use the `getAll` / `setAll` pair: the
 *   Supabase client gives us a batch of writes, we apply each one to
 *   the Next.js cookie store.
 *
 *   The older `get` / `set` / `remove` callbacks work in Server
 *   Components and Server Actions, but in route handlers they silently
 *   no-op — which is what was causing the 401 / 500 errors on
 *   /api/universes after sign-in (the auth cookies were never written
 *   to the response).
 *
 *   See https://supabase.com/docs/guides/auth/server-side/nextjs for
 *   the canonical pattern.
 */
export function getSupabaseServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `set` method was called from a Server Component or a
          // read-only context (e.g. a static render). In those cases
          // the cookies cannot be mutated, but Supabase has already
          // done what it needed to — we just can't write them back.
          // Next.js will silently drop the writes here.
        }
      },
    },
  });
}

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName:
        (data.user.user_metadata?.display_name as string | undefined) ??
        (data.user.email ? data.user.email.split("@")[0] ?? null : null),
    };
  } catch {
    return null;
  }
}
