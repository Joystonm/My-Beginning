"use client";

import { useState } from "react";
import {
  Eyebrow,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  Textarea,
  Tabs,
} from "@/components/design-system";
import type { ParsedQuery } from "@/lib/ai/parser";
import { labelForMetric } from "@/lib/ai/parser";

export function AiTab() {
  return (
    <Tabs
      tabs={[
        { id: "ask", label: "Ask in Lab", content: <AskPanel /> },
        { id: "ancestor", label: "Explain a relationship", content: <ExplainPanel /> },
      ]}
    />
  );
}

function AskPanel() {
  const [prompt, setPrompt] = useState(
    "Show me the top 50 assets and compare their 7-day performance",
  );
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as { parsed?: ParsedQuery; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to parse prompt.");
        return;
      }
      setParsed(json.parsed ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          eyebrow="Ask in Lab"
          title="Natural-language queries → structured view"
          description="The parser is rule-based and deterministic. The AI never invents market facts — it only translates your intent into a Data Explorer configuration."
        />
        <PanelBody>
          <Label htmlFor="lab-prompt">Your query</Label>
          <Textarea
            id="lab-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Compare the top 20 assets by 30-day performance."
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-tertiary">
              Examples:{" "}
              {[
                "Top 100 by market cap, ranked",
                "Today's top gainers, percentile",
                "Compare the top 20 by 7-day performance",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="mr-2 text-ink-secondary hover:text-ink-primary underline-offset-2 hover:underline"
                >
                  {ex}
                </button>
              ))}
            </p>
            <button
              onClick={submit}
              disabled={loading || !prompt.trim()}
              className="rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 hover:bg-[#1c1c1c] disabled:opacity-50 transition-colors duration-180"
            >
              {loading ? "Parsing…" : "Parse"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-signal-negative">{error}</p>
          )}
        </PanelBody>
      </Panel>

      {parsed && (
        <Panel>
          <PanelHeader
            eyebrow="Structured query"
            title="What your query became"
            description="Send these values into the Data Explorer and the visualization will follow."
          />
          <PanelBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[6px] overflow-hidden">
              <Cell label="Dataset">
                {parsed.dataset === "top"
                  ? "Top by market cap"
                  : parsed.dataset === "gainers"
                    ? "Top 24h gainers"
                    : "Top 24h losers"}
              </Cell>
              <Cell label="Top N">{parsed.top}</Cell>
              <Cell label="Metric">{labelForMetric(parsed.metric)}</Cell>
              <Cell label="Calculation">
                {parsed.calculation === "raw"
                  ? "Raw value"
                  : parsed.calculation === "rank"
                    ? "Rank in universe"
                    : "Percentile"}
              </Cell>
            </div>
            <p className="mt-4 text-sm text-ink-secondary">{parsed.description}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ink-tertiary">
              <span className="heading-eyebrow">Matched rules</span>
              {parsed.matchedRules.length === 0 ? (
                <span>(defaults applied)</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.matchedRules.map((r) => (
                    <span
                      key={r}
                      className="font-mono px-1.5 py-0.5 bg-canvas-sunken rounded-[3px]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-canvas p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="text-sm mt-1.5">{children}</div>
    </div>
  );
}

function ExplainPanel() {
  const [base, setBase] = useState("SOL");
  const [related, setRelated] = useState("ETH");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [source, setSource] = useState<"deterministic" | "anthropic" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"fast" | "refine">("fast");

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // Pull lineage from the server via /api/ancestor.
      const r = await fetch("/api/ancestor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: base, limit: 250 }),
      });
      const json = (await r.json()) as Record<string, unknown> & {
        ancestors?: Array<{
          symbol: string;
          name: string;
          relation: string;
          confidence: number;
          notes: string;
          source: "curated" | "tavily";
        }>;
        error?: string;
      };
      if (!r.ok || !json.ancestors) {
        setError(json.error ?? "Could not load ancestor calculation.");
        return;
      }
      const match = json.ancestors.find(
        (a) => a.symbol.toUpperCase() === related.toUpperCase(),
      );
      if (!match) {
        setError(
          `${related} is not in ${base}'s lineage. Try one of: ${json.ancestors
            .map((a) => a.symbol)
            .slice(0, 6)
            .join(", ")}.`,
        );
        return;
      }
      const explainRes = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseName: base,
          node: match,
          mode,
        }),
      });
      const explainJson = (await explainRes.json()) as {
        narrative?: string;
        source?: "deterministic" | "anthropic";
        error?: string;
      };
      if (!explainRes.ok) {
        setError(explainJson.error ?? "Explanation failed.");
        return;
      }
      setNarrative(explainJson.narrative ?? null);
      setSource(explainJson.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="Lineage explainer"
        title="Turn a lineage edge into a sentence"
        description="Uses the pre-calculated ancestor node from the lineage engine — never raw CMC data. Optional Anthropic refinement available when ANTHROPIC_API_KEY is configured."
      />
      <PanelBody>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Base asset</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value.toUpperCase())} placeholder="e.g. SOL" />
          </div>
          <div>
            <Label>Related asset</Label>
            <Input value={related} onChange={(e) => setRelated(e.target.value.toUpperCase())} placeholder="e.g. AVAX" />
          </div>
          <div>
            <Label>Mode</Label>
            <div className="flex h-10 items-center rounded-[4px] border border-line-strong overflow-hidden">
              {(["fast", "refine"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 h-full text-sm transition-colors duration-180 ${mode === m ? "bg-ink-primary text-ink-inverse" : "bg-canvas text-ink-secondary hover:bg-canvas-sunken"}`}
                >
                  {m === "fast" ? "Deterministic" : "AI refine"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={generate}
            disabled={loading || !base || !related}
            className="rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 hover:bg-[#1c1c1c] disabled:opacity-50 transition-colors duration-180"
          >
            {loading ? "Generating…" : "Explain"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-signal-negative">{error}</p>}

        {narrative && (
          <div className="mt-5 rounded-[6px] border border-line bg-canvas-sunken/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Explanation</Eyebrow>
              <span className="text-2xs uppercase tracking-[0.12em] text-ink-tertiary">
                {source === "anthropic" ? "AI refined" : "Deterministic"}
              </span>
            </div>
            <p className="text-md text-ink-primary leading-relaxed">{narrative}</p>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}