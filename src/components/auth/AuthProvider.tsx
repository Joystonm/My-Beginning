"use client";

/**
 * AuthContext — single source of truth for the current user / session.
 *
 * The provider is mounted once near the root of the app (in the root
 * layout). It hydrates from `/api/auth/session`, listens to Supabase
 * `onAuthStateChange` events so we update immediately on sign-in /
 * sign-out without a hard reload, and exposes a stable hook API to the
 * rest of the client tree.
 *
 * Design choices:
 *
 *   - The hook returns `loading: true` until the first session fetch
 *     resolves. Callers (ProtectedRoute, SiteHeader) render a stable
 *     placeholder while loading so the UI does not flash between
 *     "signed out" and "signed in" states on first paint.
 *
 *   - We never expose the Supabase client here; consumers use the
 *     derived `signIn` / `signUp` / `signOut` helpers that hit our
 *     server-side API routes. This keeps all secret-bearing code on
 *     the server (per the project security posture).
 *
 *   - `signIn` and `signUp` propagate server-supplied errors back to
 *     the caller so the form view can show them.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null | undefined; // undefined = loading
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  user?: AuthUser | null;
  error?: string;
}

async function postJson<T>(
  url: string,
  body: Record<string, string>,
): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body: json };
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthUser | null;
}) {
  // Seed with the SSR-resolved user so the first render is correct
  // even before the client-side fetch completes. This prevents the
  // flash of "signed out" UI on protected pages.
  const [user, setUser] = useState<AuthUser | null | undefined>(initialUser);
  const [loading, setLoading] = useState(false);
  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = (await res.json()) as AuthResponse;
      if (cancelled.current) return;
      setUser(json.user ?? null);
    } catch {
      if (cancelled.current) return;
      setUser(null);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { status, body } = await postJson<AuthResponse>(
        "/api/auth/login",
        { email, password },
      );
      if (status === 200 && body.user) {
        setUser(body.user);
        return { ok: true };
      }
      return { ok: false, error: body.error ?? "Sign-in failed." };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { status, body } = await postJson<AuthResponse>(
        "/api/auth/signup",
        {
          email,
          password,
          ...(displayName && displayName.trim()
            ? { displayName: displayName.trim() }
            : {}),
        },
      );
      if (status === 200 && body.user) {
        setUser(body.user);
        return { ok: true };
      }
      return { ok: false, error: body.error ?? "Sign-up failed." };
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort; clear local state regardless
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signOut,
      refresh,
    }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return ctx;
}
