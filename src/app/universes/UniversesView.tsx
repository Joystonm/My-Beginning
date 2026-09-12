"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Eyebrow, Input, Label, Panel, PanelBody, PanelHeader, StateBlock, Textarea } from "@/components/design-system";
import {
  addAsset,
  createUniverse,
  deleteUniverse,
  isServerAuthEnabled,
  listUniverses,
  renameUniverse,
  removeAsset,
  type Universe,
} from "@/lib/universes";
import { isApiKeyConfigured } from "@/lib/cmc";
import type { CmcCryptocurrency } from "@/lib/cmc/types";

const COLORS: Universe["color"][] = ["teal", "amber", "crimson", "forest", "graphite"];

export function UniversesView() {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [universeList, setUniverseList] = useState<CmcCryptocurrency[]>([]);

  // Load universes
  useEffect(() => {
    (async () => {
      const list = await listUniverses();
      setUniverses(list);
      setLoaded(true);
    })();
  }, []);

  // Load CMC universe for asset picker (if key is configured)
  useEffect(() => {
    if (!isApiKeyConfigured()) return;
    (async () => {
      try {
        const res = await fetch("/api/cmc/listings?limit=250");
        const json = (await res.json()) as { data?: CmcCryptocurrency[]; error?: string };
        if (!res.ok) {
          setUniverseError(json.error ?? "Could not load universe.");
          return;
        }
        setUniverseList(json.data ?? []);
      } catch (err) {
        setUniverseError(err instanceof Error ? err.message : "Failed.");
      }
    })();
  }, []);

  async function refresh() {
    const list = await listUniverses();
    setUniverses(list);
    if (universe) {
      const updated = list.find((u) => u.id === universe.id);
      setUniverse(updated ?? null);
    }
  }

  return (
    <div className="py-10 sm:py-14">
      <Eyebrow>My Universes</Eyebrow>
      <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="heading-display text-3xl sm:text-4xl text-ink-primary max-w-xl">
          Organize the assets that matter to you
        </h1>
        <p className="text-sm text-ink-secondary max-w-md">
          Build collections by theme, narrative or hypothesis. Open them in
          Market Lab for side-by-side analysis.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs text-ink-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${isServerAuthEnabled() ? "bg-accent" : "bg-ink-tertiary"}`} />
          {isServerAuthEnabled() ? "Server-side storage via Supabase" : "Browser-local storage (no auth)"}
        </span>
        {!isApiKeyConfigured() && (
          <span className="text-signal-negative">CMC key missing — assets can&apos;t be added.</span>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <CreateUniversePanel onCreated={(u) => setUniverses((prev) => [u, ...prev])} />
          <div className="mt-5">
            <Panel>
              <PanelHeader
                eyebrow={`${universes.length} universe${universes.length === 1 ? "" : "s"}`}
                title="Your collections"
              />
              {loaded && universes.length === 0 && (
                <PanelBody>
                  <p className="text-sm text-ink-secondary">
                    No universes yet. Create your first one to start grouping assets.
                  </p>
                </PanelBody>
              )}
              {universes.length > 0 && (
                <ul className="divide-y divide-line-subtle">
                  {universes.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => setUniverse(u)}
                        className={`w-full text-left px-4 py-3 hover:bg-canvas-sunken transition-colors duration-180 ${universe?.id === u.id ? "bg-canvas-sunken" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full bg-${u.color === "teal" ? "accent" : u.color === "amber" ? "[#9B6B12]" : u.color === "crimson" ? "[#B8412F]" : u.color === "forest" ? "[#2F7D52]" : "[#5C5C5C]"}`} />
                          <span className="font-medium text-ink-primary truncate">{u.name}</span>
                        </div>
                        {u.description && (
                          <p className="text-xs text-ink-tertiary mt-1 line-clamp-1">{u.description}</p>
                        )}
                        <p className="text-2xs text-ink-tertiary mt-1 tnum">
                          {u.assets.length} asset{u.assets.length === 1 ? "" : "s"}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="lg:col-span-2">
          {universe ? (
            <UniverseDetail
              universe={universe}
              universeList={universeList}
              universeError={universeError}
              onChange={refresh}
            />
          ) : (
            <StateBlock
              eyebrow="No universe selected"
              title="Create or select a universe to begin"
              description="Universes group the assets you want to compare or explore. Open any of them later in Market Lab."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CreateUniversePanel({
  onCreated,
}: {
  onCreated: (u: Universe) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<Universe["color"]>("teal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createUniverse({ name, description, color });
      if (!created) {
        setError("Could not create universe.");
        return;
      }
      onCreated(created);
      setName("");
      setDescription("");
      setColor("teal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader eyebrow="New" title="Create a universe" />
      <PanelBody>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What ties these assets together?"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={`h-7 w-7 rounded-full border transition-all duration-180 ${color === c ? "border-ink-primary ring-2 ring-ink-primary/15" : "border-line"}`}
                  style={{
                    background:
                      c === "teal"
                        ? "#0F6B6B"
                        : c === "amber"
                          ? "#9B6B12"
                          : c === "crimson"
                            ? "#B8412F"
                            : c === "forest"
                              ? "#2F7D52"
                              : "#5C5C5C",
                  }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-signal-negative">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={submit} loading={busy} disabled={!name.trim()}>
              Create universe
            </Button>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function UniverseDetail({
  universe,
  universeList,
  universeError,
  onChange,
}: {
  universe: Universe;
  universeList: CmcCryptocurrency[];
  universeError: string | null;
  onChange: () => Promise<void>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const up = q.trim().toUpperCase();
    const universeIds = new Set(universe.assets.map((a) => a.cmcId));
    const filtered = universeList.filter((c) => !universeIds.has(c.id));
    if (!up) return filtered.slice(0, 8);
    return filtered
      .filter(
        (c) =>
          c.symbol.toUpperCase().startsWith(up) ||
          c.name.toUpperCase().startsWith(up),
      )
      .slice(0, 8);
  }, [q, universeList, universe.assets]);

  async function add(c: CmcCryptocurrency) {
    const updated = await addAsset(universe.id, {
      cmcId: c.id,
      symbol: c.symbol,
      name: c.name,
    });
    if (updated) await onChange();
    setQ("");
  }

  async function remove(cmcId: number) {
    const updated = await removeAsset(universe.id, cmcId);
    if (updated) await onChange();
  }

  async function rename(name: string) {
    const updated = await renameUniverse(universe.id, { name });
    if (updated) await onChange();
  }

  async function destroy() {
    if (!window.confirm(`Delete "${universe.name}"?`)) return;
    await deleteUniverse(universe.id);
    await onChange();
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow={universe.color}
        title={
          <EditableName
            initial={universe.name}
            onSave={rename}
          />
        }
        actions={
          <>
            <Link
              href={`/lab?tab=compare&symbols=${encodeURIComponent(
                universe.assets.map((a) => a.symbol).join(","),
              )}`}
              className="text-sm text-accent hover:underline"
            >
              Open in Lab →
            </Link>
            <button
              onClick={destroy}
              className="text-sm text-ink-tertiary hover:text-signal-negative"
            >
              Delete
            </button>
          </>
        }
      />
      {universe.description && (
        <p className="px-5 py-3 text-sm text-ink-secondary border-b border-line-subtle">
          {universe.description}
        </p>
      )}
      <PanelBody>
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>Assets · {universe.assets.length}</Eyebrow>
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="text-sm text-accent hover:underline"
          >
            {addOpen ? "Done" : "Add assets"}
          </button>
        </div>

        {addOpen && (
          <div className="mb-5 rounded-[6px] border border-line bg-canvas-sunken/40 p-4">
            {!isApiKeyConfigured() ? (
              <p className="text-sm text-ink-secondary">
                Add <code className="font-mono text-xs">CMC_API_KEY</code> to{" "}
                <code className="font-mono text-xs">.env.local</code> to search
                and add assets.
              </p>
            ) : universeError ? (
              <p className="text-sm text-signal-negative">{universeError}</p>
            ) : (
              <>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a cryptocurrency…"
                />
                <div className="mt-3 space-y-1.5 max-h-[280px] overflow-y-auto">
                  {matches.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => add(c)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-[4px] hover:bg-canvas text-left text-sm transition-colors duration-180"
                    >
                      <div>
                        <span className="font-medium text-ink-primary">{c.name}</span>
                        <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                          {c.symbol}
                        </span>
                      </div>
                      <span className="text-ink-tertiary text-xs">Add →</span>
                    </button>
                  ))}
                  {matches.length === 0 && (
                    <p className="text-xs text-ink-tertiary px-1 py-2">No matches.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {universe.assets.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-line p-6 text-center text-sm text-ink-tertiary">
            This universe is empty. Add some assets to compare.
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {universe.assets.map((a) => (
              <div key={a.cmcId} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink-primary">{a.name}</span>
                  <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                    {a.symbol}
                  </span>
                </div>
                <button
                  onClick={() => remove(a.cmcId)}
                  className="text-xs text-ink-tertiary hover:text-signal-negative"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function EditableName({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="hover:bg-canvas-sunken px-1.5 -mx-1.5 rounded-[3px] transition-colors duration-180"
      >
        {initial}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (value.trim() && value !== initial) onSave(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setValue(initial);
          setEditing(false);
        }
      }}
      className="bg-canvas border border-line-strong rounded-[3px] px-1.5 -mx-1.5 outline-none focus:border-accent"
    />
  );
}