"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GraphEdge = {
  From: string;
  To: string;
  Weight: number;
  Level?: number;
};

type Node = {
  id: string;
  x: number;
  y: number;
  level: number;
  weight: number; // soma de pesos das arestas incidentes
  isRoot: boolean;
};

type LayoutMode = "hierarchical" | "force";

// ---------------------------------------------------------------------------
// Layout hierárquico (BFS a partir da root ou nó com maior saída)
// ---------------------------------------------------------------------------
function buildHierarchicalLayout(
  edges: GraphEdge[],
  rootId: string | undefined,
  canvasW: number,
  canvasH: number,
): Map<string, Node> {
  const nodeIds = new Set<string>();
  const weightByNode = new Map<string, number>();
  edges.forEach((e) => {
    nodeIds.add(e.From);
    nodeIds.add(e.To);
    weightByNode.set(e.From, (weightByNode.get(e.From) ?? 0) + e.Weight);
    weightByNode.set(e.To, (weightByNode.get(e.To) ?? 0) + e.Weight);
  });

  // Determinar root se não fornecida
  if (!rootId) {
    const outDeg = new Map<string, number>();
    edges.forEach((e) => outDeg.set(e.From, (outDeg.get(e.From) ?? 0) + 1));
    rootId = [...outDeg.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  // BFS para atribuir níveis
  const levelByNode = new Map<string, number>();
  if (rootId && nodeIds.has(rootId)) {
    levelByNode.set(rootId, 0);
    const queue = [rootId];
    const adj = new Map<string, string[]>();
    edges.forEach((e) => {
      if (!adj.has(e.From)) adj.set(e.From, []);
      adj.get(e.From)!.push(e.To);
    });
    while (queue.length) {
      const cur = queue.shift()!;
      const curLevel = levelByNode.get(cur)!;
      (adj.get(cur) ?? []).forEach((next) => {
        if (!levelByNode.has(next)) {
          levelByNode.set(next, curLevel + 1);
          queue.push(next);
        }
      });
    }
  }

  // Nós sem nível recebem o máximo + 1
  const maxLevel = Math.max(0, ...levelByNode.values());
  nodeIds.forEach((id) => {
    if (!levelByNode.has(id)) levelByNode.set(id, maxLevel + 1);
  });

  // Agrupar por nível
  const byLevel = new Map<number, string[]>();
  levelByNode.forEach((lvl, id) => {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  });

  const totalLevels = Math.max(1, ...byLevel.keys()) + 1;
  const PADDING_X = 80;
  const PADDING_Y = 70;
  const usableH = canvasH - PADDING_Y * 2;
  const usableW = canvasW - PADDING_X * 2;

  const nodes = new Map<string, Node>();
  byLevel.forEach((ids, lvl) => {
    const y = PADDING_Y + (lvl / Math.max(totalLevels - 1, 1)) * usableH;
    ids.forEach((id, idx) => {
      const x = PADDING_X + ((idx + 0.5) / ids.length) * usableW;
      nodes.set(id, {
        id,
        x,
        y,
        level: lvl,
        weight: weightByNode.get(id) ?? 0,
        isRoot: id === rootId,
      });
    });
  });

  return nodes;
}

// ---------------------------------------------------------------------------
// Layout force-directed simples (Verlet, sem biblioteca)
// ---------------------------------------------------------------------------
function buildForceLayout(
  edges: GraphEdge[],
  rootId: string | undefined,
  canvasW: number,
  canvasH: number,
): Map<string, Node> {
  const nodeIds = new Set<string>();
  const weightByNode = new Map<string, number>();
  edges.forEach((e) => {
    nodeIds.add(e.From);
    nodeIds.add(e.To);
    weightByNode.set(e.From, (weightByNode.get(e.From) ?? 0) + e.Weight);
    weightByNode.set(e.To, (weightByNode.get(e.To) ?? 0) + e.Weight);
  });

  const ids = [...nodeIds];
  const pos: Record<string, { x: number; y: number }> = {};
  // Posições iniciais aleatórias mas determinísticas (seeded)
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length;
    const r = Math.min(canvasW, canvasH) * 0.35;
    pos[id] = { x: canvasW / 2 + r * Math.cos(angle), y: canvasH / 2 + r * Math.sin(angle) };
  });

  const edgeSet = edges.map((e) => ({ from: e.From, to: e.To, w: e.Weight }));
  const maxW = Math.max(1, ...edgeSet.map((e) => e.w));

  // Simular 80 iterações
  for (let iter = 0; iter < 80; iter++) {
    const force: Record<string, { fx: number; fy: number }> = {};
    ids.forEach((id) => { force[id] = { fx: 0, fy: 0 }; });

    // Repulsão entre todos os pares
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const dx = pos[b].x - pos[a].x;
        const dy = pos[b].y - pos[a].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const repulsion = 18000 / (dist * dist);
        force[a].fx -= repulsion * dx / dist;
        force[a].fy -= repulsion * dy / dist;
        force[b].fx += repulsion * dx / dist;
        force[b].fy += repulsion * dy / dist;
      }
    }

    // Atracção pelas arestas
    edgeSet.forEach(({ from, to, w }) => {
      const dx = pos[to].x - pos[from].x;
      const dy = pos[to].y - pos[from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 80 + 60 * (1 - w / maxW);
      const attraction = (dist - ideal) * 0.05;
      force[from].fx += attraction * dx / dist;
      force[from].fy += attraction * dy / dist;
      force[to].fx -= attraction * dx / dist;
      force[to].fy -= attraction * dy / dist;
    });

    // Aplicar forças com damping
    const alpha = 1 - iter / 80;
    ids.forEach((id) => {
      pos[id].x = Math.max(60, Math.min(canvasW - 60, pos[id].x + force[id].fx * alpha * 0.1));
      pos[id].y = Math.max(60, Math.min(canvasH - 60, pos[id].y + force[id].fy * alpha * 0.1));
    });
  }

  const nodes = new Map<string, Node>();
  ids.forEach((id) => {
    nodes.set(id, {
      id,
      x: pos[id].x,
      y: pos[id].y,
      level: 0,
      weight: weightByNode.get(id) ?? 0,
      isRoot: id === rootId,
    });
  });
  return nodes;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const CANVAS_W = 1100;
const CANVAS_H = 700;
const MAX_EDGES_FORCE = 200;

function nodeRadius(node: Node, maxWeight: number): number {
  const base = node.isRoot ? 22 : 14;
  const scale = Math.sqrt((node.weight / Math.max(maxWeight, 1)) * 0.6 + 0.4);
  return Math.round(base * scale);
}

export function RamexGraphViewer({
  edges,
  root,
  title,
  subtitle,
  highlightColor = "#c8914b",
}: {
  edges?: GraphEdge[];
  root?: string;
  title?: string;
  subtitle?: string;
  highlightColor?: string;
}) {
  const allEdges = useMemo(() => edges ?? [], [edges]);
  const [limit, setLimit] = useState(100);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("hierarchical");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visibleEdges = useMemo(() => {
    const sorted = [...allEdges].sort((a, b) => b.Weight - a.Weight);
    return sorted.slice(0, limit);
  }, [allEdges, limit]);

  const nodes = useMemo(() => {
    if (!visibleEdges.length) return new Map<string, Node>();
    const builder = layoutMode === "hierarchical" ? buildHierarchicalLayout : buildForceLayout;
    return builder(visibleEdges, root, CANVAS_W, CANVAS_H);
  }, [visibleEdges, root, layoutMode]);

  const maxWeight = useMemo(
    () => Math.max(1, ...[...nodes.values()].map((n) => n.weight)),
    [nodes],
  );
  const maxEdgeW = useMemo(() => Math.max(1, ...visibleEdges.map((e) => e.Weight)), [visibleEdges]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  // Auto-detect layout: if graph is a tree/DAG use hierarchical, else force
  useEffect(() => {
    const nodeSet = new Set<string>();
    allEdges.forEach((e) => { nodeSet.add(e.From); nodeSet.add(e.To); });
    const density = allEdges.length / Math.max(1, nodeSet.size * (nodeSet.size - 1));
    setLayoutMode(density > 0.25 || allEdges.length > MAX_EDGES_FORCE ? "force" : "hierarchical");
  }, [allEdges]);

  if (!allEdges.length) return null;

  const isTruncated = allEdges.length > limit;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/40">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          {title && <h4 className="text-base font-semibold tracking-tight text-slate-950">{title}</h4>}
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          {isTruncated && (
            <p className="mt-1 text-xs text-amber-700">
              A mostrar top {limit} de {allEdges.length} arestas por peso.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Layout toggle */}
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["hierarchical", "force"] as LayoutMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setLayoutMode(m)}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${layoutMode === m ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                {m === "hierarchical" ? "Hierárquico" : "Força"}
              </button>
            ))}
          </div>
          {/* Limit */}
          {allEdges.length > 50 && (
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700"
            >
              {[50, 100, 200, 500].map((v) => (
                <option key={v} value={v}>Top {v}</option>
              ))}
              <option value={9999}>Todas</option>
            </select>
          )}
          {/* Zoom reset */}
          <button
            type="button"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset zoom
          </button>
        </div>
      </div>

      {/* SVG canvas — relative para o tooltip poder ser absolute dentro deste bloco */}
      <div className="relative rounded-b-2xl bg-slate-50" style={{ cursor: dragging ? "grabbing" : "grab" }}>
        <div className="overflow-hidden rounded-b-2xl">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="h-[580px] w-full"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
          role="img"
          aria-label={title ?? "Grafo RAMEX"}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#315f72" opacity="0.7" />
            </marker>
            <marker id="arrow-root" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={highlightColor} opacity="0.85" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`} style={{ transformOrigin: "center" }}>
            {/* Arestas */}
            {visibleEdges.map((edge, i) => {
              const src = nodes.get(edge.From);
              const tgt = nodes.get(edge.To);
              if (!src || !tgt || src.id === tgt.id) return null;
              const r = nodeRadius(src, maxWeight);
              const rT = nodeRadius(tgt, maxWeight);
              const dx = tgt.x - src.x;
              const dy = tgt.y - src.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const x1 = src.x + (r * dx) / dist;
              const y1 = src.y + (r * dy) / dist;
              const x2 = tgt.x - ((rT + 8) * dx) / dist;
              const y2 = tgt.y - ((rT + 8) * dy) / dist;
              const strokeW = 0.8 + 4 * Math.sqrt(edge.Weight / maxEdgeW);
              const isFromRoot = src.isRoot;
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isFromRoot ? highlightColor : "#315f72"}
                  strokeWidth={strokeW}
                  strokeOpacity={isFromRoot ? 0.85 : 0.55}
                  markerEnd={isFromRoot ? "url(#arrow-root)" : "url(#arrow)"}
                  onMouseEnter={(e) => {
                    const svg = svgRef.current;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    setTooltip({
                      text: `${edge.From} → ${edge.To}  |  peso: ${edge.Weight}`,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 10,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Nós */}
            {[...nodes.values()].map((node) => {
              const r = nodeRadius(node, maxWeight);
              return (
                <g key={node.id}
                  onMouseEnter={(e) => {
                    const svg = svgRef.current;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    setTooltip({
                      text: `${node.id}  |  peso acumulado: ${node.weight}`,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 12,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "default" }}
                >
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={node.isRoot ? highlightColor : "#dceef5"}
                    stroke="#315f72"
                    strokeWidth={node.isRoot ? 2.5 : 1.5}
                  />
                  <text
                    x={node.x} y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.max(8, Math.min(13, r * 0.75))}
                    fontWeight={node.isRoot ? "800" : "600"}
                    fill={node.isRoot ? "#fff" : "#0f172a"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {node.id.length > 14 ? node.id.slice(0, 13) + "…" : node.id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        </div>{/* fim overflow-hidden */}

        {/* Tooltip — fora do overflow-hidden, dentro do relative */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-slate-200 bg-white/98 px-3 py-2 text-xs font-semibold text-slate-800 shadow-xl"
            style={{ left: Math.min(tooltip.x + 12, CANVAS_W - 220), top: Math.max(tooltip.y - 8, 4) }}
          >
            {tooltip.text}
          </div>
        )}
      </div>{/* fim relative */}

      <p className="px-5 py-2 text-xs text-slate-400">
        Scroll para zoom · Arrastar para mover · Passe o cursor em nós e arestas para detalhes
      </p>
    </div>
  );
}
