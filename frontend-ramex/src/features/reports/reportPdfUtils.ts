import type { ReportData } from "./reportPdfTypes";

type DatasetKey = "dataset01" | "dataset02" | "dataset03";

type DatasetBenchmarks = {
  key: DatasetKey;
  referenceStructure: string;
  referencePreservedPercent: number;
  polytreeFormalPercent: number;
};

const SMALL_GRAPH_MAX_NODES = 10;
const LARGE_GRAPH_MIN_NODES = 50;
const DENSE_GRAPH_MIN_DENSITY = 0.7;
const SPARSE_GRAPH_MAX_DENSITY = 0.05;
const SPARSE_GRAPH_MAX_AVG_WEIGHT = 1.5;
const STRONG_TRANSITION_AVG_WEIGHT = 5;
const NEAR_TOTAL_EDGE_REDUCTION_PERCENT = 99;

// Benchmarks fixos obtidos nas validacoes RAMEX dos datasets do projeto.
const DATASET_BENCHMARKS: Record<DatasetKey, DatasetBenchmarks> = {
  dataset01: {
    key: "dataset01",
    referenceStructure: "Anexo experimental: Back-and-Forward Poly-tree Formal",
    referencePreservedPercent: 1.42,
    polytreeFormalPercent: 1.42,
  },
  dataset02: {
    key: "dataset02",
    referenceStructure: "RAMEX 2007 Rooted Branching",
    referencePreservedPercent: 59.89,
    polytreeFormalPercent: 49.87,
  },
  dataset03: {
    key: "dataset03",
    referenceStructure: "Anexo experimental: Back-and-Forward Poly-tree Formal",
    referencePreservedPercent: 36.93,
    polytreeFormalPercent: 36.93,
  },
};

function detectDatasetKey(data: ReportData): DatasetKey | null {
  const raw = `${data.datasetName} ${data.datasetType ?? ""}`.toLowerCase();
  if (raw.includes("dataset01") || raw.includes("dataset 01")) return "dataset01";
  if (raw.includes("dataset02") || raw.includes("dataset 02")) return "dataset02";
  if (raw.includes("dataset03") || raw.includes("dataset 03")) return "dataset03";
  return null;
}

export function getDatasetBenchmarks(data: ReportData): DatasetBenchmarks | null {
  const key = detectDatasetKey(data);
  return key ? DATASET_BENCHMARKS[key] : null;
}

function classifyDatasetScenario(data: ReportData): "dense" | "sparse" | "small" | "intermediate" {
  const density = data.metrics.density ?? 0;
  const nodes = data.metrics.nodes ?? 0;
  const edges = data.metrics.edges ?? 0;
  const averageWeight = edges > 0 ? (data.metrics.totalWeight ?? 0) / edges : 0;

  if (nodes <= SMALL_GRAPH_MAX_NODES && density >= DENSE_GRAPH_MIN_DENSITY) return "small";
  if (density >= DENSE_GRAPH_MIN_DENSITY && nodes > SMALL_GRAPH_MAX_NODES) return "dense";
  if (density <= SPARSE_GRAPH_MAX_DENSITY && averageWeight <= SPARSE_GRAPH_MAX_AVG_WEIGHT) return "sparse";
  return "intermediate";
}

export function safeValue(value: unknown, fallback = "Sem dados gerados"): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return String(value);
}

export function formatNumber(value?: number): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "Sem dados gerados";
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value?: number): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "Sem dados gerados";
  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function buildGraphInterpretation(data: ReportData): string {
  const density = data.metrics.density ?? 0;
  const nodes = data.metrics.nodes ?? 0;
  const edges = data.metrics.edges ?? 0;
  const averageWeight = edges > 0 ? (data.metrics.totalWeight ?? 0) / edges : 0;
  const totalWeight = formatNumber(data.metrics.totalWeight);

  if (density > DENSE_GRAPH_MIN_DENSITY) {
    return `O grafo completo tem ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}. A leitura visual pode beneficiar de frequência mínima ou Top-N.`;
  }
  if (density < SPARSE_GRAPH_MAX_DENSITY && nodes > LARGE_GRAPH_MIN_NODES) {
    return `O grafo tem ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}. A recorrência é baixa face ao número de nós.`;
  }
  if (nodes <= SMALL_GRAPH_MAX_NODES && averageWeight >= STRONG_TRANSITION_AVG_WEIGHT) {
    return `O grafo tem ${nodes} nós, ${edges} arestas e peso médio de ${averageWeight.toFixed(2)} por transição. A densidade é ${density.toFixed(4)}.`;
  }
  return `O grafo contém ${nodes} nós, ${edges} arestas, densidade ${density.toFixed(4)} e peso total de ${totalWeight}.`;
}

export function buildRamexInterpretation(data: ReportData): string {
  const ramexPreserved = data.metrics.ramexPreservedPercent ?? 0;
  const benchmark = getDatasetBenchmarks(data);
  const polytreePreserved = benchmark?.polytreeFormalPercent ?? data.metrics.polytreePreservedPercent ?? 0;
  return [
    `RAMEX base preserva ${ramexPreserved.toFixed(2)}% do peso; a Poly-tree formal preserva ${polytreePreserved.toFixed(2)}%.`,
    "A diferença entre estes valores deve ser lida em conjunto com densidade, repetição de transições e número de arestas selecionadas.",
  ].join(" ");
}

export function buildPolytreeInterpretation(data: ReportData): string {
  const benchmark = getDatasetBenchmarks(data);
  const ramex = data.metrics.ramexPreservedPercent ?? 0;
  const polytree = benchmark?.polytreeFormalPercent ?? data.metrics.polytreePreservedPercent ?? 0;
  return `A Poly-tree formal preserva ${polytree.toFixed(2)}% do peso, face a ${ramex.toFixed(2)}% na estrutura RAMEX base. A validação confirma se a saída é acíclica e conectada.`;
}

export function buildDatasetSpecificInterpretation(data: ReportData): string {
  const benchmark = getDatasetBenchmarks(data);
  const nodes = data.metrics.nodes ?? 0;
  const edges = data.metrics.edges ?? 0;
  const density = data.metrics.density ?? 0;
  if (benchmark?.key === "dataset01") {
    return [
      `O dataset01 gera um grafo denso: ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "A estrutura de referência preserva 1,42% do peso, valor baixo para uma rede com muitas ligações alternativas.",
      "A Poly-tree formal é válida, mas resume apenas uma fração pequena das transições observadas.",
    ].join("\n");
  }

  if (benchmark?.key === "dataset02") {
    return [
      `O dataset02 tem ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "O RAMEX 2007 preserva 59,89% de peso neste benchmark.",
      "A Poly-tree formal preserva 49,87%, mantendo uma estrutura válida mas menos abrangente.",
    ].join("\n");
  }

  if (benchmark?.key === "dataset03") {
    return [
      `O dataset03 é compacto: ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "A estrutura de referência preserva 36,93% do peso.",
      "É favorável ao RAMEX porque combina poucos nós, repetição e uma estrutura fácil de verificar.",
    ].join("\n");
  }

  const scenario = classifyDatasetScenario(data);
  const ramexEdges = data.metrics.ramexEdges ?? 0;
  const edgeReduction = edges > 0 ? ((edges - ramexEdges) / edges) * 100 : 0;
  const bestPure = Math.max(
    ...(data.pureRamex?.rows ?? [])
      .map((row) => row.preservedWeightPercent)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const bestPureText = Number.isFinite(bestPure) ? bestPure.toFixed(2) : "0.00";

  if (scenario === "dense") {
    const edgeReductionText =
      edgeReduction >= NEAR_TOTAL_EDGE_REDUCTION_PERCENT ? "superior a 99%" : `${edgeReduction.toFixed(2)}%`;
    return [
      `O grafo é denso: ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "A seleção RAMEX reduz a rede a uma estrutura acíclica com poucas arestas.",
      `• ocorre uma redução ${edgeReductionText} das arestas`,
      `• a estrutura de referência preserva ${bestPureText}% do peso`,
      "• a leitura deve focar nas arestas selecionadas, não na cobertura total",
    ].join("\n");
  }

  if (scenario === "sparse") {
    return [
      `O grafo é esparso: ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "A baixa repetição limita a formação de caminhos dominantes.",
      `• a estrutura de referência preserva ${bestPureText}% do peso`,
      "• a interpretação deve privilegiar transições recorrentes e não a cobertura global",
    ].join("\n");
  }

  if (scenario === "small") {
    return [
      `O grafo é pequeno: ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
      "As transições repetidas tornam a seleção RAMEX mais estável.",
      `• a estrutura de referência preserva ${bestPureText}% do peso`,
      "• a Poly-tree resultante é mais fácil de verificar visualmente",
    ].join("\n");
  }

  return [
    `O grafo tem ${nodes} nós, ${edges} arestas e densidade ${density.toFixed(4)}.`,
    `A estrutura de referência preserva ${bestPureText}% do peso, indicando preservação parcial da estrutura dominante.`,
  ].join(" ");
}

export function buildDatasetComparisonSection(): string {
  return [
    "O desempenho RAMEX varia por dataset.",
    "No dataset01, o anexo experimental Back-and-Forward preserva 1,42% de peso.",
    "No dataset02, o RAMEX 2007 Rooted Branching preserva 59,89% de peso.",
    "No dataset03, o anexo experimental Back-and-Forward preserva 36,93% de peso.",
    "A Poly-tree formal apresenta 1,42% no dataset01, 49,87% no dataset02 e 36,93% no dataset03.",
    "Os melhores resultados surgem quando há recorrência suficiente para formar caminhos dominantes.",
  ].join("\n\n");
}

export function buildExecutiveSummary(data: ReportData): string {
  return [
    "A análise separa camada observacional, RAMEX 2007 formal e RAMEX-Forum temporal.",
    buildGraphInterpretation(data),
    buildRamexInterpretation(data),
    buildPolytreeInterpretation(data),
  ].join(" ");
}

export function buildFinalConclusion(data: ReportData): string {
  const benchmark = getDatasetBenchmarks(data);
  const edges = data.metrics.edges ?? 0;
  const polytreeEdges = data.metrics.polytreeEdges ?? 0;
  const polytreePreserved = benchmark?.polytreeFormalPercent ?? data.metrics.polytreePreservedPercent ?? 0;
  const referenceStructure = benchmark?.referenceStructure ?? safeValue(data.pureRamex?.bestAlgorithm);
  const bestPreserved = benchmark?.referencePreservedPercent;
  return [
    `A análise agregada mostra frequências totais; o RAMEX analisa a ordem das transições. O grafo completo tem ${edges} arestas e a Poly-tree formal fica com ${polytreeEdges}, preservando ${polytreePreserved.toFixed(2)}% do peso total.`,
    bestPreserved !== undefined
      ? `A estrutura de referência foi ${referenceStructure}, com ${bestPreserved.toFixed(2)}% de peso preservado.`
      : "",
    "O RAMEX funciona melhor quando há repetição, estrutura sequencial clara e densidade controlada.",
    "Em grafos quase completos ou com transições pouco repetidas, a percentagem de peso preservado tende a baixar.",
    "A implementação inclui 10A Rooted Branching, 10B Forward, 10C Back-and-Forward e validação Poly-tree.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function safeReportFilename(datasetName: string, date = new Date()): string {
  const slug = datasetName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "dataset";
  return `relatorio_ramex_${slug}_${date.toISOString().slice(0, 10)}.pdf`;
}

async function imageToDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function buildRamexSankeyDataUrl(data: ReportData): string | undefined {
  const edges = (data.pureRamex?.ramex2007Edges ?? [])
    .filter((edge) => edge.from && edge.to && Number.isFinite(edge.weight) && edge.weight > 0);
  if (!edges.length) return undefined;

  const visibleEdges = edges.length > 50
    ? [...edges].sort((a, b) => b.weight - a.weight).slice(0, 50)
    : edges;
  const width = 980;
  const height = 520;
  const marginX = 56;
  const marginY = 42;
  const root = data.pureRamex?.ramex2007Root;
  const levels = new Map<string, number>();
  const weights = new Map<string, number>();
  if (root) levels.set(root, 0);

  visibleEdges.forEach((edge) => {
    const targetLevel = Number.isFinite(edge.level) ? Math.max(1, Number(edge.level)) : undefined;
    const sourceLevel = targetLevel === undefined ? levels.get(edge.from) ?? 0 : Math.max(0, targetLevel - 1);
    levels.set(edge.from, Math.min(levels.get(edge.from) ?? sourceLevel, sourceLevel));
    levels.set(edge.to, Math.min(levels.get(edge.to) ?? targetLevel ?? sourceLevel + 1, targetLevel ?? sourceLevel + 1));
    weights.set(edge.from, (weights.get(edge.from) ?? 0) + edge.weight);
    weights.set(edge.to, (weights.get(edge.to) ?? 0) + edge.weight);
  });

  const maxLevel = Math.max(1, ...Array.from(levels.values()));
  const nodesByLevel = new Map<number, Array<{ id: string; level: number; x: number; y: number; weight: number; isRoot: boolean }>>();
  Array.from(levels.entries()).forEach(([id, level]) => {
    const node = {
      id,
      level,
      x: marginX + (level / maxLevel) * (width - marginX * 2),
      y: marginY,
      weight: weights.get(id) ?? 0,
      isRoot: id === root,
    };
    nodesByLevel.set(level, [...(nodesByLevel.get(level) ?? []), node]);
  });
  nodesByLevel.forEach((nodes) => {
    const ordered = nodes.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    const gap = (height - marginY * 2) / Math.max(ordered.length, 1);
    ordered.forEach((node, index) => {
      node.y = marginY + gap * index + gap / 2;
    });
  });

  const nodes = new Map(Array.from(nodesByLevel.values()).flat().map((node) => [node.id, node]));
  const escapeXml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const maxWeight = Math.max(1, ...visibleEdges.map((edge) => edge.weight));
  const linkSvg = visibleEdges.map((edge, index) => {
    const source = nodes.get(edge.from);
    const target = nodes.get(edge.to);
    if (!source || !target) return "";
    const dx = Math.max(60, (target.x - source.x) * 0.5);
    const strokeWidth = 2 + Math.sqrt(edge.weight / maxWeight) * 16;
    const color = source.isRoot ? "#c8914b" : "#315f72";
    const opacity = source.isRoot ? "0.78" : "0.46";
    return `<path key="${index}" d="M ${source.x + 8} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x - 8} ${target.y}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
  }).join("");
  const nodeSvg = Array.from(nodes.values()).map((node) => {
    const color = node.isRoot ? "#c8914b" : "#18212f";
    const labelColor = node.isRoot ? "#8a5a17" : "#334155";
    return `<g><circle r="${node.isRoot ? 10 : 7}" cx="${node.x}" cy="${node.y}" fill="${color}" /><text x="${node.x}" y="${node.y - 14}" text-anchor="middle" font-size="12" font-weight="${node.isRoot ? 700 : 600}" fill="${labelColor}">${escapeXml(node.id)}</text></g>`;
  }).join("");
  const notice = edges.length > 50
    ? `<text x="56" y="500" font-size="12" fill="#8a5a17">Sankey complementar filtrado para legibilidade: top 50 arestas por peso. Tabela e JSON mantêm todas as arestas.</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="18" fill="#f8fafc" />${linkSvg}${nodeSvg}${notice}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildRamexAnalyticalDataUrl(data: ReportData): string | undefined {
  const edges = (data.pureRamex?.ramex2007Edges ?? [])
    .filter((edge) => edge.from && edge.to && Number.isFinite(edge.weight) && edge.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 45);
  if (!edges.length) return undefined;

  const width = 980;
  const height = 520;
  const root = data.pureRamex?.ramex2007Root;
  const levels = new Map<string, number>();
  if (root) levels.set(root, 0);
  edges.forEach((edge) => {
    const targetLevel = Math.max(1, Number(edge.level ?? (levels.get(edge.from) ?? 0) + 1));
    levels.set(edge.from, Math.min(levels.get(edge.from) ?? targetLevel - 1, targetLevel - 1));
    levels.set(edge.to, Math.min(levels.get(edge.to) ?? targetLevel, targetLevel));
  });
  const grouped = new Map<number, string[]>();
  levels.forEach((level, node) => grouped.set(level, [...(grouped.get(level) ?? []), node]));
  const maxLevel = Math.max(1, ...Array.from(grouped.keys()));
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes, level) => {
    nodes.sort().forEach((node, index) => {
      positions.set(node, {
        x: 56 + (level / maxLevel) * 868,
        y: 44 + ((index + 1) / (nodes.length + 1)) * 420,
      });
    });
  });
  const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const maxWeight = Math.max(1, ...edges.map((edge) => edge.weight));
  const linkSvg = edges.map((edge) => {
    const source = positions.get(edge.from);
    const target = positions.get(edge.to);
    if (!source || !target) return "";
    const strokeWidth = 1.5 + Math.sqrt(edge.weight / maxWeight) * 9;
    return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#315f72" stroke-opacity="0.58" stroke-width="${strokeWidth}" />`;
  }).join("");
  const nodeSvg = Array.from(positions.entries()).map(([node, pos]) => {
    const fill = node === root ? "#c8914b" : node.toUpperCase() === "SINK" ? "#334155" : "#e8f4f8";
    const textFill = node.toUpperCase() === "SINK" ? "#334155" : "#18212f";
    return `<g><circle cx="${pos.x}" cy="${pos.y}" r="${node === root ? 10 : 7}" fill="${fill}" stroke="#18212f" /><text x="${pos.x}" y="${pos.y - 13}" text-anchor="middle" font-size="11" font-weight="700" fill="${textFill}">${escapeXml(node)}</text></g>`;
  }).join("");
  const label = `<text x="56" y="498" font-size="12" fill="#64748b">Visualização analítica filtrada para legibilidade: top ramos por peso. Não substitui a árvore técnica completa.</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="18" fill="#f8fafc" />${linkSvg}${nodeSvg}${label}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function svgDataUrlToPng(dataUrl?: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg+xml")) return dataUrl;
  if (typeof window === "undefined") return undefined;
  return await new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || 980;
        canvas.height = image.naturalHeight || 520;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(undefined);
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(undefined);
      }
    };
    image.onerror = () => resolve(undefined);
    image.src = dataUrl;
  });
}

export async function prepareReportImages(data: ReportData): Promise<ReportData> {
  const [graph, ramex, ramex2007, polytree, forumGraph, forumSimplified, forumPhase1Graph, forumPhase1Matrix, forumPhase2Structure, forumPhase2Heuristic] = await Promise.all([
    imageToDataUrl(data.images?.graph),
    imageToDataUrl(data.images?.ramex),
    imageToDataUrl(data.images?.ramex2007),
    imageToDataUrl(data.images?.polytree),
    imageToDataUrl(data.ramexForum?.images?.graph),
    imageToDataUrl(data.ramexForum?.images?.simplified),
    imageToDataUrl(data.ramexForum?.temporalPhase1?.graph),
    imageToDataUrl(data.ramexForum?.temporalPhase1?.matrix),
    imageToDataUrl(data.ramexForum?.temporalPhase2?.structureImage),
    imageToDataUrl(data.ramexForum?.temporalPhase2?.heuristicImage),
  ]);
  const ramex2007Analytical = await svgDataUrlToPng(data.images?.ramex2007Analytical ?? buildRamexAnalyticalDataUrl(data));
  const ramex2007Sankey = await svgDataUrlToPng(data.images?.ramex2007Sankey ?? buildRamexSankeyDataUrl(data));

  return {
    ...data,
    images: {
      graph,
      ramex,
      ramex2007,
      ramex2007Analytical,
      ramex2007Sankey,
      polytree,
      forumGraph,
      forumSimplified,
    },
    ramexForum: data.ramexForum ? {
      ...data.ramexForum,
      temporalPhase1: data.ramexForum.temporalPhase1 ? {
        ...data.ramexForum.temporalPhase1,
        graph: forumPhase1Graph,
        matrix: forumPhase1Matrix,
      } : undefined,
      temporalPhase2: data.ramexForum.temporalPhase2 ? {
        ...data.ramexForum.temporalPhase2,
        structureImage: forumPhase2Structure,
        heuristicImage: forumPhase2Heuristic,
      } : undefined,
    } : undefined,
  };
}
