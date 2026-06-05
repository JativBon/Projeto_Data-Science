"use client";

import { useMemo, useState } from "react";

export type RamexSankeyEdge = {
  from?: string;
  to?: string;
  weight?: number;
  level?: number;
};

type SankeyLimit = 25 | 50 | 100 | "all";

const LIMIT_OPTIONS: Array<{ label: string; value: SankeyLimit }> = [
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "Todas", value: "all" },
];

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------
type SankeyNode = {
  id: string;
  level: number;
  x: number;
  y: number;
  height: number; // altura do retângulo proporcional ao peso
  weight: number;
  isRoot: boolean;
  // posição vertical do topo do retângulo
  top: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanEdge(edge: RamexSankeyEdge) {
  const from = String(edge.from ?? "").trim();
  const to = String(edge.to ?? "").trim();
  const weight = Number(edge.weight ?? 0);
  const level = edge.level === undefined ? undefined : Number(edge.level);
  if (!from || !to || !Number.isFinite(weight) || weight <= 0) return undefined;
  return { from, to, weight, level };
}

type CleanEdge = NonNullable<ReturnType<typeof cleanEdge>>;

function selectedEdges(edges: RamexSankeyEdge[], limit: SankeyLimit): CleanEdge[] {
  const cleaned = edges.flatMap((e) => { const p = cleanEdge(e); return p ? [p] : []; });
  if (cleaned.length <= 50 || limit === "all") return cleaned;
  return [...cleaned].sort((a, b) => b.weight - a.weight).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const NODE_W = 18;           // largura do retângulo de nó
const LEVEL_GAP = 200;       // espaçamento horizontal entre níveis
const MIN_NODE_H = 18;       // altura mínima de nó
const MAX_NODE_H = 80;       // altura máxima de nó
const NODE_GAP = 10;         // espaço entre nós no mesmo nível
const PADDING_X = 80;
const PADDING_Y = 50;

function buildLayout(edges: CleanEdge[], root?: string) {
  const levelByNode = new Map<string, number>();
  const weightByNode = new Map<string, number>();
  const rootId = root ? String(root) : undefined;
  if (rootId) levelByNode.set(rootId, 0);

  edges.forEach(({ from, to, weight, level }) => {
    const targetLevel = level !== undefined && Number.isFinite(level) ? Math.max(1, level) : undefined;
    const srcLevel = targetLevel !== undefined ? Math.max(0, targetLevel - 1) : (levelByNode.get(from) ?? 0);
    levelByNode.set(from, Math.min(levelByNode.get(from) ?? srcLevel, srcLevel));
    levelByNode.set(to, Math.min(levelByNode.get(to) ?? (targetLevel ?? srcLevel + 1), targetLevel ?? srcLevel + 1));
    weightByNode.set(from, (weightByNode.get(from) ?? 0) + weight);
    weightByNode.set(to, (weightByNode.get(to) ?? 0) + weight);
  });

  const maxLevel = Math.max(0, ...levelByNode.values());
  const byLevel = new Map<number, string[]>();
  levelByNode.forEach((lvl, id) => {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  });

  const maxWeight = Math.max(1, ...weightByNode.values());

  // Calcular altura total necessária por nível
  let maxColHeight = 0;
  byLevel.forEach((ids) => {
    const totalH = ids.reduce((sum, id) => {
      const h = MIN_NODE_H + (MAX_NODE_H - MIN_NODE_H) * Math.sqrt((weightByNode.get(id) ?? 0) / maxWeight);
      return sum + h + NODE_GAP;
    }, 0);
    maxColHeight = Math.max(maxColHeight, totalH);
  });

  const canvasH = maxColHeight + PADDING_Y * 2;
  const canvasW = PADDING_X * 2 + maxLevel * LEVEL_GAP + NODE_W;

  const nodes = new Map<string, SankeyNode>();

  byLevel.forEach((ids, lvl) => {
    // Ordenar por peso desc para melhor legibilidade
    const sorted = [...ids].sort((a, b) => (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0));
    const totalH = sorted.reduce((sum, id) => {
      const h = MIN_NODE_H + (MAX_NODE_H - MIN_NODE_H) * Math.sqrt((weightByNode.get(id) ?? 0) / maxWeight);
      return sum + h + NODE_GAP;
    }, -NODE_GAP);
    let cursor = PADDING_Y + (maxColHeight - totalH) / 2;

    sorted.forEach((id) => {
      const h = Math.max(
        MIN_NODE_H,
        MIN_NODE_H + (MAX_NODE_H - MIN_NODE_H) * Math.sqrt((weightByNode.get(id) ?? 0) / maxWeight),
      );
      const x = PADDING_X + lvl * LEVEL_GAP;
      nodes.set(id, {
        id,
        level: lvl,
        x,
        y: cursor + h / 2,
        height: h,
        weight: weightByNode.get(id) ?? 0,
        isRoot: id === rootId,
        top: cursor,
      });
      cursor += h + NODE_GAP;
    });
  });

  return { nodes, canvasW, canvasH };
}

// Caminho de aresta: de borda direita do nó fonte ao borda esquerda do nó destino
function edgePath(src: SankeyNode, tgt: SankeyNode, bandWidth: number): string {
  const x1 = src.x + NODE_W;
  const y1 = src.y; // centro
  const x2 = tgt.x;
  const y2 = tgt.y;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
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
  const visible = useMemo(() => selectedEdges(allEdges, isLarge ? limit : "all"), [allEdges, isLarge, limit]);
  const { nodes, canvasW, canvasH } = useMemo(() => buildLayout(visible, root), [visible, root]);

  const maxEdgeW = useMemo(() => Math.max(1, ...visible.map((e) => e.weight)), [visible]);
  const totalW = preservedWeight && preservedWeight > 0
    ? preservedWeight
    : visible.reduce((s, e) => s + e.weight, 0);

  if (!allEdges.length) return null;

  return (
    <section className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-950">
            Sankey RAMEX 2007 — Fluxo da arborescência
          </h4>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Propagação de peso a partir da raiz. A espessura e altura de cada banda é proporcional ao peso da transição.
          </p>
        </div>
        {isLarge && (
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
            Top arestas
            <select
              value={String(limit)}
              onChange={(e) => setLimit(e.target.value === "all" ? "all" : (Number(e.target.value) as SankeyLimit))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              {LIMIT_OPTIONS.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isLarge && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900">
          Sankey filtrado para legibilidade. A análise completa mantém todas as arestas na tabela.
        </p>
      )}

      <div className="mt-4 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <svg
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          style={{ minWidth: canvasW, height: Math.max(400, canvasH) }}
          role="img"
          aria-label="Sankey RAMEX 2007"
        >
          <rect width={canvasW} height={canvasH} rx="12" fill="#f8fafc" />

          {/* Arestas como bandas */}
          {visible.map((edge, i) => {
            const src = nodes.get(edge.from);
            const tgt = nodes.get(edge.to);
            if (!src || !tgt) return null;
            const bandW = 1.5 + 10 * Math.sqrt(edge.weight / maxEdgeW);
            const pct = totalW > 0 ? ((edge.weight / totalW) * 100).toFixed(1) : "0.0";
            const isFromRoot = src.isRoot;
            return (
              <path
                key={i}
                d={edgePath(src, tgt, bandW)}
                fill="none"
                stroke={isFromRoot ? "#c8914b" : "#315f72"}
                strokeWidth={bandW}
                strokeOpacity={isFromRoot ? 0.82 : 0.48}
                strokeLinecap="round"
              >
                <title>{`${edge.from} → ${edge.to}\nPeso: ${edge.weight}\nNível: ${edge.level ?? "-"}\nPartilha: ${pct}%`}</title>
              </path>
            );
          })}

          {/* Nós como retângulos */}
          {[...nodes.values()].map((node) => {
            const isLeft = node.level === 0;
            return (
              <g key={node.id}>
                {/* Retângulo do nó */}
                <rect
                  x={node.x}
                  y={node.top}
                  width={NODE_W}
                  height={node.height}
                  rx="4"
                  fill={node.isRoot ? "#c8914b" : "#315f72"}
                  opacity={node.isRoot ? 1 : 0.75}
                >
                  <title>{`${node.id}\nPeso acumulado: ${node.weight}`}</title>
                </rect>
                {/* Label */}
                <text
                  x={isLeft ? node.x - 6 : node.x + NODE_W + 6}
                  y={node.y}
                  textAnchor={isLeft ? "end" : "start"}
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight={node.isRoot ? "700" : "600"}
                  fill={node.isRoot ? "#92400e" : "#1e293b"}
                >
                  {node.id.length > 18 ? node.id.slice(0, 17) + "…" : node.id}
                </text>
                {/* Peso */}
                <text
                  x={isLeft ? node.x - 6 : node.x + NODE_W + 6}
                  y={node.y + 14}
                  textAnchor={isLeft ? "end" : "start"}
                  dominantBaseline="central"
                  fontSize="9"
                  fill="#64748b"
                >
                  {node.weight}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Passe o cursor sobre bandas e nós para ver detalhes. Scroll horizontal se necessário.
      </p>
    </section>
  );
}
