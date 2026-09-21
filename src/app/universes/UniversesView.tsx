"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Eyebrow,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonPanel,
  StateBlock,
  Textarea,
} from "@/components/design-system";
import {
  addAsset,
  createUniverse,
  deleteUniverse,
  isServerAuthEnabled,
  listUniverses,
  removeAsset,
  renameUniverse,
  reorderAssets,
  setUniverseVisibility,
  type Universe,
} from "@/lib/universes";
import type { CmcCryptocurrency } from "@/lib/cmc/types";

const COLORS: Universe["color"][] = ["teal", "amber", "crimson", "forest", "graphite"];

const COLOR_HEX: Record<Universe["color"], string> = {
  teal: "#0F6B6B",
  amber: "#9B6B12",
  crimson: "#B8412F",
  forest: "#2F7D52",
  graphite: "#5C5C5C",
};

/** "just now", "5m", "3h", "yesterday", "4d", "Sep 12". */
function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < 30_000) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Force a re-render every 30s so relative timestamps stay fresh. */
function useNowTicker(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function UniversesView({ cmcConfigured }: { cmcConfigured: boolean }) {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [universeList, setUniverseList] = useState<CmcCryptocurrency[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Universe | null>(null);
  const now = useNowTicker();

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
    if (!cmcConfigured) return;
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
  }, [cmcConfigured]);

  async function refresh() {
    const list = await listUniverses();
    setUniverses(list);
    if (universe) {
      const updated = list.find((u) => u.id === universe.id);
      setUniverse(updated ?? null);
    }
  }

  async function confirmDeleteNow() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    if (universe?.id === target.id) setUniverse(null);
    await deleteUniverse(target.id);
    await refresh();
  }

  const isEmpty = loaded && universes.length === 0;

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
          <span
            className={`h-1.5 w-1.5 rounded-full ${isServerAuthEnabled() ? "bg-accent" : "bg-ink-tertiary"}`}
          />
          {isServerAuthEnabled()
            ? "Server-side storage via Supabase"
            : "Browser-local storage (no auth)"}
        </span>
        {!cmcConfigured && (
          <span className="text-signal-negative">
            CMC key missing — assets can&apos;t be added.
          </span>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-5">
          <CreateUniversePanel
            prefillName={isEmpty ? "My first universe" : undefined}
            onCreated={(u) => setUniverses((prev) => [u, ...prev])}
          />
          <Panel>
            <PanelHeader
              eyebrow={`${universes.length} universe${universes.length === 1 ? "" : "s"}`}
              title="Your collections"
            />
            {!loaded ? (
              <PanelBody>
                <SkeletonPanel rows={3} />
              </PanelBody>
            ) : isEmpty ? (
              <PanelBody>
                <p className="text-sm text-ink-secondary">
                  No universes yet. Create your first one above to start
                  grouping assets.
                </p>
              </PanelBody>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {universes.map((u) => (
                  <UniverseCard
                    key={u.id}
                    universe={u}
                    selected={universe?.id === u.id}
                    now={now}
                    onSelect={() => setUniverse(u)}
                    onDelete={() => setConfirmDelete(u)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          {universe ? (
            <UniverseDetail
              universe={universe}
              universeList={universeList}
              universeError={universeError}
              cmcConfigured={cmcConfigured}
              onChange={refresh}
              onRequestDelete={() => setConfirmDelete(universe)}
              now={now}
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

      {confirmDelete && (
        <ConfirmDialog
          eyebrow="Delete universe"
          title={`Delete "${confirmDelete.name}"?`}
          description="This removes the universe and its asset associations. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDeleteNow}
        />
      )}
    </div>
  );
}

function UniverseCard({
  universe,
  selected,
  now,
  onSelect,
  onDelete,
}: {
  universe: Universe;
  selected: boolean;
  now: number;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const hex = COLOR_HEX[universe.color];
  const symbolsHref = `/lab?tab=compare&symbols=${encodeURIComponent(
    universe.assets.map((a) => a.symbol).join(","),
  )}`;
  return (
    <li>
      <div
        className={`relative group transition-colors duration-180 ${selected ? "bg-canvas-sunken" : "hover:bg-canvas-sunken/60"}`}
      >
        {/* Color stripe on the left edge */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: hex }}
        />
        <button
          onClick={onSelect}
          className="w-full text-left pl-5 pr-3 py-3 transition-colors duration-180"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-ink-primary truncate">
              {universe.name}
            </span>
            {universe.isPublic && (
              <Badge tone="accent" className="!text-[9px] !h-[16px] !px-1.5">
                Public
              </Badge>
            )}
          </div>
          {universe.description && (
            <p className="text-xs text-ink-tertiary mt-1 line-clamp-1">
              {universe.description}
            </p>
          )}
          <p className="text-2xs text-ink-tertiary mt-1.5 tnum flex items-center gap-2">
            <span>
              {universe.assets.length} asset{universe.assets.length === 1 ? "" : "s"}
            </span>
            <span className="text-ink-muted" aria-hidden>·</span>
            <span>{formatRelativeTime(universe.updatedAt, now)}</span>
          </p>
        </button>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-180">
          {universe.assets.length > 0 && (
            <Link
              href={symbolsHref}
              className="text-2xs uppercase tracking-[0.08em] text-accent hover:underline px-2 py-1 rounded-[3px] hover:bg-canvas"
              onClick={(e) => e.stopPropagation()}
            >
              Lab →
            </Link>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-2xs uppercase tracking-[0.08em] text-ink-tertiary hover:text-signal-negative px-2 py-1 rounded-[3px] hover:bg-canvas"
            aria-label={`Delete ${universe.name}`}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function CreateUniversePanel({
  prefillName,
  onCreated,
}: {
  prefillName?: string;
  onCreated: (u: Universe) => void;
}) {
  const [name, setName] = useState(prefillName ?? "");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<Universe["color"]>("teal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync if prefillName arrives after mount (first empty-state render).
  useEffect(() => {
    if (prefillName && !name) setName(prefillName);
  }, [prefillName, name]);

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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI tokens"
            />
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
                  aria-pressed={color === c}
                  className={`h-7 w-7 rounded-full border transition-all duration-180 ${color === c ? "border-ink-primary ring-2 ring-ink-primary/15 scale-110" : "border-line hover:scale-105"}`}
                  style={{ background: COLOR_HEX[c] }}
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
  cmcConfigured,
  onChange,
  onRequestDelete,
  now,
}: {
  universe: Universe;
  universeList: CmcCryptocurrency[];
  universeError: string | null;
  cmcConfigured: boolean;
  onChange: () => Promise<void>;
  onRequestDelete: () => void;
  now: number;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingCmcId, setDraggingCmcId] = useState<number | null>(null);
  const [dragOverCmcId, setDragOverCmcId] = useState<number | null>(null);
  const dragCounter = useRef(0);

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

  async function toggleVisibility() {
    const updated = await setUniverseVisibility(universe.id, !universe.isPublic);
    if (updated) await onChange();
  }

  async function commitReorder(newOrder: number[]) {
    setBusy(true);
    try {
      const updated = await reorderAssets(universe.id, newOrder);
      if (updated) await onChange();
    } finally {
      setBusy(false);
    }
  }

  function handleDragStart(e: React.DragEvent, cmcId: number) {
    setDraggingCmcId(cmcId);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers require data to be set for the drag to start.
    e.dataTransfer.setData("text/plain", String(cmcId));
  }

  function handleDragOver(e: React.DragEvent, cmcId: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (cmcId !== dragOverCmcId) setDragOverCmcId(cmcId);
  }

  function handleDragLeave() {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOverCmcId(null);
    }
  }

  function handleDragEnter() {
    dragCounter.current += 1;
  }

  async function handleDrop(e: React.DragEvent, targetCmcId: number) {
    e.preventDefault();
    const sourceCmcIdStr = e.dataTransfer.getData("text/plain");
    const sourceCmcId = Number(sourceCmcIdStr);
    dragCounter.current = 0;
    setDraggingCmcId(null);
    setDragOverCmcId(null);
    if (!Number.isFinite(sourceCmcId) || sourceCmcId === targetCmcId) return;

    const order = universe.assets.map((a) => a.cmcId);
    const fromIdx = order.indexOf(sourceCmcId);
    const toIdx = order.indexOf(targetCmcId);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceCmcId);
    await commitReorder(order);
  }

  function handleDragEnd() {
    dragCounter.current = 0;
    setDraggingCmcId(null);
    setDragOverCmcId(null);
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: COLOR_HEX[universe.color] }}
            />
            <span className="capitalize">{universe.color}</span>
          </span>
        }
        title={
          <EditableName initial={universe.name} onSave={rename} />
        }
        description={
          <span>
            {formatRelativeTime(universe.updatedAt, now)} ·{" "}
            <span className="tnum">{universe.assets.length}</span> assets
          </span>
        }
        actions={
          <>
            <button
              onClick={toggleVisibility}
              className="text-xs transition-colors duration-180"
              aria-label={`Make universe ${universe.isPublic ? "private" : "public"}`}
            >
              <Badge tone={universe.isPublic ? "accent" : "muted"}>
                {universe.isPublic ? "Public" : "Private"}
              </Badge>
            </button>
            {universe.assets.length > 0 && (
              <Link
                href={`/lab?tab=compare&symbols=${encodeURIComponent(
                  universe.assets.map((a) => a.symbol).join(","),
                )}`}
                className="text-sm text-accent hover:underline"
              >
                Open in Lab →
              </Link>
            )}
            <button
              onClick={onRequestDelete}
              className="text-sm text-ink-tertiary hover:text-signal-negative transition-colors duration-180"
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
          <Eyebrow>
            <span className="inline-flex items-center gap-2">
              Assets
              <span
                key={universe.assets.length}
                className="inline-block tnum text-ink-primary transition-all duration-slow"
              >
                · {universe.assets.length}
              </span>
            </span>
          </Eyebrow>
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="text-sm text-accent hover:underline transition-colors duration-180"
          >
            {addOpen ? "Done" : "Add assets"}
          </button>
        </div>

        {addOpen && (
          <div className="mb-5 rounded-[6px] border border-line bg-canvas-sunken/40 p-4">
            {!cmcConfigured ? (
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
          <div
            className={`divide-y divide-line-subtle rounded-[6px] border border-line-subtle overflow-hidden transition-opacity duration-180 ${busy ? "opacity-70" : ""}`}
          >
            {universe.assets.map((a) => {
              const isDragging = draggingCmcId === a.cmcId;
              const isDragOver = dragOverCmcId === a.cmcId && draggingCmcId !== a.cmcId;
              return (
                <div
                  key={a.cmcId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, a.cmcId)}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={(e) => handleDragOver(e, a.cmcId)}
                  onDrop={(e) => handleDrop(e, a.cmcId)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-2 px-2.5 py-2.5 text-sm bg-canvas cursor-grab active:cursor-grabbing transition-all duration-180 ${
                    isDragging ? "opacity-40" : ""
                  } ${isDragOver ? "border-t-2 border-t-accent" : "border-t-2 border-t-transparent"}`}
                >
                  <span
                    aria-hidden
                    className="text-ink-muted select-none px-1 text-xs leading-none"
                  >
                    ⋮⋮
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-ink-primary">{a.name}</span>
                    <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-tertiary">
                      {a.symbol}
                    </span>
                  </div>
                  <button
                    onClick={() => remove(a.cmcId)}
                    className="text-xs text-ink-tertiary hover:text-signal-negative opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-180"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
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

function ConfirmDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onCancel,
  onConfirm,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  // Esc to cancel, Enter to confirm.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void onConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-canvas-inverted/40 backdrop-blur-[2px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <Panel className="shadow-lg">
          <PanelHeader eyebrow={eyebrow} title={title} />
          {description && (
            <PanelBody>
              <p className="text-sm text-ink-secondary leading-relaxed">
                {description}
              </p>
            </PanelBody>
          )}
          <div className="px-5 pb-4 pt-1 flex items-center justify-end gap-2 border-t border-line-subtle">
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
