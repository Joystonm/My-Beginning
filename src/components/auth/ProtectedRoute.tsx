"use client";

/**
 * ProtectedRoute — client-side auth gate.
 *
 * Wraps a page's content and:
 *   - Renders a stable loading skeleton while the auth state is loading.
 *   - Redirects to /login (preserving the intended destination) if the
 *     user is not authenticated.
 *
 * This is *layered* with server-side checks: the server-rendered page
 * (or its API dependencies) must also verify the session independently.
 * The client guard here is purely for UX — to avoid a flash of
 * protected content before the redirect happens.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { SkeletonPanel } from "@/components/design-system";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="py-14 sm:py-20 max-w-3xl mx-auto">
        <SkeletonPanel rows={6} />
      </div>
    );
  }

  return <>{children}</>;
}
