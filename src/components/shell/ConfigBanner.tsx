import { isApiKeyConfigured } from "@/lib/cmc";

/**
 * Soft, dismissable banner that tells operators the server is missing
 * a CMC API key. We never block the UI.
 */
export function ConfigBanner() {
  if (isApiKeyConfigured()) return null;
  return (
    <div className="border-b border-line bg-canvas-sunken">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-7 py-2.5 text-xs text-ink-secondary flex items-start gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-negative mt-1.5 shrink-0" />
        <p>
          <strong className="font-medium text-ink-primary">
            Live data is offline.
          </strong>{" "}
          Add <code className="font-mono text-[0.7rem]">CMC_API_KEY</code> to{" "}
          <code className="font-mono text-[0.7rem]">.env.local</code> and restart
          the server to enable the CoinMarketCap API.
        </p>
      </div>
    </div>
  );
}