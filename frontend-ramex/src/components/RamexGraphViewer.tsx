"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";

export type GraphType = "observed" | "filtered" | "ramex2007" | "forward" | "polytree" | "experimental";

export type GraphEdge = {
  From: string;
  To: string;
  Weight: number;
  Level?: number;
};

export type GraphValidationMetrics = {
  is_dag?: boolean;
  is_valid_rooted_branching?: boolean;
  is_valid_arborescence?: boolean;
  is_arborescence?: boolean;
  is_valid_forward_tree?: boolean;
  is_valid_polytree?: boolean;
  is_polytree?: boolean;
  edges?: number;
  nodes?: number;
  expected_edges?: number;
};

type Node = {
  id: string;
  x: number;
  y: number;
  level: number;
  weight: number;
  isRoot: boolean;
  isConvergence: boolean;
};

type LayoutMode = "hierarchical" | "force";

type GraphIndex = {
  nodeIds: Set<string>;
  weightByNode: Map<string, number>;
  outgoingWeight: Map<string, number>;
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
  directedAdj: Map<string, string[]>;
  undirectedAdj: Map<string, string[]>;
};

type ValidationStats = {
  isDag: boolean;
  edgesEqualNodesMinusOne: boolean;
  isArborescence: boolean;
  isPolytree: boolean;
  maxInDegree: number;
  visualRoot?: string;
};

const CANVAS_W = 1100;
const CANVAS_H = 700;
const MAX_EDGES_FORCE = 200;

function isStructuralGraph(graphType: GraphType) {
  return graphType === "ramex2007" || graphType === "forward" || graphType === "polytree";
}

function graphLegend(graphType: GraphType) {
  if (graphType === "ramex2007") return "Arborescência dirigida — estrutura RAMEX formal.";
  if (graphType === "forward") return "Estrutura dirigida selecionada pela Forward Heuristic.";
  if (graphType === "polytree") return "DAG cuja versão não dirigida é uma árvore.";
  if (graphType === "filtered") return "Rede observada filtrada — visualização exploratória.";
  if (graphType === "experimental") return "Visualização experimental — não apresentar como resultado formal.";
  return "Rede completa de transições — pode conter ciclos.";
}

function buildGraphIndex(edges: GraphEdge[]): GraphIndex {
  const nodeIds = new Set<string>();
  const weightByNode = new Map<string, number>();
  const outgoingWeight = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const directedAdj = new Map<string, string[]>();
  const undirectedAdj = new Map<string, string[]>();

  for (const edge of edges) {
    nodeIds.add(edge.From);
    nodeIds.add(edge.To);
    weightByNode.set(edge.From, (weightByNode.get(edge.From) ?? 0) + edge.Weight);
    weightByNode.set(edge.To, (weightByNode.get(edge.To) ?? 0) + edge.Weight);
    outgoingWeight.set(edge.From, (outgoingWeight.get(edge.From) ?? 0) + edge.Weight);
    inDegree.set(edge.To, (inDegree.get(edge.To) ?? 0) + 1);
    outDegree.set(edge.From, (outDegree.get(edge.From) ?? 0) + 1);

    if (!directedAdj.has(edge.From)) directedAdj.set(edge.From, []);
    directedAdj.get(edge.From)!.push(edge.To);

    if (!undirectedAdj.has(edge.From)) undirectedAdj.set(edge.From, []);
    if (!undirectedAdj.has(edge.To)) undirectedAdj.set(edge.To, []);
    undirectedAdj.get(edge.From)!.push(edge.To);
    undirectedAdj.get(edge.To)!.push(edge.From);
  }

  nodeIds.forEach((id) => {
    if (!weightByNode.has(id)) weightByNode.set(id, 0);
    if (!outgoingWeight.has(id)) outgoingWeight.set(id, 0);
    if (!inDegree.has(id)) inDegree.set(id, 0);
    if (!outDegree.has(id)) outDegree.set(id, 0);
    if (!directedAdj.has(id)) directedAdj.set(id, []);
    if (!undirectedAdj.has(id)) undirectedAdj.set(id, []);
  });

  return { nodeIds, weightByNode, outgoingWeight, inDegree, outDegree, directedAdj, undirectedAdj };
}

function graphCenter(index: GraphIndex): string | undefined {
  const ids = [...index.nodeIds];
  let best: { id: string; eccentricity: number; weight: number } | undefined;

  for (const id of ids) {
    const distances = new Map<string, number>([[id, 0]]);
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      const distance = distances.get(current)!;
      for (const next of index.undirectedAdj.get(current) ?? []) {
        if (distances.has(next)) continue;
        distances.set(next, distance + 1);
        queue.push(next);
      }
    }
    const eccentricity = distances.size === ids.length ? Math.max(...distances.values()) : Number.POSITIVE_INFINITY;
    const weight = index.weightByNode.get(id) ?? 0;
    if (!best || eccentricity < best.eccentricity || (eccentricity === best.eccentricity && weight > best.weight) || (eccentricity === best.eccentricity && weight === best.weight && id.localeCompare(best.id) < 0)) {
      best = { id, eccentricity, weight };
    }
  }

  return best?.id;
}

function chooseVisualRoot(edges: GraphEdge[], rootId: string | undefined, graphType: GraphType, index: GraphIndex): string | undefined {
  if (rootId && index.nodeIds.has(rootId)) return rootId;
  const ids = [...index.nodeIds];
  if (!ids.length) return undefined;

  if (graphType === "polytree") {
    const minInDegree = Math.min(...ids.map((id) => index.inDegree.get(id) ?? 0));
    const candidates = ids
      .filter((id) => (index.inDegree.get(id) ?? 0) === minInDegree)
      .sort((a, b) =>
        (index.outDegree.get(b) ?? 0) - (index.outDegree.get(a) ?? 0)
        || (index.outgoingWeight.get(b) ?? 0) - (index.outgoingWeight.get(a) ?? 0)
        || a.localeCompare(b)
      );
    return candidates[0] ?? graphCenter(index);
  }

  return ids.sort((a, b) =>
    (index.outDegree.get(b) ?? 0) - (index.outDegree.get(a) ?? 0)
    || (index.outgoingWeight.get(b) ?? 0) - (index.outgoingWeight.get(a) ?? 0)
    || a.localeCompare(b)
  )[0];
}

function computeLevels(rootId: string | undefined, graphType: GraphType, index: GraphIndex) {
  const levelByNode = new Map<string, number>();
  if (!rootId || !index.nodeIds.has(rootId)) return levelByNode;

  const adj = graphType === "polytree" ? index.undirectedAdj : index.directedAdj;
  levelByNode.set(rootId, 0);
  const queue = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    const currentLevel = levelByNode.get(current)!;
    for (const next of adj.get(current) ?? []) {
      if (levelByNode.has(next)) continue;
      levelByNode.set(next, currentLevel + 1);
      queue.push(next);
    }
  }

  const fallbackLevel = Math.max(0, ...levelByNode.values()) + 1;
  index.nodeIds.forEach((id) => {
    if (!levelByNode.has(id)) levelByNode.set(id, fallbackLevel);
  });

  return levelByNode;
}

function computeSiblingOrder(rootId: string | undefined, graphType: GraphType, index: GraphIndex, levelByNode: Map<string, number>) {
  const order = new Map<string, number>();
  const visited = new Set<string>();
  let cursor = 0;

  const neighbors = graphType === "polytree" ? index.undirectedAdj : index.directedAdj;

  function orderedChildren(id: string) {
    const currentLevel = levelByNode.get(id) ?? 0;
    return (neighbors.get(id) ?? [])
      .filter((next) => (levelByNode.get(next) ?? 0) > currentLevel)
      .sort((a, b) =>
        (index.weightByNode.get(b) ?? 0) - (index.weightByNode.get(a) ?? 0)
        || a.localeCompare(b)
      );
  }

  function visit(id: string): number {
    if (visited.has(id)) return order.get(id) ?? cursor;
    visited.add(id);
    const children = orderedChildren(id).filter((child) => !visited.has(child));
    if (!children.length) {
      order.set(id, cursor);
      cursor += 1;
      return order.get(id)!;
    }

    const childOrders = children.map(visit);
    const average = childOrders.reduce((sum, value) => sum + value, 0) / childOrders.length;
    order.set(id, average);
    return average;
  }

  if (rootId) visit(rootId);

  [...index.nodeIds]
    .sort((a, b) =>
      (levelByNode.get(a) ?? 0) - (levelByNode.get(b) ?? 0)
      || (index.weightByNode.get(b) ?? 0) - (index.weightByNode.get(a) ?? 0)
      || a.localeCompare(b)
    )
    .forEach((id) => {
      if (!order.has(id)) {
        order.set(id, cursor);
        cursor += 1;
      }
    });

  return order;
}

function buildHierarchicalLayout(
  edges: GraphEdge[],
  rootId: string | undefined,
  canvasW: number,
  canvasH: number,
  graphType: GraphType,
): Map<string, Node> {
  const index = buildGraphIndex(edges);
  const visualRoot = chooseVisualRoot(edges, rootId, graphType, index);
  const levelByNode = computeLevels(visualRoot, graphType, index);
  const orderByNode = computeSiblingOrder(visualRoot, graphType, index, levelByNode);
  const byLevel = new Map<number, string[]>();

  levelByNode.forEach((level, id) => {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(id);
  });

  const totalLevels = Math.max(1, ...byLevel.keys()) + 1;
  const paddingX = 80;
  const paddingY = 70;
  const usableH = canvasH - paddingY * 2;
  const usableW = canvasW - paddingX * 2;
  const nodes = new Map<string, Node>();

  byLevel.forEach((ids, level) => {
    const orderedIds = [...ids].sort((a, b) =>
      (orderByNode.get(a) ?? 0) - (orderByNode.get(b) ?? 0)
      || (index.weightByNode.get(b) ?? 0) - (index.weightByNode.get(a) ?? 0)
      || a.localeCompare(b)
    );
    const y = paddingY + (level / Math.max(totalLevels - 1, 1)) * usableH;
    orderedIds.forEach((id, idx) => {
      const x = paddingX + ((idx + 0.5) / orderedIds.length) * usableW;
      nodes.set(id, {
        id,
        x,
        y,
        level,
        weight: index.weightByNode.get(id) ?? 0,
        isRoot: id === visualRoot,
        isConvergence: (index.inDegree.get(id) ?? 0) > 1,
      });
    });
  });

  return nodes;
}

function buildForceLayout(
  edges: GraphEdge[],
  rootId: string | undefined,
  canvasW: number,
  canvasH: number,
): Map<string, Node> {
  const index = buildGraphIndex(edges);
  const ids = [...index.nodeIds];
  const pos: Record<string, { x: number; y: number }> = {};

  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(ids.length, 1);
    const r = Math.min(canvasW, canvasH) * 0.35;
    pos[id] = { x: canvasW / 2 + r * Math.cos(angle), y: canvasH / 2 + r * Math.sin(angle) };
  });

  const edgeSet = edges.map((edge) => ({ from: edge.From, to: edge.To, w: edge.Weight }));
  const maxW = Math.max(1, ...edgeSet.map((edge) => edge.w));

  for (let iter = 0; iter < 80; iter++) {
    const force: Record<string, { fx: number; fy: number }> = {};
    ids.forEach((id) => { force[id] = { fx: 0, fy: 0 }; });

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        const dx = pos[b].x - pos[a].x;
        const dy = pos[b].y - pos[a].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const repulsion = 18000 / (dist * dist);
        force[a].fx -= (repulsion * dx) / dist;
        force[a].fy -= (repulsion * dy) / dist;
        force[b].fx += (repulsion * dx) / dist;
        force[b].fy += (repulsion * dy) / dist;
      }
    }

    edgeSet.forEach(({ from, to, w }) => {
      const dx = pos[to].x - pos[from].x;
      const dy = pos[to].y - pos[from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 80 + 60 * (1 - w / maxW);
      const attraction = (dist - ideal) * 0.05;
      force[from].fx += (attraction * dx) / dist;
      force[from].fy += (attraction * dy) / dist;
      force[to].fx -= (attraction * dx) / dist;
      force[to].fy -= (attraction * dy) / dist;
    });

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
      weight: index.weightByNode.get(id) ?? 0,
      isRoot: id === rootId,
      isConvergence: (index.inDegree.get(id) ?? 0) > 1,
    });
  });

  return nodes;
}

function isDag(index: GraphIndex) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    for (const next of index.directedAdj.get(id) ?? []) {
      if (!visit(next)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }

  return [...index.nodeIds].every(visit);
}

function allReachableFrom(rootId: string | undefined, adj: Map<string, string[]>, nodeIds: Set<string>) {
  if (!rootId || !nodeIds.has(rootId)) return false;
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === nodeIds.size;
}

function computeValidationStats(edges: GraphEdge[], root: string | undefined, graphType: GraphType): ValidationStats {
  const index = buildGraphIndex(edges);
  const visualRoot = chooseVisualRoot(edges, root, graphType, index);
  const dag = isDag(index);
  const edgesEqualNodesMinusOne = edges.length === Math.max(index.nodeIds.size - 1, 0);
  const directedReachable = allReachableFrom(visualRoot, index.directedAdj, index.nodeIds);
  const undirectedReachable = allReachableFrom(visualRoot, index.undirectedAdj, index.nodeIds);
  const maxInDegree = Math.max(0, ...[...index.inDegree.values()]);
  const rootInDegree = visualRoot ? index.inDegree.get(visualRoot) ?? 0 : Number.POSITIVE_INFINITY;
  const maxNonRootInDegree = Math.max(0, ...[...index.nodeIds].filter((id) => id !== visualRoot).map((id) => index.inDegree.get(id) ?? 0));
  const isArborescence = dag && directedReachable && rootInDegree === 0 && maxNonRootInDegree <= 1 && edgesEqualNodesMinusOne;
  const isPolytree = dag && undirectedReachable && edgesEqualNodesMinusOne;

  return {
    isDag: dag,
    edgesEqualNodesMinusOne,
    isArborescence,
    isPolytree,
    maxInDegree,
    visualRoot,
  };
}

function nodeRadius(node: Node, maxWeight: number): number {
  const base = node.isRoot ? 22 : 14;
  const scale = Math.sqrt((node.weight / Math.max(maxWeight, 1)) * 0.6 + 0.4);
  return Math.round(base * scale);
}

function Badge({ label, value }: { label: string; value: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
      {label}: {value ? "Sim" : "Não"}
    </span>
  );
}

export function RamexGraphViewer({
  edges,
  root,
  title,
  subtitle,
  highlightColor = "#c8914b",
  graphType = "observed",
  validationMetrics,
}: {
  edges?: GraphEdge[];
  root?: string;
  title?: string;
  subtitle?: string;
  highlightColor?: string;
  graphType?: GraphType;
  validationMetrics?: GraphValidationMetrics;
}) {
  const allEdges = useMemo(() => edges ?? [], [edges]);
  const structuralGraph = isStructuralGraph(graphType);
  const [limit, setLimit] = useState(100);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("hierarchical");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const visibleEdges = useMemo(() => {
    const sorted = [...allEdges].sort((a, b) => b.Weight - a.Weight || a.From.localeCompare(b.From) || a.To.localeCompare(b.To));
    if (structuralGraph && layoutMode === "hierarchical") return sorted;
    return sorted.slice(0, limit);
  }, [allEdges, limit, layoutMode, structuralGraph]);

  const validationStats = useMemo(() => {
    const computed = computeValidationStats(visibleEdges, root, graphType);
    if (!validationMetrics) return computed;
    return {
      ...computed,
      isDag: validationMetrics.is_dag ?? computed.isDag,
      edgesEqualNodesMinusOne: validationMetrics.edges !== undefined && validationMetrics.expected_edges !== undefined
        ? validationMetrics.edges === validationMetrics.expected_edges
        : computed.edgesEqualNodesMinusOne,
      isArborescence: validationMetrics.is_valid_rooted_branching
        ?? validationMetrics.is_valid_arborescence
        ?? validationMetrics.is_arborescence
        ?? validationMetrics.is_valid_forward_tree
        ?? computed.isArborescence,
      isPolytree: validationMetrics.is_valid_polytree
        ?? validationMetrics.is_polytree
        ?? computed.isPolytree,
    };
  }, [visibleEdges, root, graphType, validationMetrics]);

  const nodes = useMemo(() => {
    if (!visibleEdges.length) return new Map<string, Node>();
    return layoutMode === "hierarchical"
      ? buildHierarchicalLayout(visibleEdges, root, CANVAS_W, CANVAS_H, graphType)
      : buildForceLayout(visibleEdges, root, CANVAS_W, CANVAS_H);
  }, [visibleEdges, root, layoutMode, graphType]);

  const maxWeight = useMemo(
    () => Math.max(1, ...[...nodes.values()].map((node) => node.weight)),
    [nodes],
  );
  const maxEdgeW = useMemo(() => Math.max(1, ...visibleEdges.map((edge) => edge.Weight)), [visibleEdges]);

  const handleWheel = useCallback((event: ReactWheelEvent) => {
    event.preventDefault();
    setZoom((current) => Math.min(4, Math.max(0.3, current - event.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((event: ReactMouseEvent) => {
    if (event.button === 0) {
      setDragging(true);
      setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((event: ReactMouseEvent) => {
    if (dragging) {
      setPan({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
    }
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (structuralGraph) {
      setLayoutMode("hierarchical");
      return;
    }
    const nodeSet = new Set<string>();
    allEdges.forEach((edge) => {
      nodeSet.add(edge.From);
      nodeSet.add(edge.To);
    });
    const density = allEdges.length / Math.max(1, nodeSet.size * (nodeSet.size - 1));
    setLayoutMode(density > 0.25 || allEdges.length > MAX_EDGES_FORCE ? "force" : "hierarchical");
  }, [allEdges, structuralGraph]);

  if (!allEdges.length) return null;

  const isTruncated = allEdges.length > visibleEdges.length;
  const showingAlternative = structuralGraph && layoutMode === "force";
  const convergenceNodes = [...nodes.values()].filter((node) => node.isConvergence).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/40">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          {title && <h4 className="text-base font-semibold tracking-tight text-slate-950">{title}</h4>}
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          <p className="mt-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">
            {graphLegend(graphType)}
          </p>
          {graphType === "experimental" ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Baseline exploratório: validar antes de usar como evidência principal.
            </p>
          ) : null}
          {showingAlternative ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Layout alternativo apenas exploratório. A estrutura RAMEX principal é hierárquica.
            </p>
          ) : null}
          {isTruncated ? (
            <p className="mt-1 text-xs text-amber-700">
              A mostrar top {limit} de {allEdges.length} arestas por peso.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label="DAG" value={validationStats.isDag} />
            <Badge label="Edges = Nodes - 1" value={validationStats.edgesEqualNodesMinusOne} />
            <Badge label="Arborescência" value={validationStats.isArborescence} />
            <Badge label="Poly-tree" value={validationStats.isPolytree} />
            {graphType === "polytree" && convergenceNodes > 0 ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                Convergência: {convergenceNodes}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {structuralGraph ? (
            <button
              type="button"
              onClick={() => setLayoutMode((current) => current === "hierarchical" ? "force" : "hierarchical")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              {layoutMode === "hierarchical" ? "Ver layout alternativo" : "Voltar ao layout hierárquico"}
            </button>
          ) : (
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["hierarchical", "force"] as LayoutMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLayoutMode(mode)}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${layoutMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {mode === "hierarchical" ? "Hierárquico" : "Força"}
                </button>
              ))}
            </div>
          )}
          {allEdges.length > 50 && (!structuralGraph || layoutMode === "force") ? (
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700"
            >
              {[50, 100, 200, 500].map((value) => (
                <option key={value} value={value}>Top {value}</option>
              ))}
              <option value={9999}>Todas</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset zoom
          </button>
        </div>
      </div>

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
              {visibleEdges.map((edge, index) => {
                const source = nodes.get(edge.From);
                const target = nodes.get(edge.To);
                if (!source || !target || source.id === target.id) return null;
                const sourceRadius = nodeRadius(source, maxWeight);
                const targetRadius = nodeRadius(target, maxWeight);
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const x1 = source.x + (sourceRadius * dx) / dist;
                const y1 = source.y + (sourceRadius * dy) / dist;
                const x2 = target.x - ((targetRadius + 8) * dx) / dist;
                const y2 = target.y - ((targetRadius + 8) * dy) / dist;
                const strokeW = 0.8 + 4 * Math.sqrt(edge.Weight / maxEdgeW);
                const isFromRoot = source.isRoot;
                return (
                  <line
                    key={`${edge.From}-${edge.To}-${index}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isFromRoot ? highlightColor : "#315f72"}
                    strokeWidth={strokeW}
                    strokeOpacity={isFromRoot ? 0.85 : 0.55}
                    markerEnd={isFromRoot ? "url(#arrow-root)" : "url(#arrow)"}
                    onMouseEnter={(event) => {
                      const svg = svgRef.current;
                      if (!svg) return;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        text: `${edge.From} → ${edge.To} | peso: ${edge.Weight}`,
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top - 10,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}

              {[...nodes.values()].map((node) => {
                const radius = nodeRadius(node, maxWeight);
                return (
                  <g
                    key={node.id}
                    onMouseEnter={(event) => {
                      const svg = svgRef.current;
                      if (!svg) return;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        text: `${node.id} | peso acumulado: ${node.weight}${node.isConvergence ? " | nó de convergência" : ""}`,
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top - 12,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: "default" }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={node.isRoot ? highlightColor : node.isConvergence ? "#efe2ff" : "#dceef5"}
                      stroke={node.isConvergence ? "#7c3aed" : "#315f72"}
                      strokeWidth={node.isRoot || node.isConvergence ? 2.5 : 1.5}
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={Math.max(8, Math.min(13, radius * 0.75))}
                      fontWeight={node.isRoot ? "800" : "600"}
                      fill={node.isRoot ? "#fff" : "#0f172a"}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {node.id.length > 14 ? `${node.id.slice(0, 13)}…` : node.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-slate-200 bg-white/98 px-3 py-2 text-xs font-semibold text-slate-800 shadow-xl"
            style={{ left: Math.min(tooltip.x + 12, CANVAS_W - 220), top: Math.max(tooltip.y - 8, 4) }}
          >
            {tooltip.text}
          </div>
        ) : null}
      </div>

      <p className="px-5 py-2 text-xs text-slate-400">
        Scroll para zoom · Arrastar para mover · Passe o cursor em nós e arestas para detalhes
      </p>
    </div>
  );
}
