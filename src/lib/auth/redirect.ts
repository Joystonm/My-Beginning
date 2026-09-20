/**
 * Post-login redirect sanitization.
 *
 * Shared between the client-side /login view and server-side guards
 * to keep the rules in lockstep. We accept only same-origin absolute
 * paths (starting with a single `/`) and reject protocol-relative,
 * external, and javascript: URLs to prevent open-redirect attacks.
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return "/ancestor";
  if (!raw.startsWith("/")) return "/ancestor";
  if (raw.startsWith("//")) return "/ancestor";
  // Block scheme-like prefixes that could be interpreted by browsers.
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return "/ancestor";
  return raw;
}
