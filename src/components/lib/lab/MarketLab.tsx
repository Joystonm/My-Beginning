"use client";

import { useMemo } from "react";
import { Tabs } from "@/components/design-system";
import { OverviewTab } from "./OverviewTab";
import { CompareTab } from "./CompareTab";
import { ExplorerTab } from "./ExplorerTab";
import { EvidenceTab } from "./EvidenceTab";
import { AiTab } from "./AiTab";
import type { CmcCryptocurrency, CmcGlobalMetrics } from "@/lib/cmc/types";

interface Props {
  initialTab?: string;
  universe: CmcCryptocurrency[];
  global: CmcGlobalMetrics | null;
  globalError: string | null;
  universeError: string | null;
}

export function MarketLab({
  initialTab,
  universe,
  global,
  globalError,
  universeError,
}: Props) {
  const tabs = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        content: (
          <OverviewTab global={global} universe={universe} error={globalError} />
        ),
      },
      {
        id: "compare",
        label: "Compare",
        content: <CompareTab universe={universe} />,
      },
      {
        id: "explorer",
        label: "Data explorer",
        content: <ExplorerTab universe={universe} />,
      },
      {
        id: "evidence",
        label: "API evidence",
        content: <EvidenceTab />,
      },
      {
        id: "ai",
        label: "Ask in Lab",
        content: <AiTab />,
      },
    ],
    [global, universe, globalError],
  );

  return <Tabs tabs={tabs} defaultId={initialTab ?? "overview"} />;
}