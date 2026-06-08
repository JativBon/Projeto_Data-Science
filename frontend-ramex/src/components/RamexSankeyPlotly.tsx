"use client";

import { useEffect, useMemo, useRef } from "react";

export type SankeyEdge = {
  from?: string;
  to?: string;
  weight?: number;
  level?: number;
};

export type SankeyStructureType = "ramex2007" | "forward" | "polytree" | "observed";

const ROOT_NODE_COLOR = "#c8914b";
const SINK_NODE_COLOR = "#1e293b";
const NORMAL_NODE_COLOR = "#315f72";
const POLYTREE_NODE_COLOR = "#7c3aed";
const CONVERGENCE_NODE_COLOR = "#db2777";
const OBSERVED_NODE_COLOR = "#64748b";
const ROOT_LINK_COLOR = "rgba(200,145,75,0.45)";
const NORMAL_LINK_COLOR = "rgba(49,95,114,0.35)";
const POLYTREE_LINK_COLOR = "rgba(124,58,237,0.36)";
const OBSERVED_LINK_COLOR = "rgba(100,116,139,0.28)";

type CleanSankeyEdge = { from: string; to: string; weight: number; level?: number };
type InitialSankeyEdge = { from?: string; to?: string; weight?: number };

function cleanEdges(edges: SankeyEdge[]): CleanSankeyEdge[] {
  return edges.flatMap((edge) => {
    const from = String(edge.from ?? "").trim();
    const to = String(edge.to ?? "").trim();
    const weight = Number(edge.weight ?? 0);
    const level = edge.level === undefined ? undefined : Number(edge.level);
    if (!from || !to || !Number.isFinite(weight) || weight <= 0) return [];
    return [{ from, to, weight, level: Number.isFinite(level) ? level : undefined }];
  });
}

function structureLabel(type: SankeyStructureType) {
  if (type === "ramex2007") return "RAMEX 2007";
  if (type === "forward") return "Forward";
  if (type === "polytree") return "Back-and-Forward Poly-tree";
  return "Grafo observado filtrado";
}

function treeCenter(adjacency: Map<string, string[]>): string | undefined {
  const nodes = [...adjacency.keys()];
  if (!nodes.length) return undefined;
  if (nodes.length <= 2) return nodes.sort()[0];

  const degree = new Map(nodes.map((node) => [node, adjacency.get(node)?.length ?? 0]));
  let leaves = nodes.filter((node) => (degree.get(node) ?? 0) <= 1).sort();
  let remaining = nodes.length;

  while (remaining > 2 && leaves.length) {
    remaining -= leaves.length;
    const nextLeaves: string[] = [];
    for (const leaf of leaves) {
      degree.set(leaf, 0);
      for (const neighbor of adjacency.get(leaf) ?? []) {
        const nextDegree = Math.max(0, (degree.get(neighbor) ?? 0) - 1);
        degree.set(neighbor, nextDegree);
        if (nextDegree === 1) nextLeaves.push(neighbor);
      }
    }
    leaves = [...new Set(nextLeaves)].sort();
  }

  return nodes.filter((node) => (degree.get(node) ?? 0) > 0).sort()[0] ?? nodes.sort()[0];
}

function chooseVisualRoot(
  edges: CleanSankeyEdge[],
  root: string | undefined,
  type: SankeyStructureType,
  initialEdge?: InitialSankeyEdge,
): string {
  if (root?.trim()) return root.trim();
  const nodes = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  if (type === "polytree") {
    const initialFrom = initialEdge?.from?.trim();
    const initialTo = initialEdge?.to?.trim();
    if (initialFrom && nodes.has(initialFrom)) return initialFrom;
    if (initialTo && nodes.has(initialTo)) return initialTo;

    const undirected = new Map<string, string[]>();
    for (const node of nodes) undirected.set(node, []);
    for (const edge of edges) {
      undirected.set(edge.from, [...(undirected.get(edge.from) ?? []), edge.to]);
      undirected.set(edge.to, [...(undirected.get(edge.to) ?? []), edge.from]);
    }
    const center = treeCenter(undirected);
    if (center) return center;
  }

  const targets = new Set(edges.map((edge) => edge.to));
  const sources = new Set(edges.map((edge) => edge.from));
  const zeroIncoming = [...sources].filter((node) => !targets.has(node)).sort();
  if (zeroIncoming.length && type !== "polytree") return zeroIncoming[0];

  const weight = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const edge of edges) {
    weight.set(edge.from, (weight.get(edge.from) ?? 0) + edge.weight);
    weight.set(edge.to, (weight.get(edge.to) ?? 0) + edge.weight);
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  return [...weight.keys()].sort((a, b) => {
    const degreeDelta = (degree.get(b) ?? 0) - (degree.get(a) ?? 0);
    if (type === "polytree" && degreeDelta !== 0) return degreeDelta;
    return (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || a.localeCompare(b);
  })[0] ?? edges[0]?.from ?? "";
}

function computeLevels(edges: CleanSankeyEdge[], root: string, type: SankeyStructureType) {
  const nodes = new Set<string>();
  const outgoing = new Map<string, string[]>();
  const undirected = new Map<string, string[]>();

  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    undirected.set(edge.from, [...(undirected.get(edge.from) ?? []), edge.to]);
    undirected.set(edge.to, [...(undirected.get(edge.to) ?? []), edge.from]);
  }

  const adjacency = type === "polytree" || type === "observed" ? undirected : outgoing;
  const levelByNode = new Map<string, number>();
  const queue = root ? [root] : [];
  if (root) levelByNode.set(root, 0);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    for (const next of adjacency.get(node) ?? []) {
      if (levelByNode.has(next)) continue;
      levelByNode.set(next, (levelByNode.get(node) ?? 0) + 1);
      queue.push(next);
    }
  }

  for (const edge of edges) {
    if (edge.level !== undefined && type !== "observed") {
      levelByNode.set(edge.to, Math.max(0, edge.level));
      if (!levelByNode.has(edge.from)) levelByNode.set(edge.from, Math.max(0, edge.level - 1));
    }
  }

  for (const node of nodes) {
    if (!levelByNode.has(node)) levelByNode.set(node, Math.max(0, ...levelByNode.values()) + 1);
  }

  if (type !== "observed" && type !== "polytree") {
    let changed = true;
    for (let i = 0; i < nodes.size && changed; i += 1) {
      changed = false;
      for (const edge of edges) {
        const sourceLevel = levelByNode.get(edge.from) ?? 0;
        const targetLevel = levelByNode.get(edge.to) ?? 0;
        if (targetLevel <= sourceLevel) {
          levelByNode.set(edge.to, sourceLevel + 1);
          changed = true;
        }
      }
    }
  }

  return levelByNode;
}

function computePolytreeNodePositions(edges: CleanSankeyEdge[], root: string) {
  const nodes = new Set<string>();
  const undirected = new Map<string, string[]>();
  const weightByNode = new Map<string, number>();

  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    undirected.set(edge.from, [...(undirected.get(edge.from) ?? []), edge.to]);
    undirected.set(edge.to, [...(undirected.get(edge.to) ?? []), edge.from]);
    weightByNode.set(edge.from, (weightByNode.get(edge.from) ?? 0) + edge.weight);
    weightByNode.set(edge.to, (weightByNode.get(edge.to) ?? 0) + edge.weight);
  }

  const levelByNode = new Map<string, number>();
  const parentByNode = new Map<string, string | undefined>();
  const children = new Map<string, string[]>();
  const queue = root ? [root] : [];
  if (root) {
    levelByNode.set(root, 0);
    parentByNode.set(root, undefined);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    for (const next of undirected.get(node) ?? []) {
      if (levelByNode.has(next)) continue;
      levelByNode.set(next, (levelByNode.get(node) ?? 0) + 1);
      parentByNode.set(next, node);
      children.set(node, [...(children.get(node) ?? []), next]);
      queue.push(next);
    }
  }

  for (const node of nodes) {
    if (!levelByNode.has(node)) {
      levelByNode.set(node, Math.max(0, ...levelByNode.values()) + 1);
      parentByNode.set(node, undefined);
    }
  }

  const subtreeWeight = new Map<string, number>();
  const postOrder = [...levelByNode.entries()].sort((a, b) => b[1] - a[1]).map(([node]) => node);
  for (const node of postOrder) {
    const ownWeight = weightByNode.get(node) ?? 0;
    const descendantsWeight = (children.get(node) ?? []).reduce((sum, child) => sum + (subtreeWeight.get(child) ?? 0), 0);
    subtreeWeight.set(node, ownWeight + descendantsWeight);
  }

  const byLevel = new Map<number, string[]>();
  for (const [node, level] of levelByNode.entries()) {
    byLevel.set(level, [...(byLevel.get(level) ?? []), node]);
  }

  const orderByNode = new Map<string, number>();
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const baseSort = (a: string, b: string) =>
    (subtreeWeight.get(b) ?? 0) - (subtreeWeight.get(a) ?? 0)
    || (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0)
    || a.localeCompare(b);

  for (const level of levels) {
    const sorted = [...(byLevel.get(level) ?? [])].sort(baseSort);
    byLevel.set(level, sorted);
    sorted.forEach((node, index) => orderByNode.set(node, index));
  }

  const barycenter = (neighbors: string[]) => {
    const values = neighbors.map((node) => orderByNode.get(node)).filter((value): value is number => value !== undefined);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.POSITIVE_INFINITY;
  };

  for (let pass = 0; pass < 6; pass += 1) {
    for (const level of levels.slice(1)) {
      const sorted = [...(byLevel.get(level) ?? [])].sort((a, b) => {
        const delta = barycenter([parentByNode.get(a), ...(undirected.get(a) ?? []).filter((node) => (levelByNode.get(node) ?? 0) < level)].filter(Boolean) as string[])
          - barycenter([parentByNode.get(b), ...(undirected.get(b) ?? []).filter((node) => (levelByNode.get(node) ?? 0) < level)].filter(Boolean) as string[]);
        return Number.isFinite(delta) && delta !== 0 ? delta : baseSort(a, b);
      });
      byLevel.set(level, sorted);
      sorted.forEach((node, index) => orderByNode.set(node, index));
    }
    for (const level of [...levels].reverse().slice(1)) {
      const sorted = [...(byLevel.get(level) ?? [])].sort((a, b) => {
        const nextA = (undirected.get(a) ?? []).filter((node) => (levelByNode.get(node) ?? 0) > level);
        const nextB = (undirected.get(b) ?? []).filter((node) => (levelByNode.get(node) ?? 0) > level);
        const delta = barycenter(nextA) - barycenter(nextB);
        return Number.isFinite(delta) && delta !== 0 ? delta : baseSort(a, b);
      });
      byLevel.set(level, sorted);
      sorted.forEach((node, index) => orderByNode.set(node, index));
    }
  }

  const maxLevel = Math.max(1, ...levels);
  const xByNode = new Map<string, number>();
  const yByNode = new Map<string, number>();

  for (const [level, levelNodes] of byLevel.entries()) {
    levelNodes.forEach((node, index) => {
      xByNode.set(node, Math.min(0.98, Math.max(0.02, level / maxLevel)));
      yByNode.set(node, Math.min(0.96, Math.max(0.04, (index + 1) / (levelNodes.length + 1))));
    });
  }

  return { xByNode, yByNode };
}

function computeNodePositions(edges: CleanSankeyEdge[], root: string, type: SankeyStructureType) {
  if (type === "polytree") return computePolytreeNodePositions(edges, root);

  const levelByNode = computeLevels(edges, root, type);
  const weightByNode = new Map<string, number>();
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();

  for (const edge of edges) {
    weightByNode.set(edge.from, (weightByNode.get(edge.from) ?? 0) + edge.weight);
    weightByNode.set(edge.to, (weightByNode.get(edge.to) ?? 0) + edge.weight);
    parents.set(edge.to, [...(parents.get(edge.to) ?? []), edge.from]);
    children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
  }

  const byLevel = new Map<number, string[]>();
  for (const [node, level] of levelByNode.entries()) {
    byLevel.set(level, [...(byLevel.get(level) ?? []), node]);
  }

  const orderByNode = new Map<string, number>();
  const byWeight = (nodes: string[]) =>
    nodes.sort((a, b) => (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0) || a.localeCompare(b));

  for (const [level, nodes] of byLevel.entries()) {
    const sorted = byWeight([...nodes]);
    byLevel.set(level, sorted);
    sorted.forEach((node, index) => orderByNode.set(node, index));
  }

  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const barycenter = (neighbors: string[]) => {
    const values = neighbors.map((node) => orderByNode.get(node)).filter((value): value is number => value !== undefined);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.POSITIVE_INFINITY;
  };

  for (let pass = 0; pass < 4; pass += 1) {
    for (const level of levels) {
      const sorted = [...(byLevel.get(level) ?? [])].sort((a, b) => {
        const delta = barycenter(parents.get(a) ?? []) - barycenter(parents.get(b) ?? []);
        return Number.isFinite(delta) && delta !== 0 ? delta : (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0) || a.localeCompare(b);
      });
      byLevel.set(level, sorted);
      sorted.forEach((node, index) => orderByNode.set(node, index));
    }
    for (const level of [...levels].reverse()) {
      const sorted = [...(byLevel.get(level) ?? [])].sort((a, b) => {
        const delta = barycenter(children.get(a) ?? []) - barycenter(children.get(b) ?? []);
        return Number.isFinite(delta) && delta !== 0 ? delta : (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0) || a.localeCompare(b);
      });
      byLevel.set(level, sorted);
      sorted.forEach((node, index) => orderByNode.set(node, index));
    }
  }

  const maxLevel = Math.max(1, ...levels);
  const xByNode = new Map<string, number>();
  const yByNode = new Map<string, number>();

  for (const [level, nodes] of byLevel.entries()) {
    nodes.forEach((node, index) => {
      xByNode.set(node, Math.min(0.98, Math.max(0.02, level / maxLevel)));
      yByNode.set(node, Math.min(0.96, Math.max(0.04, (index + 1) / (nodes.length + 1))));
    });
  }

  return { xByNode, yByNode };
}

export function RamexSankeyPlotly({
  edges,
  root,
  initialEdge,
  preservedWeight,
  title = "Sankey RAMEX 2007 — Arborescência Selecionada",
  subtitle = "Propagação de peso a partir da raiz. A espessura de cada banda é proporcional ao peso da transição.",
  structureType = "ramex2007",
}: {
  edges?: SankeyEdge[];
  root?: string;
  initialEdge?: InitialSankeyEdge;
  preservedWeight?: number;
  title?: string;
  subtitle?: string;
  structureType?: SankeyStructureType;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const allEdges = useMemo(() => edges ?? [], [edges]);

  const sankeyData = useMemo(() => {
    const clean = cleanEdges(allEdges);
    if (!clean.length) return null;

    const nodeSet = new Map<string, number>();
    const addNode = (name: string) => {
      if (!nodeSet.has(name)) nodeSet.set(name, nodeSet.size);
    };

    const rootId = chooseVisualRoot(clean, root, structureType, initialEdge) || clean[0]?.from || "SOURCE";
    addNode(rootId);
    clean.forEach((edge) => {
      addNode(edge.from);
      addNode(edge.to);
    });

    const nodeLabels = [...nodeSet.keys()];
    const positions = computeNodePositions(clean, rootId, structureType);
    const inDegree = new Map<string, number>();
    for (const edge of clean) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      if (!inDegree.has(edge.from)) inDegree.set(edge.from, inDegree.get(edge.from) ?? 0);
    }
    const nodeColors = nodeLabels.map((node) => {
      if (node === rootId) return ROOT_NODE_COLOR;
      if (node.toUpperCase() === "SINK") return SINK_NODE_COLOR;
      if (structureType === "polytree" && (inDegree.get(node) ?? 0) > 1) return CONVERGENCE_NODE_COLOR;
      if (structureType === "polytree") return POLYTREE_NODE_COLOR;
      if (structureType === "observed") return OBSERVED_NODE_COLOR;
      return NORMAL_NODE_COLOR;
    });

    const totalW = preservedWeight && preservedWeight > 0
      ? preservedWeight
      : clean.reduce((sum, edge) => sum + edge.weight, 0);

    const sources: number[] = [];
    const targets: number[] = [];
    const values: number[] = [];
    const linkColors: string[] = [];
    const customdata: string[] = [];

    for (const edge of clean) {
      const source = nodeSet.get(edge.from);
      const target = nodeSet.get(edge.to);
      if (source === undefined || target === undefined) continue;
      sources.push(source);
      targets.push(target);
      values.push(edge.weight);
      linkColors.push(
        structureType === "observed"
          ? OBSERVED_LINK_COLOR
          : structureType === "polytree"
            ? POLYTREE_LINK_COLOR
            : edge.from === rootId ? ROOT_LINK_COLOR : NORMAL_LINK_COLOR,
      );
      const pct = totalW > 0 ? ((edge.weight / totalW) * 100).toFixed(1) : "0.0";
      customdata.push(`Origem: ${edge.from}<br>Destino: ${edge.to}<br>Peso: ${edge.weight}<br>Percentagem: ${pct}%<br>Estrutura: ${structureLabel(structureType)}`);
    }

    const nodeX = nodeLabels.map((label) => positions.xByNode.get(label) ?? 0.02);
    const nodeY = nodeLabels.map((label) => positions.yByNode.get(label) ?? 0.5);
    const height = Math.max(420, Math.min(820, nodeLabels.length * 34 + 120));

    return { nodeLabels, nodeColors, nodeX, nodeY, sources, targets, values, linkColors, customdata, height };
  }, [allEdges, root, initialEdge, preservedWeight, structureType]);

  useEffect(() => {
    if (!sankeyData || !containerRef.current) return;

    let cancelled = false;

    import("plotly.js-dist-min").then((Plotly) => {
      if (cancelled || !containerRef.current) return;

      const { nodeLabels, nodeColors, nodeX, nodeY, sources, targets, values, linkColors, customdata, height } = sankeyData;

      const data = [
        {
          type: "sankey" as const,
          orientation: "h" as const,
          arrangement: "fixed" as const,
          node: {
            pad: 18,
            thickness: 22,
            line: { color: "#ffffff", width: 1 },
            label: nodeLabels,
            color: nodeColors,
            x: nodeX,
            y: nodeY,
            hovertemplate: "<b>%{label}</b><br>Peso total: %{value}<extra></extra>",
          },
          link: {
            source: sources,
            target: targets,
            value: values,
            color: linkColors,
            customdata,
            hovertemplate: "%{customdata}<extra></extra>",
          },
        },
      ];

      const layout = {
        font: { family: "Inter, system-ui, sans-serif", size: 13, color: "#1e293b" },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 10, r: 10, t: 10, b: 10 },
        height,
      };

      const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ["toImage", "sendDataToCloud"] as string[],
        displaylogo: false,
        responsive: true,
      };

      Plotly.react(containerRef.current, data, layout, config).catch(() => {});
    }).catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `<p style="padding:1rem;color:#64748b;font-size:0.875rem">Sankey não disponível. Verifique se o Plotly está instalado.</p>`;
      }
    });

    return () => { cancelled = true; };
  }, [sankeyData]);

  useEffect(() => {
    const element = containerRef.current;
    return () => {
      if (element) {
        import("plotly.js-dist-min").then((Plotly) => {
          Plotly.purge(element);
        }).catch(() => {});
      }
    };
  }, []);

  if (!allEdges.length) return null;

  return (
    <section className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div>
        <h4 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h4>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div ref={containerRef} style={{ width: "100%", minHeight: sankeyData?.height ?? 420 }} />
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Passe o cursor sobre bandas e nós para ver detalhes. As posições são fixas por nível para reduzir cruzamentos.
      </p>
    </section>
  );
}
