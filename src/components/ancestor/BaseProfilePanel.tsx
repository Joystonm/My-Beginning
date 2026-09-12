"use client";

import { useState } from "react";
import type { CmcCryptocurrency } from "@/lib/cmc/types";
import { AssetHeader } from "./AssetHeader";
import { Panel, PanelBody, PanelHeader } from "@/components/design-system";
import { cn } from "@/lib/utils";

interface Props {
  asset: CmcCryptocurrency;
  onShare?: () => void;
  onSaveToUniverse?: () => void;
  className?: string;
}

/**
 * The base asset's profile panel — the first thing judges see after a
 * search. Combines the asset header with a 1h/24h/7d/30d change strip
 * and a Share / Save-to-Universe pair of actions.
 */
export function BaseProfilePanel({
  asset,
  onShare,
  onSaveToUniverse,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      onShare?.();
    });
  }

  return (
    <Panel className={className}>
      <PanelHeader
        eyebrow="Base asset"
        title="The asset you are exploring"
        actions={
          <div className="flex items-center gap-2">
            <ActionButton onClick={handleShare} copied={copied}>
              {copied ? "Link copied" : "Share"}
            </ActionButton>
            {onSaveToUniverse && (
              <ActionButton onClick={onSaveToUniverse}>
                Save to universe
              </ActionButton>
            )}
          </div>
        }
      />
      <PanelBody>
        <AssetHeader asset={asset} showTimeframeStrip />
      </PanelBody>
    </Panel>
  );
}

function ActionButton({
  children,
  onClick,
  copied = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  copied?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 text-xs font-medium border rounded-[4px] transition-colors duration-180",
        copied
          ? "bg-accent-soft text-accent-hover border-accent/30"
          : "bg-canvas text-ink-secondary border-line hover:text-ink-primary hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
