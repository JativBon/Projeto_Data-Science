"use client";

import { useMemo, useState } from "react";

export type RamexSankeyEdge = {
  from?: string;
  to?: string;
  weight?: number;
  level?: number;
};

type SankeyLimit = 25 | 50 | 100 | "all";

type SankeyNode = {
  id: string;
  level: number;
  x: number;
  y: number;
  weight: number;
  isRoot: boolean;
};

const LIMIT_OPTIONS: Array<{ label: string; value: SankeyLimit }> = [
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "Todas", value: "all" },
];

const WIDTH = 980;
const HEIGHT = 520;
const MARGIN_X = 56;
const MARGIN_Y = 42;

function cleanEdge(edge: RamexSankeyEdge) {
  const from = String(edge.from ?? "").trim();
  const to = String(edge.to ?? "").trim();
  const weight = Number(edge.weight ?? 0);
  const level = edge.level === undefined ? undefined : Number(edge.level);
  if (!from || !to || !Number.isFinite(weight) || weight <= 0) return undefined;
  return { from, to, weight, level };
}

function selectedEdges(edges: RamexSankeyEdge[], limit: SankeyLimit) {
  const cleaned = edges.flatMap((edge) => {
    const parsed = cleanEdge(edge);
    return parsed ? [parsed] : [];
  });
  if (cleaned.length <= 50 || limit === "all") return cleaned;
  return [...cleaned].sort((a, b) => b.weight - a.weight).slice(0, limit);
}

function buildLayout(edges: ReturnType<typeof selectedEdges>, root?: string) {
  const levelByNode = new Map<string, number>();
  const weightByNode = new Map<string, number>();
  const rootId = root ? String(root) : undefined;

  if (rootId) levelByNode.set(rootId, 0);

  edges.forEach((edge) => {
    const targetLevel = Number.isFinite(edge.level) ? Math.max(1, Number(edge.level)) : undefined;
    const sourceLevel = targetLevel === undefined ? levelByNode.get(edge.from) ?? 0 : Math.max(0, targetLevel - 1);

    levelByNode.set(edge.from, Math.min(levelByNode.get(edge.from) ?? sourceLevel, sourceLevel));
    levelByNode.set(edge.to, Math.min(levelByNode.get(edge.to) ?? targetLevel ?? sourceLevel + 1, targetLevel ?? sourceLevel + 1));
    weightByNode.set(edge.from, (weightByNode.get(edge.from) ?? 0) + edge.weight);
    weightByNode.set(edge.to, (weightByNode.get(edge.to) ?? 0) + edge.weight);
  });

  const maxLevel = Math.max(1, ...Array.from(levelByNode.values()));
  const nodesByLevel = new Map<number, SankeyNode[]>();

  Array.from(levelByNode.entries()).forEach(([id, level]) => {
    const node: SankeyNode = {
      id,
      level,
      x: MARGIN_X + (level / maxLevel) * (WIDTH - MARGIN_X * 2),
      y: MARGIN_Y,
      weight: weightByNode.get(id) ?? 0,
      isRoot: id === rootId,
    };
    nodesByLevel.set(level, [...(nodesByLevel.get(level) ?? []), node]);
  });

  nodesByLevel.forEach((nodes) => {
    const ordered = nodes.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    const gap = (HEIGHT - MARGIN_Y * 2) / Math.max(ordered.length, 1);
    ordered.forEach((node, index) => {
      node.y = MARGIN_Y + gap * index + gap / 2;
    });
  });

  return new Map(Array.from(nodesByLevel.values()).flat().map((node) => [node.id, node]));
}

function linkPath(source: SankeyNode, target: SankeyNode) {
  const dx = Math.max(60, (target.x - source.x) * 0.5);
  return `M ${source.x + 8} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x - 8} ${target.y}`;
}

export function RamexSankey({
  edges,
  root,
  preservedWeight,
}: {
  edges?: RamexSankeyEdge[];
  root?: string;
  preservedWeight?: number;
}) {
  const [limit, setLimit] = useState<SankeyLimit>(50);
  const allEdges = useMemo(() => edges ?? [], [edges]);
  const isLarge = allEdges.length > 50;
  const visibleEdges = useMemo(() => selectedEdges(allEdges, isLarge ? limit : "all"), [allEdges, isLarge, limit]);
  const nodes = useMemo(() => buildLayout(visibleEdges, root), [visibleEdges, root]);
  const maxWeight = Math.max(1, ...visibleEdges.map((edge) => edge.weight));
  const totalPreservedWeight = preservedWeight && preservedWeight > 0
    ? preservedWeight
    : visibleEdges.reduce((sum, edge) => sum + edge.weight, 0);

  if (!allEdges.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-950">Sankey RAMEX 2007 — Fluxo da arborescência</h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Esta visualização complementa o grafo técnico, permitindo observar a propagação dos ramos a partir da raiz.
          </p>
        </div>
        {isLarge ? (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Top arestas
            <select
              value={String(limit)}
              onChange={(event) => setLimit(event.target.value === "all" ? "all" : Number(event.target.value) as SankeyLimit)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {isLarge ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          O Sankey é uma visualização complementar filtrada para legibilidade. A análise RAMEX completa mantém todas as arestas na tabela e no JSON.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Sankey RAMEX 2007" className="h-[32rem] min-w-[760px] w-full">
          <rect width={WIDTH} height={HEIGHT} rx="18" fill="#f8fafc" />
          {visibleEdges.map((edge, index) => {
            const source = nodes.get(edge.from);
            const target = nodes.get(edge.to);
            if (!source || !target) return null;
            const width = 2 + Math.sqrt(edge.weight / maxWeight) * 16;
            return (
              <path
                key={`${edge.from}-${edge.to}-${index}`}
                d={linkPath(source, target)}
                fill="none"
                stroke={source.isRoot ? "#c8914b" : "#315f72"}
                strokeLinecap="round"
                strokeOpacity={source.isRoot ? 0.78 : 0.46}
                strokeWidth={width}
              >
                <title>{`From: ${edge.from}\nTo: ${edge.to}\nWeight: ${edge.weight}\nLevel: ${edge.level ?? "-"}\nPeso preservado: ${totalPreservedWeight > 0 ? ((edge.weight / totalPreservedWeight) * 100).toFixed(2) : "0.00"}%`}</title>
              </path>
            );
          })}
          {Array.from(nodes.values()).map((node) => (
            <g key={node.id}>
              <circle r={node.isRoot ? 10 : 7} cx={node.x} cy={node.y} fill={node.isRoot ? "#c8914b" : "#18212f"} />
              <text
                x={node.x}
                y={node.y - 14}
                textAnchor="middle"
                fontSize="12"
                fontWeight={node.isRoot ? 700 : 600}
                fill={node.isRoot ? "#8a5a17" : "#334155"}
              >
                {node.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        A espessura das ligações é proporcional ao peso. Passe o cursor sobre uma ligação para ver From, To, Weight, Level e percentagem relativa do peso preservado.
      </p>
    </section>
  );
}
