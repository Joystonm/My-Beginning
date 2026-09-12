/**
 * Client-safe environment checks for the CMC integration.
 * No `server-only` directive here — it's OK for client code to call these
 * to decide whether to render UI states.
 */

export function isApiKeyConfigured(): boolean {
  return Boolean(process.env.CMC_API_KEY);
}