"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { AncestorEdge, AncestorNode } from "@/lib/ancestor/types";
import { shortRelationLabel } from "@/lib/ancestor/types";

interface LineageGraphProps {
  baseSymbol: string;
  baseName: string;
  ancestors: AncestorNode[];
  edges: AncestorEdge[];
  onSelectAncestor?: (index: number) => void;
  selectedIndex?: number | null;
  className?: string;
}

/**
 * Vertical lineage tree — the visual centerpiece of /ancestor.
 *
 * Top: base asset
 * Each step down: an ancestor, connected by an edge annotated with
 * the relation type and confidence. Walks the chain in order so
 * users see BTC at the bottom for most altcoins.
 *
 * Hand-laid-out, no physics. The graph is intentionally a chain
 * rather than a network because lineage is directional.
 */
export function LineageGraph({
  baseSymbol,
  baseName,
  ancestors,
  edges,
  onSelectAncestor,
  selectedIndex = null,
  className,
}: LineageGraphProps) {
  const dims = useMemo(
    () => dimensionsFor(ancestors.length),
    [ancestors.length],
  );

  // Each ancestor node sits at a fixed y slot.
  // Y values: base at top, then ancestors stacked vertically below.
  const rowHeight = dims.rowHeight;
  const totalHeight = (ancestors.length + 1) * rowHeight + 80;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${dims.width} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label={`Lineage chain for ${baseSymbol}`}
      >
        <defs>
          <marker
            id="lineage-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#CFCCC3" />
          </marker>
          <marker
            id="lineage-arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#0F6B6B" />
          </marker>
        </defs>

        {/* Vertical line from base to last ancestor */}
        <line
          x1={dims.width / 2}
          y1={dims.baseY + 56}
          x2={dims.width / 2}
          y2={dims.baseY + (ancestors.length) * rowHeight + 24}
          stroke="#E5E2DA"
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />

        {/* Edges — one per ancestor, with relation label */}
        {edges.map((edge, i) => {
          const isActive = selectedIndex === i;
          const y = dims.baseY + (i + 1) * rowHeight;
          const edgeY = y - 36; // label sits above the node
          return (
            <g key={`edge-${i}`}>
              {/* Arrow from parent above to current ancestor */}
              <path
                d={`M ${dims.width / 2} ${y - 48} L ${dims.width / 2} ${y - 32}`}
                stroke={isActive ? "#0F6B6B" : "#CFCCC3"}
                strokeWidth={isActive ? 2 : 1.5}
                markerEnd={isActive ? "url(#lineage-arrow-active)" : "url(#lineage-arrow)"}
                fill="none"
                className="transition-all duration-slow ease-editorial"
              />
              {/* Relation label, floating to the right of the line */}
              <g transform={`translate(${dims.width / 2 + 16}, ${edgeY})`}>
                <text
                  x={0}
                  y={0}
                  fill={isActive ? "#0F6B6B" : "#5C8A88"}
                  fontSize={11}
                  fontWeight={500}
                  letterSpacing="0.02em"
                >
                  {shortRelationLabel(edge.relation)}
                </text>
                <text
                  x={0}
                  y={14}
                  fill="#8A8A85"
                  fontSize={10}
                  letterSpacing="0.02em"
                >
                  {Math.round(edge.confidence * 100)}% confidence
                </text>
              </g>
            </g>
          );
        })}

        {/* Base node */}
        <g transform={`translate(${dims.width / 2 - 80}, ${dims.baseY - 24})`}>
          <rect
            width={160}
            height={56}
            rx={5}
            fill="#0E0E0E"
          />
          <text
            x={80}
            y={24}
            textAnchor="middle"
            fill="#FAF8F4"
            fontSize={16}
            fontWeight={600}
            letterSpacing="-0.01em"
          >
            {baseSymbol}
          </text>
          <text
            x={80}
            y={42}
            textAnchor="middle"
            fill="#B4B4AE"
            fontSize={11}
            letterSpacing="0.04em"
          >
            {truncate(baseName, 22)}
          </text>
        </g>

        {/* Ancestor nodes */}
        {ancestors.map((a, i) => {
          const y = dims.baseY + (i + 1) * rowHeight;
          const isSelected = selectedIndex === i;
          const nodeWidth = 180;
          const nodeHeight = 64;
          return (
            <g
              key={`ancestor-${i}`}
              transform={`translate(${dims.width / 2 - nodeWidth / 2}, ${y - nodeHeight / 2})`}
              className={cn(
                "lineage-node transition-transform duration-slow ease-editorial",
                onSelectAncestor && "cursor-pointer",
              )}
              onClick={() => onSelectAncestor?.(i)}
            >
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx={5}
                fill={isSelected ? "#FAF8F4" : "#FFFFFF"}
                stroke={isSelected ? "#0F6B6B" : "#CFCCC3"}
                strokeWidth={isSelected ? 1.5 : 1}
                className="transition-all duration-slow ease-editorial"
              />
              {/* Symbol */}
              <text
                x={nodeWidth / 2}
                y={22}
                textAnchor="middle"
                fill="#0E0E0E"
                fontSize={15}
                fontWeight={600}
                letterSpacing="-0.01em"
              >
                {a.symbol}
              </text>
              {/* Name */}
              <text
                x={nodeWidth / 2}
                y={40}
                textAnchor="middle"
                fill="#5C5C58"
                fontSize={11}
                letterSpacing="0.02em"
              >
                {truncate(a.name, 24)}
              </text>
              {/* Source / rank sub-label */}
              <text
                x={nodeWidth / 2}
                y={56}
                textAnchor="middle"
                fill="#8A8A85"
                fontSize={10}
                letterSpacing="0.02em"
              >
                {a.cmc_rank ? `CMC #${a.cmc_rank} · ${a.source}` : a.source}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-2xs text-ink-secondary">
        <LegendDot label="Base asset" fill="#0E0E0E" />
        <LegendDot label="Ancestor" stroke="#CFCCC3" />
        <LegendDot label="Selected" stroke="#0F6B6B" />
        <span className="text-ink-tertiary">
          Each edge is labeled with the relation type (fork, platform, wrapped, inspiration)
          and the confidence the engine places in the lineage claim.
        </span>
      </div>
    </div>
  );
}

function dimensionsFor(ancestorCount: number) {
  // Width adapts to content; height grows with depth.
  return {
    width: Math.max(560, 320),
    rowHeight: 124,
    baseY: 24,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function LegendDot({
  label,
  fill,
  stroke,
}: {
  label: string;
  fill?: string;
  stroke?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-3.5 rounded-[2px]"
        style={{
          background: fill ?? "transparent",
          border: stroke ? `1px solid ${stroke}` : "1px solid #CFCCC3",
        }}
      />
      {label}
    </span>
  );
}
