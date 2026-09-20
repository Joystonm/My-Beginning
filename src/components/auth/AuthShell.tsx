"use client";

import type { ReactNode } from "react";
import { AuthProvider, type AuthUser } from "./AuthProvider";

/**
 * Client-side AuthProvider wrapper. The server-resolved `initialUser`
 * is hydrated on first paint so we never flash "signed out" UI on a
 * page where the user is already authenticated.
 */
export function AuthShell({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  return (
    <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
  );
}
