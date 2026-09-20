"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth";

/**
 * AccountMenu — auth-aware header control.
 *
 *   - Loading: renders nothing (so we never flash a wrong control).
 *   - Signed out: renders a "Sign in" link to /login.
 *   - Signed in: renders a small avatar/initial with a dropdown menu
 *     containing the user's display name, their universes shortcut,
 *     and a Sign out action.
 *
 * The dropdown uses click-outside-to-close; Escape also closes it.
 */
export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading || !user) {
    if (loading) return null;
    return (
      <Link
        href="/login"
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.displayName ?? user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full bg-canvas-sunken text-sm font-medium text-ink-primary hover:bg-line-strong transition-colors duration-180 border border-line"
        title={user.displayName ?? user.email ?? "Account"}
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-[6px] border border-line bg-canvas shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] z-50 overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-line-subtle">
            <div className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">
              Signed in as
            </div>
            <div className="mt-1 text-sm font-medium text-ink-primary truncate">
              {user.displayName ?? user.email}
            </div>
            {user.displayName && user.email && (
              <div className="mt-0.5 text-2xs text-ink-tertiary truncate">
                {user.email}
              </div>
            )}
          </div>
          <div className="py-1">
            <Link
              href="/my-universes"
              role="menuitem"
              className="block px-3 py-1.5 text-sm text-ink-primary hover:bg-canvas-sunken"
              onClick={() => setOpen(false)}
            >
              My Universes
            </Link>
            <Link
              href="/ancestor"
              role="menuitem"
              className="block px-3 py-1.5 text-sm text-ink-primary hover:bg-canvas-sunken"
              onClick={() => setOpen(false)}
            >
              Ancestor
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full text-left px-3 py-1.5 text-sm text-signal-negative hover:bg-canvas-sunken"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
