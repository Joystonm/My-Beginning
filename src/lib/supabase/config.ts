/**
 * Server-only Supabase configuration. Never import this from client code.
 */

import "server-only";

export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}