"use client";

import { useEffect, useState } from "react";
import type { CmcCallRecord } from "@/lib/cmc/types";
import { Badge, Panel, PanelBody, PanelHeader } from "@/components/design-system";
import { timeAgo } from "@/lib/utils";
import { SeedNotice } from "./SeedNotice";

interface EvidenceResponse {
  data: CmcCallRecord[];
  source: "live" | "seed";
  apiKeyConfigured: boolean;
  seed: {
    source: "seed";
    message: string;
    count: number;
    handCurated: number;
  };
}

export function EvidenceTab() {
  const [records, setRecords] = useState<CmcCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "seed" | null>(null);
  const [seed, setSeed] = useState<EvidenceResponse["seed"] | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cmc/evidence");
        const json = (await res.json()) as Partial<EvidenceResponse>;
        if (cancelled) return;
        setRecords(json.data ?? []);
        setSource(json.source ?? null);
        setSeed(json.seed ?? null);
        setApiKeyConfigured(Boolean(json.apiKeyConfigured));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const okCount = records.filter((r) => r.errorCode === 0).length;
  const totalCredits = records.reduce((s, r) => s + (r.creditCount ?? 0), 0);

  return (
    <div className="space-y-5">
      {source && (
        <SeedNotice source={source} seed={seed} />
      )}

      <Panel>
        <PanelHeader
          eyebrow="API evidence"
          title="Every CoinMarketCap call, visible"
          description="A sanitized log of recent CMC requests made by this server. Endpoint, parameters, timing, credit cost and a tier-safe sample — never the API key."
          actions={
            apiKeyConfigured ? null : (
              <Badge tone="muted" dot>
                No API key · serving seed
              </Badge>
            )
          }
        />
        <PanelBody>
          <div className="grid grid-cols-3 gap-px bg-line border border-line rounded-[6px] overflow-hidden">
            <Stat label="Calls" value={records.length.toString()} />
            <Stat label="Successful" value={okCount.toString()} />
            <Stat
              label="Total credits"
              value={totalCredits.toLocaleString()}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Recent calls"
          title="Call log"
          description="Newest first. Sample data is truncated; never contains secrets."
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 text-sm text-ink-tertiary">Loading…</div>
          ) : records.length === 0 ? (
            <div className="p-5 text-sm text-ink-tertiary">
              No calls yet. Interact with the app to generate API traffic.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-ink-secondary">
                  <th className="text-left font-medium px-3 py-2.5">Endpoint</th>
                  <th className="text-left font-medium px-3 py-2.5">When</th>
                  <th className="text-right font-medium px-3 py-2.5">Duration</th>
                  <th className="text-right font-medium px-3 py-2.5">Credits</th>
                  <th className="text-right font-medium px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {records.map((r, i) => (
                  <RecordRow key={i} record={r} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas p-4">
      <div className="heading-eyebrow">{label}</div>
      <div className="text-lg tnum mt-1.5 tracking-tight">{value}</div>
    </div>
  );
}

function RecordRow({ record }: { record: CmcCallRecord }) {
  const isError = record.errorCode !== 0;
  const paramKeys = Object.keys(record.params);
  return (
    <tr>
      <td className="px-3 py-2.5 align-top">
        <div className="font-mono text-xs text-ink-primary truncate max-w-[280px]">
          {record.endpoint}
        </div>
        {paramKeys.length > 0 && (
          <div className="text-2xs text-ink-tertiary mt-1 font-mono truncate max-w-[280px]">
            {paramKeys
              .slice(0, 3)
              .map((k) => `${k}=${String(record.params[k]).slice(0, 24)}`)
              .join("  ")}
            {paramKeys.length > 3 && ` · +${paramKeys.length - 3} more`}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-ink-secondary tnum whitespace-nowrap">
        {timeAgo(record.requestedAt)}
      </td>
      <td className="px-3 py-2.5 text-right tnum text-ink-primary">
        {record.durationMs}ms
      </td>
      <td className="px-3 py-2.5 text-right tnum text-ink-primary">
        {record.creditCount ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        {isError ? (
          <Badge tone="negative">err {record.errorCode}</Badge>
        ) : (
          <Badge tone="positive" dot>
            ok
          </Badge>
        )}
      </td>
    </tr>
  );
}
