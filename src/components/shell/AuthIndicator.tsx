"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export function AuthIndicator() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const json = (await res.json()) as { user?: SessionUser | null };
        if (cancelled) return;
        setUser(json.user ?? null);
      } catch {
        if (cancelled) return;
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  if (user === undefined) return null; // loading — don't flash controls
  if (!user) {
    return (
      <Link
        href="/auth/sign-in"
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-tertiary hidden sm:inline">
        {user.displayName ?? user.email ?? "Signed in"}
      </span>
      <button
        onClick={logout}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        Sign out
      </button>
    </div>
  );
}