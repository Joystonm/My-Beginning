import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server-side Supabase client bound to the current request cookies.
 * Returns null when env vars are missing (dev-safe fallback).
 */
export function getSupabaseServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // ignore — happens in some read-only contexts
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignore
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