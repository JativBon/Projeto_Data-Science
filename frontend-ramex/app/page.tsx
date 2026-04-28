"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import Papa from "papaparse";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  FileUp,
  GitBranch,
  Grid3X3,
  History as HistoryIcon,
  Network,
  Play,
  Presentation,
  RefreshCw,
  Maximize2,
  RotateCcw,
  Search,
  Sparkles,
  Sigma,
  Table2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ReportExportButton } from "../src/features/reports/ReportExportButton";
import type { ReportData } from "../src/features/reports/reportPdfTypes";

type DatasetId = "01" | "02" | "03";
type ViewId =
  | "upload"
  | "history"
  | "datasets"
  | "pipeline"
  | "pure"
  | "forum"
  | "validation"
  | "reports"
  | "demo"
  | "about"
  | "matrix"
  | "graph"
  | "ramex"
  | "polytree"
  | "summary";

type CsvRow = Record<string, string>;
type MatrixRow = Record<string, string | number>;

type Edge = {
  From: string;
  To: string;
  Weight: number;
  Level?: number;
};

type ValidationRow = {
  Dataset: string;
  Nos_Grafo: number;
  Arestas_Grafo: number;
  Soma_Pesos_Grafo: number;
  Arestas_RAMEX: number;
  Soma_Pesos_RAMEX: number;
  Percentagem_Peso_Preservado: number;
  Densidade_Aproximada: number;
  Top_5_Transicoes: string;
  Interpretacao: string;
};

type MatrixData = {
  columns: string[];
  rows: MatrixRow[];
  total_rows?: number;
  total_columns?: number;
  is_truncated?: boolean;
};

type UploadDatasetType = "simple_sequences" | "event_table" | "customer_excel";
type PolyTreeStrategy = "top-k" | "multiobjective";
type AnalysisType = "pure" | "forum" | "both";

type ForumEdge = {
  From?: string;
  To?: string;
  Weight?: number;
  RelativeWeight?: number;
  Rank?: number;
};

type RamexForumData = {
  metrics: {
    nodes?: number;
    edges?: number;
    total_weight?: number;
    density?: number;
    normalized_relations?: number;
    most_influential_node?: string;
    most_received_node?: string;
    top_relation?: { from?: string; to?: string; weight?: number; relative_weight?: number };
    dominant_path?: string[];
    average_relative_weight?: number;
  };
  influence_graph?: { edges?: ForumEdge[] };
  simplified_influence?: { edges?: ForumEdge[]; selection_rule?: string };
  path_analysis?: {
    central_nodes?: Array<{
      id: string;
      out_strength?: number;
      in_strength?: number;
      degree?: number;
      betweenness?: number;
    }>;
    dominant_paths?: Array<{ path?: string[]; total_weight?: number; average_relative_weight?: number }>;
  };
  interpretation?: string;
  files?: Record<string, string>;
};

type UploadResult = {
  job_id: string;
  filename: string;
  status: string;
  analysis_type?: AnalysisType;
  metrics: {
    nodes: number;
    edges: number;
    total_weight: number;
    ramex_edges: number;
    ramex_weight: number;
    preserved_percentage: number;
    density: number;
    root: string;
    sequences: number;
    pairs: number;
    dense: boolean;
  };
  top_transitions: Edge[];
  matrix: MatrixData;
  graph_edges: Edge[];
  ramex_edges: Edge[];
  transition_matrix?: Record<string, Record<string, number>>;
  polytree?: PolyTreeData;
  polytree_edges?: PolyTreeTableRow[];
  pure?: {
    ramex2007?: PureRamexResult;
    forward?: PureRamexResult;
    back_forward_formal?: PureRamexResult;
    validation?: {
      best_algorithm?: string;
      structural_type?: string;
      summary?: string;
    };
    files?: Record<string, string>;
  } | null;
  forum?: RamexForumData | null;
  pure_ramex?: PureRamexData;
  formal_polytree?: PureRamexResult;
  pure_validation?: {
    best_algorithm?: string;
    structural_type?: string;
    summary?: string;
  };
  ramex_forum?: RamexForumData | null;
  files: Record<string, string>;
  interpretation: string;
  pipeline_steps: string[];
};

type JobStepStatus = "pending" | "running" | "completed" | "failed";

type JobStep = {
  id: string;
  label: string;
  status: JobStepStatus;
  progress: number;
  started_at?: string | null;
  finished_at?: string | null;
  message?: string;
};

type JobState = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  current_step: string;
  steps: JobStep[];
  logs: Array<{ timestamp: string; message: string }>;
  error?: {
    step?: string;
    message?: string;
    technical?: string;
  } | null;
};

type HistoryAnalysisType = "pure" | "forum" | "both" | "unknown";
type HistoryStatus = "completed" | "failed" | "unknown" | "pending" | "running";

type HistoryJob = {
  job_id: string;
  created_at: string;
  dataset_name: string;
  analysis_type: HistoryAnalysisType;
  status: HistoryStatus;
  has_pure: boolean;
  has_forum: boolean;
  files: Record<string, string | null>;
  summary: {
    nodes: number;
    edges: number;
    density: number;
    best_algorithm?: string | null;
    best_preserved_weight: number;
    most_influential_node?: string | null;
  };
};

type HistoryJobDetail = HistoryJob & {
  pure_metrics?: {
    validation?: {
      rows?: PureRamexComparisonRow[];
      summary?: string;
      best_algorithm?: string;
    };
    ramex2007?: PureRamexResult;
    forward?: PureRamexResult;
    back_forward_formal?: PureRamexResult;
  };
  forum_metrics?: RamexForumData;
  available_files?: string[];
  links?: Record<string, string>;
};

type PolyTreeData = {
  root: string;
  strategy?: PolyTreeStrategy | string;
  nodes: Array<{ id: string; level: number }>;
  edges: Array<{ from: string; to: string; weight: number; level: number; score?: number; strategy?: string; reason?: string }>;
  metrics: {
    original_nodes: number;
    original_edges: number;
    polytree_nodes: number;
    polytree_edges: number;
    original_weight_sum: number;
    polytree_weight_sum: number;
    preserved_weight_percent: number;
    max_depth?: number;
    strategy?: string;
    average_branching?: number;
    average_score?: number;
    interpretability_score?: number;
  };
  parameters?: Record<string, string | number | null | undefined>;
  scoring_formula?: string;
};

type PolyTreeTableRow = Edge & {
  ParentPath?: string;
  Strategy?: string;
  Score?: number;
  Reason?: string;
};

type PureRamexEdge = {
  from?: string;
  to?: string;
  weight?: number;
  level?: number;
  direction?: string;
};

type PureRamexResult = {
  algorithm: string;
  method?: string;
  root?: string;
  initial_edge?: { from?: string; to?: string; weight?: number };
  metrics?: {
    original_nodes?: number;
    original_edges?: number;
    selected_nodes?: number;
    selected_edges?: number;
    original_weight_sum?: number;
    selected_weight_sum?: number;
    preserved_weight_percent?: number;
    is_acyclic?: boolean;
    is_connected?: boolean;
    is_dag?: boolean;
    is_polytree?: boolean;
    is_tree_undirected?: boolean;
    rejected_edges_count?: number;
    max_depth?: number;
    max_depth_reached?: number;
  };
  edges?: PureRamexEdge[];
  warnings?: string[];
};

type PureRamexComparisonRow = {
  Fase?: string;
  Algoritmo?: string;
  Metodo?: string;
  "Nos selecionados"?: number;
  "Arestas selecionadas"?: number;
  "Soma pesos selecionados"?: number;
  "Peso preservado (%)"?: number;
  Aciclico?: boolean | string;
  Conectado?: boolean | string;
  "Raiz ou aresta inicial"?: string;
};

type PureRamexData = {
  ramex2007?: PureRamexResult;
  forward?: PureRamexResult;
  backForward?: PureRamexResult;
  comparisonRows: PureRamexComparisonRow[];
  comparisonMarkdown?: string;
  multidatasetMarkdown?: string;
  missing: string[];
};

const datasets: Record<DatasetId, { label: string; short: string }> = {
  "01": { label: "Dataset 01", short: "D01" },
  "02": { label: "Dataset 02", short: "D02" },
  "03": { label: "Dataset 03", short: "D03" },
};

const showExperimental = process.env.NEXT_PUBLIC_SHOW_EXPERIMENTAL === "true";

const views: Array<{ id: ViewId; label: string; icon: ElementType; description: string }> = [
  { id: "upload", label: "Upload / Nova Análise", icon: FileUp, description: "Centro de Comando e execução assíncrona" },
  { id: "history", label: "Histórico", icon: HistoryIcon, description: "Análises locais e artefactos gerados" },
  { id: "datasets", label: "Datasets de Validação", icon: Grid3X3, description: "Casos estáticos para benchmark" },
  { id: "pipeline", label: "Pipeline RAMEX", icon: GitBranch, description: "Etapas formais do framework" },
  { id: "pure", label: "RAMEX Puro", icon: Network, description: "RAMEX 2007, Forward e Back-and-Forward" },
  { id: "forum", label: "RAMEX-Forum", icon: Sigma, description: "Influência, relações normalizadas e caminhos" },
  { id: "validation", label: "Validação Comparativa", icon: BarChart3, description: "Comparação entre datasets" },
  { id: "reports", label: "Relatórios", icon: Download, description: "Exportação técnica em Markdown/PDF" },
  { id: "demo", label: "Demonstração", icon: Presentation, description: "Navegação guiada da análise" },
  { id: "about", label: "Sobre o RAMEX", icon: BookOpen, description: "Contexto académico e referências" },
  ...(showExperimental
    ? ([
        { id: "matrix", label: "Matriz de Adjacência", icon: Grid3X3, description: "Leitura tabular da transição" },
        { id: "graph", label: "Grafo", icon: Network, description: "Rede completa com amostragem" },
        { id: "ramex", label: "Estrutura RAMEX base", icon: GitBranch, description: "Núcleo selecionado do grafo" },
        { id: "polytree", label: "RAMEX Poly-tree Experimental", icon: GitBranch, description: "Estratégias Top-K e Multiobjetivo" },
        { id: "summary", label: "Resumo Executivo Antigo", icon: Sigma, description: "Consolidação textual da validação" },
      ] as Array<{ id: ViewId; label: string; icon: ElementType; description: string }> )
    : []),
];

const dataPath = (fileName: string) => `/data/${fileName}`;
const API_BASE_URL = process.env.NEXT_PUBLIC_RAMEX_API_URL ?? "http://localhost:8000";

function friendlyApiError(error: unknown): string {
  if (error instanceof TypeError) {
    return `Não foi possível contactar o backend RAMEX em ${API_BASE_URL}. Confirme se o FastAPI está ativo na porta 8000.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro inesperado ao contactar o backend RAMEX.";
}

function findColumn(columns: string[], candidates: string[]): string {
  const normalized = columns.map((column) => ({ original: column, key: column.trim().toLowerCase() }));
  for (const candidate of candidates) {
    const exact = normalized.find((column) => column.key === candidate.toLowerCase());
    if (exact) return exact.original;
  }
  for (const candidate of candidates) {
    const partial = normalized.find((column) => column.key.includes(candidate.toLowerCase()));
    if (partial) return partial.original;
  }
  return "";
}

function inferColumnMapping(columns: string[], datasetType: UploadDatasetType) {
  if (datasetType === "customer_excel") {
    return {
      caseColumn: findColumn(columns, ["Customer ID", "Customer", "Client", "Cliente", "Case ID", "ID"]),
      timeColumn: findColumn(columns, ["Order Date", "Date", "Data", "Order", "Tempo", "Time"]),
      eventColumn: findColumn(columns, ["Category", "Categoria", "Event", "Evento", "Product Name", "Produto"]),
    };
  }

  return {
    caseColumn: findColumn(columns, ["case_id", "Case ID", "Customer ID", "Cliente", "ID"]) || columns[0] || "",
    timeColumn: findColumn(columns, ["order", "Order", "Order Date", "Date", "Data", "Tempo", "Time"]) || columns[1] || "",
    eventColumn: findColumn(columns, ["event", "Event", "Evento", "Category", "Categoria"]) || columns[2] || "",
  };
}

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDecimalInput(value: string, fallback: number): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadCsv<T>(fileName: string, mapper: (row: CsvRow) => T): Promise<T[]> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) {
    throw new Error(`Ficheiro não encontrado: ${fileName}`);
  }

  const text = await response.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Erro ao ler CSV: ${fileName}`);
  }

  return parsed.data.map(mapper);
}

async function loadMatrix(fileName: string): Promise<MatrixData> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) {
    throw new Error(`Ficheiro não encontrado: ${fileName}`);
  }

  const text = await response.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 || parsed.data.length === 0) {
    throw new Error(`Não foi possível ler a matriz: ${fileName}`);
  }

  const columns = parsed.meta.fields ?? Object.keys(parsed.data[0]);
  return { columns, rows: parsed.data };
}

async function loadJson<T>(fileName: string): Promise<T> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) {
    throw new Error(`Ficheiro não encontrado: ${fileName}`);
  }
  return response.json();
}

async function uploadDataset(file: File): Promise<{ job_id: string; filename: string; columns: string[]; message: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail ?? "Erro ao enviar ficheiro.");
  }
  return payload;
}

async function startAnalyzeUploadedDataset(payload: {
  job_id: string;
  dataset_type: UploadDatasetType;
  analysis_type?: AnalysisType;
  case_column?: string;
  time_column?: string;
  event_column?: string;
  min_frequency?: number;
  top_n?: number | null;
  strategy?: PolyTreeStrategy;
  polytree_strategy?: PolyTreeStrategy;
  top_k_per_node?: number;
  max_depth?: number;
  min_weight?: number | null;
  alpha?: number;
  beta?: number;
  gamma?: number;
  delta?: number;
  epsilon?: number;
  zeta?: number;
  preserve_weight_target?: number;
  max_branching?: number;
  min_score?: number;
}): Promise<{ job_id: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/analyze?async_mode=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Erro ao iniciar análise RAMEX assíncrona.");
  }
  return data;
}

async function getJobState(jobId: string): Promise<JobState> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/jobs/${jobId}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Erro ao obter estado do job.");
  }
  return data as JobState;
}

async function getJobResult(jobId: string): Promise<UploadResult | null> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/jobs/${jobId}/result`);
  if (response.status === 202) {
    return null;
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Erro ao obter resultado final do job.");
  }
  return data as UploadResult;
}

async function getHistoryJobs(): Promise<HistoryJob[]> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/history`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Erro ao carregar histórico RAMEX.");
  }
  return data.jobs ?? [];
}

async function getHistoryJobDetail(jobId: string): Promise<HistoryJobDetail> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/history/${jobId}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Erro ao carregar detalhe do histórico.");
  }
  return data as HistoryJobDetail;
}

function edgeMapper(row: CsvRow): Edge {
  return {
    From: String(row.From ?? ""),
    To: String(row.To ?? ""),
    Weight: parseNumber(row.Weight),
    Level: row.Level === undefined ? undefined : parseNumber(row.Level),
  };
}

function polytreeRowMapper(row: CsvRow): PolyTreeTableRow {
  return {
    From: String(row.From ?? ""),
    To: String(row.To ?? ""),
    Weight: parseNumber(row.Weight),
    Level: row.Level === undefined ? undefined : parseNumber(row.Level),
    ParentPath: row.ParentPath,
    Strategy: row.Strategy,
    Score: row.Score === undefined || row.Score === "" ? undefined : parseNumber(row.Score),
    Reason: row.Reason,
  };
}

function validationMapper(row: CsvRow): ValidationRow {
  return {
    Dataset: String(row.Dataset ?? ""),
    Nos_Grafo: parseNumber(row.Nos_Grafo),
    Arestas_Grafo: parseNumber(row.Arestas_Grafo),
    Soma_Pesos_Grafo: parseNumber(row.Soma_Pesos_Grafo),
    Arestas_RAMEX: parseNumber(row.Arestas_RAMEX),
    Soma_Pesos_RAMEX: parseNumber(row.Soma_Pesos_RAMEX),
    Percentagem_Peso_Preservado: parseNumber(row.Percentagem_Peso_Preservado),
    Densidade_Aproximada: parseNumber(row.Densidade_Aproximada),
    Top_5_Transicoes: String(row.Top_5_Transicoes ?? ""),
    Interpretacao: String(row.Interpretacao ?? ""),
  };
}

function pureComparisonMapper(row: CsvRow): PureRamexComparisonRow {
  return {
    Fase: row.Fase,
    Algoritmo: row.Algoritmo,
    Metodo: row.Metodo,
    "Nos selecionados": row["Nos selecionados"] === undefined ? undefined : parseNumber(row["Nos selecionados"]),
    "Arestas selecionadas": row["Arestas selecionadas"] === undefined ? undefined : parseNumber(row["Arestas selecionadas"]),
    "Soma pesos selecionados":
      row["Soma pesos selecionados"] === undefined ? undefined : parseNumber(row["Soma pesos selecionados"]),
    "Peso preservado (%)":
      row["Peso preservado (%)"] === undefined ? undefined : parseNumber(row["Peso preservado (%)"]),
    Aciclico: row.Aciclico,
    Conectado: row.Conectado,
    "Raiz ou aresta inicial": row["Raiz ou aresta inicial"],
  };
}

async function loadOptionalText(fileName: string): Promise<string | undefined> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) return undefined;
  return response.text();
}

function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function sanitizeReportName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "dataset";
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function metricValue(value: unknown, suffix = ""): string {
  if (value === undefined || value === null || value === "") return "Sem dados gerados";
  if (typeof value === "number") return `${Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 2)}${suffix}`;
  return String(value);
}

function historyFileUrl(jobId: string, fileName?: string | null): string | undefined {
  if (!fileName) return undefined;
  return `${API_BASE_URL}/api/ramex/history/${jobId}/file/${fileName.split("/").map(encodeURIComponent).join("/")}`;
}

function formatDateTime(value?: string): string {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function analysisTypeLabel(value: HistoryAnalysisType): string {
  if (value === "pure") return "RAMEX Puro";
  if (value === "forum") return "RAMEX-Forum";
  if (value === "both") return "Both";
  return "Desconhecido";
}

function graphInterpretation(nodes?: number, edges?: number, density?: number, ramexPreserved?: number): string {
  const safeNodes = nodes ?? 0;
  const safeEdges = edges ?? 0;
  const safeDensity = density ?? 0;
  const preserved = ramexPreserved ?? 0;
  const parts = [];

  if (safeDensity >= 0.2 && safeEdges > 1000) {
    parts.push("O grafo apresenta elevada densidade/dispersÃ£o e pode exigir filtragem para leitura visual.");
  } else if (safeNodes >= 50 && safeEdges <= safeNodes * 2) {
    parts.push("O dataset apresenta baixa recorrência, com poucas ligações face ao número de nós.");
  } else if (safeNodes <= 10 && safeEdges > 0) {
    parts.push("O dataset apresenta poucos nós e transições concentradas, favorecendo padrões fortes e interpretáveis.");
  } else {
    parts.push("O grafo apresenta uma estrutura intermédia, devendo ser interpretado em conjunto com pesos e densidade.");
  }

  if (preserved < 20) {
    parts.push("A estrutura RAMEX pura formal preserva apenas parte do comportamento observado.");
  } else {
    parts.push("A estrutura RAMEX representa uma parte significativa do dataset.");
  }

  return parts.join(" ");
}

function buildTechnicalReport(input: {
  datasetName: string;
  origin: string;
  datasetType?: string;
  generatedAt?: Date;
  params?: Record<string, string | number | null | undefined>;
  metrics: {
    sequences?: number;
    nodes?: number;
    edges?: number;
    totalWeight?: number;
    density?: number;
    ramexEdges?: number;
    ramexPreserved?: number;
    polytreeEdges?: number;
    polytreePreserved?: number;
    polytreeAverageScore?: number;
    polytreeInterpretabilityScore?: number;
    root?: string;
    polytreeRoot?: string;
  };
  topTransitions: Edge[];
  polytreeEdges?: PolyTreeTableRow[];
  pureRamex?: ReportData["pureRamex"];
  ramexForum?: ReportData["ramexForum"];
  interpretation?: string;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const params = input.params ?? {};
  const topRows = input.topTransitions.slice(0, 10);
  const dynamicInterpretation =
    input.interpretation ||
    graphInterpretation(input.metrics.nodes, input.metrics.edges, input.metrics.density, input.metrics.ramexPreserved);

  return `# Relatório Técnico — RAMEX Sequential Analysis Framework

## 1. Identificação do dataset

- Nome do dataset: ${input.datasetName}
- Origem: ${input.origin}
- Tipo de dataset: ${input.datasetType || "Não especificado"}
- Data/hora de geração: ${generatedAt.toLocaleString("pt-PT")}
- Frequência mínima: ${metricValue(params.minFrequency)}
- Top N: ${metricValue(params.topN)}

## 2. Objetivo da análise

O objetivo desta análise é transformar dados sequenciais em estruturas interpretáveis através do RAMEX puro, com extração de rede dirigida ponderada, aplicação das fases RAMEX 2007, Forward e Back-and-Forward, e validação estrutural da Poly-tree formal.

## 3. Pipeline executada

1. Sequências;
2. Grafo dirigido ponderado;
3. RAMEX puro;
4. Poly-tree formal;
5. Interpretação automática.

## 4. Métricas principais

- Número de sequências: ${metricValue(input.metrics.sequences)}
- Número de nós: ${metricValue(input.metrics.nodes)}
- Número de arestas: ${metricValue(input.metrics.edges)}
- Soma total dos pesos: ${metricValue(input.metrics.totalWeight)}
- Densidade: ${metricValue(input.metrics.density)}
- Arestas da estrutura RAMEX: ${metricValue(input.metrics.ramexEdges)}
- Peso preservado da estrutura RAMEX: ${metricValue(input.metrics.ramexPreserved, "%")}

## 5. Top transições

| From | To | Weight |
| --- | --- | ---: |
${topRows.length ? topRows.map((edge) => `| ${edge.From} | ${edge.To} | ${formatNumber(edge.Weight)} |`).join("\n") : "| Sem dados gerados | Sem dados gerados | Sem dados gerados |"}

## 6. Interpretação do grafo

${dynamicInterpretation}

## 7. RAMEX Puro

${
  input.pureRamex?.rows?.length
    ? `A secção RAMEX Puro reúne as fases 10A, 10B e 10C, permitindo comparar a extração por Rooted Branching, expansão Forward e expansão Back-and-Forward. A validação formal confirma a estrutura Poly-tree resultante quando esta é acíclica, conectada e compatível com a leitura topológica esperada.

Na comparação entre abordagens RAMEX puras, o melhor algoritmo foi ${metricValue(
        input.pureRamex.bestAlgorithm,
      )}. ${input.pureRamex.summary ?? "A Forward Heuristic tende a gerar a estrutura mais simples e a Back-and-Forward aproxima-se melhor da Poly-tree formal."}

| Algoritmo | Método | Arestas | Peso preservado | Raiz / aresta inicial |
| --- | --- | ---: | ---: | --- |
${input.pureRamex.rows
  .map(
    (row) =>
      `| ${row.algorithm} | ${metricValue(row.method)} | ${metricValue(row.selectedEdges)} | ${metricValue(
        row.preservedWeightPercent,
        "%",
      )} | ${metricValue(row.anchor)} |`,
  )
  .join("\n")}`
    : "Resultados RAMEX puro ainda não foram gerados para este dataset. A estrutura do relatório permanece preparada para integrar as fases 10A, 10B, 10C e a validação formal assim que os artefactos forem produzidos."
}

## 8. Conclusão

${input.ramexForum ? `## 8. RAMEX-Forum

O RAMEX-Forum não substitui o RAMEX Puro. Atua como abordagem complementar para exploração de relações complexas e análise de influência.

- Nó mais influente: ${metricValue(input.ramexForum.metrics?.mostInfluentialNode)}
- Nó mais recebido: ${metricValue(input.ramexForum.metrics?.mostReceivedNode)}
- Relações normalizadas: ${metricValue(input.ramexForum.metrics?.normalizedRelations)}
- Caminho dominante: ${metricValue(input.ramexForum.dominantPath?.join(" -> "))}

` : ""}

O dataset apresenta ${dynamicInterpretation.toLowerCase()} A implementação atual integra o RAMEX puro com RAMEX 2007 Rooted Branching, Forward Heuristic, Back-and-Forward Heuristic e validação formal da Poly-tree. Esta versão está alinhada com os princípios descritos por Cavique (2007, 2015), ao transformar sequências em rede dirigida ponderada e extrair uma estrutura interpretável formalmente validada.

## 9. Referências

- Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007, LNAI 4874, pp. 406â€“414.
- Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees. Advances in Intelligent Systems and Computing, 354, pp. 143â€“153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products. Expert Systems, 34:e12174.
- Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática. Revista de Ciência Elementar, 9(02):041.
`;
}

function edgeToReport(edge: Edge) {
  return {
    from: edge.From,
    to: edge.To,
    weight: edge.Weight,
    level: edge.Level,
  };
}

function pureEdgeToReport(edge: PureRamexEdge) {
  return {
    from: edge.from ?? "",
    to: edge.to ?? "",
    weight: edge.weight ?? 0,
    level: edge.level,
    reason: edge.direction,
  };
}

function pureEdgeToTable(edge: PureRamexEdge): PolyTreeTableRow {
  return {
    From: edge.from ?? "",
    To: edge.to ?? "",
    Weight: edge.weight ?? 0,
    Level: edge.level,
    Reason: edge.direction,
  };
}

function forumToReport(
  data?: RamexForumData | null,
  jobId?: string,
  imageOverrides?: { graph?: string; simplified?: string },
): ReportData["ramexForum"] | undefined {
  if (!data) return undefined;
  return {
    metrics: {
      nodes: data.metrics.nodes,
      edges: data.metrics.edges,
      totalWeight: data.metrics.total_weight,
      normalizedRelations: data.metrics.normalized_relations,
      mostInfluentialNode: data.metrics.most_influential_node,
      mostReceivedNode: data.metrics.most_received_node,
      averageRelativeWeight: data.metrics.average_relative_weight,
    },
    topRelation: {
      from: data.metrics.top_relation?.from,
      to: data.metrics.top_relation?.to,
      weight: data.metrics.top_relation?.weight,
      relativeWeight: data.metrics.top_relation?.relative_weight,
    },
    dominantPath: data.metrics.dominant_path,
    edges: data.influence_graph?.edges?.map((edge) => ({
      from: edge.From,
      to: edge.To,
      weight: edge.Weight,
      relativeWeight: edge.RelativeWeight,
      rank: edge.Rank,
    })),
    simplifiedEdges: data.simplified_influence?.edges?.map((edge) => ({
      from: edge.From,
      to: edge.To,
      weight: edge.Weight,
      relativeWeight: edge.RelativeWeight,
    })),
    interpretation: data.interpretation,
    images: imageOverrides ?? (jobId
      ? {
          graph: data.files?.graph_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.graph_png}`
            : undefined,
          simplified: data.files?.simplified_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.simplified_png}`
            : undefined,
        }
      : undefined),
  };
}

function pureCompletenessError(result?: UploadResult | null): string | undefined {
  if (!result) return undefined;
  if (!result.pure_ramex?.ramex2007 && !result.pure?.ramex2007) {
    return "Output RAMEX Puro incompleto: ficheiro ramex2007 JSON não encontrado";
  }
  if (!result.pure_ramex?.forward && !result.pure?.forward) {
    return "Output RAMEX Puro incompleto: ficheiro forward JSON não encontrado";
  }
  if (!result.pure_ramex?.backForward && !result.pure?.back_forward_formal && !result.formal_polytree) {
    return "Output RAMEX Puro incompleto: ficheiro back_forward_formal JSON não encontrado";
  }
  if (!result.pure_validation && !result.pure?.validation) {
    return "Output RAMEX Puro incompleto: ficheiro validacao_ramex_puro JSON não encontrado";
  }
  return undefined;
}

function forumCompletenessError(result?: UploadResult | null): string | undefined {
  const forum = result?.ramex_forum ?? result?.forum;
  if (!forum?.metrics) {
    return "Output RAMEX-Forum incompleto: ficheiro ramex_forum_metrics.json não encontrado";
  }
  if (!forum.files?.graph_png) {
    return "Output RAMEX-Forum incompleto: ficheiro ramex_forum_graph.png não encontrado";
  }
  if (!forum.files?.simplified_png) {
    return "Output RAMEX-Forum incompleto: ficheiro ramex_forum_simplified.png não encontrado";
  }
  return undefined;
}

function reportCompletenessError(result?: UploadResult | null): string | undefined {
  if (!result) return undefined;
  const type = result.analysis_type ?? "pure";
  if (type === "pure" || type === "both") {
    const pureError = pureCompletenessError(result);
    if (pureError) return pureError;
  }
  if (type === "forum" || type === "both") {
    const forumError = forumCompletenessError(result);
    if (forumError) return forumError;
  }
  return undefined;
}

function pure_anchor_frontend(payload?: PureRamexResult): string | undefined {
  if (!payload) return undefined;
  if (payload.root) return payload.root;
  if (payload.initial_edge) return `${payload.initial_edge.from} -> ${payload.initial_edge.to}`;
  return undefined;
}

function polytreeEdgeToReport(edge: PolyTreeTableRow) {
  return {
    from: edge.From,
    to: edge.To,
    weight: edge.Weight,
    level: edge.Level,
    strategy: edge.Strategy,
    score: edge.Score,
    reason: edge.Reason,
  };
}

function polytreeRowsFromData(data?: PolyTreeData, rows: PolyTreeTableRow[] = []): PolyTreeTableRow[] {
  const jsonRows =
    data?.edges.map((edge) => ({
      From: edge.from,
      To: edge.to,
      Weight: edge.weight,
      Level: edge.level,
      Strategy: edge.strategy ?? data.strategy,
      Score: typeof edge.score === "number" ? edge.score : undefined,
      Reason: edge.reason,
    })) ?? [];

  if (rows.length === 0) return jsonRows;

  return rows.map((row) => {
    const match = jsonRows.find(
      (edge) => edge.From === row.From && edge.To === row.To && edge.Level === row.Level,
    );
    return {
      ...row,
      Strategy: row.Strategy ?? match?.Strategy,
      Score: row.Score ?? match?.Score,
      Reason: row.Reason ?? match?.Reason,
    };
  });
}

function pureRamexRowsForReport(data?: PureRamexData) {
  return (data?.comparisonRows ?? []).map((row) => ({
    algorithm: row.Algoritmo ?? "Sem dados gerados",
    method: row.Metodo,
    selectedEdges: row["Arestas selecionadas"],
    preservedWeightPercent: row["Peso preservado (%)"],
    anchor: row["Raiz ou aresta inicial"],
  }));
}

function pureRamexBest(data?: PureRamexData): string | undefined {
  const best = [...(data?.comparisonRows ?? [])].sort(
    (a, b) => (b["Peso preservado (%)"] ?? 0) - (a["Peso preservado (%)"] ?? 0),
  )[0];
  return best?.Algoritmo;
}

function pureRamexStructuralType(validation?: ValidationRow, data?: PureRamexData): string {
  const density = validation?.Densidade_Aproximada ?? 0;
  const nodes = validation?.Nos_Grafo ?? 0;
  const ramex2007 = data?.ramex2007?.metrics?.preserved_weight_percent ?? 0;

  if (nodes <= 10 && density > 0.7) return "grafo pequeno e completo";
  if (density < 0.05 && ramex2007 > 80) return "grafo quase linear / sequencial";
  if (density > 0.7) return "grafo denso / altamente conectado";
  return "grafo de estrutura intermédia";
}

function pureRamexStructuralInterpretation(structuralType: string): string {
  if (structuralType === "grafo denso / altamente conectado") {
    return "Em grafos densos, todos os métodos são obrigados a condensar uma grande quantidade de transições numa estrutura acíclica reduzida. Por isso, a percentagem de peso preservado tende a ser baixa e as diferenças entre métodos podem ser marginais.";
  }
  if (structuralType === "grafo quase linear / sequencial") {
    return "Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.";
  }
  if (structuralType === "grafo pequeno e completo") {
    return "Em grafos pequenos e totalmente conectados, a diferença entre métodos tende a ser reduzida, uma vez que quase todas as transições são estruturalmente relevantes.";
  }
  return "Em grafos de estrutura intermédia, a interpretação deve equilibrar cobertura de peso, simplicidade e preservação estrutural.";
}

function pureRamexSimplestLabels(data?: PureRamexData): string {
  const rows = data?.comparisonRows ?? [];
  if (rows.length === 0) return "Sem dados gerados";
  const edgeCounts = rows.map((row) => row["Arestas selecionadas"]).filter((value): value is number => typeof value === "number");
  if (edgeCounts.length === 0) return "Sem dados gerados";
  const minEdges = Math.min(...edgeCounts);
  return rows
    .filter((row) => row["Arestas selecionadas"] === minEdges)
    .map((row) => row.Algoritmo ?? "Sem dados gerados")
    .join(", ");
}

function pureRamexScientificSummary(validation?: ValidationRow, data?: PureRamexData): string {
  const structuralType = pureRamexStructuralType(validation, data);
  return `Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo. Tipo estrutural do dataset: ${structuralType}. ${pureRamexStructuralInterpretation(structuralType)}`;
}

function datasetLabelToId(label: string): DatasetId | undefined {
  if (label.includes("01")) return "01";
  if (label.includes("02")) return "02";
  if (label.includes("03")) return "03";
  return undefined;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-slate-200/60 bg-white/90 p-8 text-center shadow-2xl shadow-slate-300/30 backdrop-blur-xl">
      <div className="max-w-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-cyan-200 shadow-lg shadow-slate-900/30">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xl font-semibold tracking-tight text-slate-950">Nenhum artefacto disponível</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-3 text-left text-xs text-slate-500">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-700">Ação recomendada</p>
          <p className="mt-1">Execute a análise no Centro de Comando para gerar gráficos, tabelas e relatório técnico.</p>
          <p className="mt-2 font-mono">Exemplo de ficheiro: sequencias_dataset03.csv</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-2xl shadow-slate-300/20 ring-1 ring-white/70 backdrop-blur-xl"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 break-words font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-950 lg:text-4xl">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p> : <p className="mt-1 text-xs leading-5 text-slate-500">Métrica analítica derivada da pipeline RAMEX.</p>}
      <div className="mt-4 h-1.5 rounded-full bg-slate-100">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
      </div>
      <svg viewBox="0 0 120 24" className="mt-3 h-6 w-full text-cyan-600/70">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points="0,18 14,16 28,12 40,15 56,10 70,13 82,8 94,11 108,7 120,9"
        />
      </svg>
    </motion.div>
  );
}

function WarningPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 text-sm leading-6 text-amber-950 shadow-lg shadow-amber-200/50 backdrop-blur-md">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/80 p-4 text-sm leading-6 text-slate-700 shadow-lg shadow-cyan-100/50 backdrop-blur-md">
      {children}
    </div>
  );
}

function ReportButton({
  disabled,
  onClick,
  label = "Gerar resumo técnico (MD)",
}: {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-600/30 transition hover:from-cyan-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}

function MatrixTable({ matrix, datasetId }: { matrix?: MatrixData; datasetId: DatasetId }) {
  if (!matrix) {
    return <EmptyState message="A matriz ainda não foi carregada." />;
  }

  const maxRows = 18;
  const maxColumns = 18;
  const visibleColumns = matrix.columns.slice(0, maxColumns);
  const visibleRows = matrix.rows.slice(0, maxRows);
  const isLarge = matrix.rows.length > maxRows || matrix.columns.length > maxColumns;

  return (
    <div className="space-y-4">
      {datasetId === "01" ? (
        <WarningPanel>
          O Dataset 01 é muito denso. A tabela abaixo mostra apenas uma amostra inicial para manter a leitura estável.
        </WarningPanel>
      ) : null}
      {isLarge ? (
        <WarningPanel>
          Matriz grande: a visualização foi limitada a {visibleRows.length} linhas e {visibleColumns.length} colunas.
        </WarningPanel>
      ) : null}
      <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-md scrollbar-thin">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs uppercase tracking-[0.14em] text-slate-600 backdrop-blur">
            <tr>
              {visibleColumns.map((column) => (
                <th key={column} className="border-b border-slate-200 px-3 py-3 text-left">
                  {column || "Origem"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={`${String(row[visibleColumns[0]])}-${index}`}
                className="odd:bg-white/70 even:bg-slate-50/80 hover:bg-sky-50/60"
              >
                {visibleColumns.map((column) => (
                  <td key={column} className="border-b border-slate-100 px-3 py-2 font-mono text-slate-700 tabular-nums">
                    {String(row[column] ?? "0")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GraphCanvas({
  edges,
  root,
  denseHint,
  heightClass = "h-[28rem]",
}: {
  edges: Edge[];
  root?: string;
  denseHint?: boolean;
  heightClass?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const graph = useMemo(() => {
    const nodeSet = new Set<string>();
    const degree = new Map<string, { in: number; out: number; weight: number }>();
    edges.forEach((edge) => {
      nodeSet.add(edge.From);
      nodeSet.add(edge.To);
      degree.set(edge.From, {
        in: degree.get(edge.From)?.in ?? 0,
        out: (degree.get(edge.From)?.out ?? 0) + 1,
        weight: (degree.get(edge.From)?.weight ?? 0) + edge.Weight,
      });
      degree.set(edge.To, {
        in: (degree.get(edge.To)?.in ?? 0) + 1,
        out: degree.get(edge.To)?.out ?? 0,
        weight: (degree.get(edge.To)?.weight ?? 0) + edge.Weight,
      });
    });

    const nodes = Array.from(nodeSet).slice(0, denseHint ? 80 : 140);
    const nodeIndex = new Map(nodes.map((node, index) => [node, index]));
    const visibleEdges = edges
      .filter((edge) => nodeIndex.has(edge.From) && nodeIndex.has(edge.To))
      .slice(0, denseHint ? 120 : 220);

    const width = 700;
    const height = 860;
    const radius = Math.min(width, height) * 0.42;
    const centerX = width / 2;
    const centerY = height / 2;

    const points = nodes.map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    const pointMap = new Map(points.map((point) => [point.id, point]));
    const maxWeight = Math.max(...visibleEdges.map((edge) => edge.Weight), 1);

    return { points, pointMap, visibleEdges, maxWeight, width, height, hidden: edges.length - visibleEdges.length, degree };
  }, [denseHint, edges]);

  if (edges.length === 0) {
    return <EmptyState message="Não existem arestas disponíveis para este grafo." />;
  }

  return (
    <div className="space-y-3">
      {denseHint ? (
        <WarningPanel>
          Grafo muito denso: a visualização interativa mostra uma amostra das arestas. Para análise fina, use versões filtradas ou top N.
        </WarningPanel>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/80 p-3 shadow-xl shadow-slate-200/50 backdrop-blur-md">
        <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className={`${heightClass} w-full`}>
          <defs>
            <marker id="arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path d="M0,0 L8,4 L0,8 Z" fill="#315f72" />
            </marker>
            <filter id="rootGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {graph.visibleEdges.map((edge, index) => {
            const from = graph.pointMap.get(edge.From);
            const to = graph.pointMap.get(edge.To);
            if (!from || !to) return null;
            const key = `${edge.From}-${edge.To}-${index}`;
            const strokeWidth = 0.7 + (edge.Weight / graph.maxWeight) * 4.8;
            const opacity = 0.1 + (edge.Weight / graph.maxWeight) * 0.8;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const curve = 0.16;
            const controlX = midX - dy * curve;
            const controlY = midY + dx * curve;
            const labelX = (from.x + 2 * controlX + to.x) / 4;
            const labelY = (from.y + 2 * controlY + to.y) / 4;
            const active = hovered === key;
            return (
              <g
                key={key}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default"
              >
                <path
                  d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
                  fill="none"
                  stroke={active ? "#c8914b" : "#315f72"}
                  strokeOpacity={active ? 0.95 : denseHint ? Math.min(opacity, 0.34) : opacity}
                  strokeWidth={active ? strokeWidth + 1.6 : strokeWidth}
                  markerEnd="url(#arrow)"
                />
                {(!denseHint || active) && graph.visibleEdges.length <= 90 ? (
                  <g>
                    <rect
                      x={labelX - 15}
                      y={labelY - 10}
                      width="30"
                      height="18"
                      rx="6"
                      fill="rgba(255,255,255,0.86)"
                      stroke="#dbe4ea"
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      textAnchor="middle"
                      className="fill-slate-700 font-mono text-[10px] font-semibold"
                    >
                      {formatNumber(edge.Weight)}
                    </text>
                  </g>
                ) : null}
                {active ? (
                  <foreignObject x={labelX + 12} y={labelY - 44} width="180" height="46">
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg">
                      <div className="font-semibold text-slate-950">{edge.From} → {edge.To}</div>
                      <div className="font-mono tabular-nums">peso: {formatNumber(edge.Weight)}</div>
                    </div>
                  </foreignObject>
                ) : null}
              </g>
            );
          })}
          {graph.points.map((point) => {
            const isRoot = root === point.id;
            const degree = graph.degree.get(point.id);
            const nodeWeight = degree?.weight ?? 0;
            const maxNodeWeight = Math.max(...Array.from(graph.degree.values()).map((item) => item.weight), 1);
            const radius = isRoot ? 18 : 11 + (nodeWeight / maxNodeWeight) * 7;
            return (
              <g key={point.id} className="group">
                {isRoot ? <circle cx={point.x} cy={point.y} r="28" fill="#f0c984" opacity="0.34" className="ramex-pulse" /> : null}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={isRoot ? "#c8914b" : "#dce9ee"}
                  stroke={isRoot ? "#8a5a1c" : "#315f72"}
                  strokeWidth={isRoot ? "2.4" : "1.6"}
                  filter={isRoot ? "url(#rootGlow)" : undefined}
                />
                <text
                  x={point.x}
                  y={point.y - radius - 8}
                  textAnchor="middle"
                  className="fill-slate-800 text-[10px] font-semibold"
                >
                  {point.id}
                </text>
                <title>{`${point.id} | in: ${degree?.in ?? 0} | out: ${degree?.out ?? 0} | peso: ${formatNumber(nodeWeight)}`}</title>
              </g>
            );
          })}
        </svg>
        {graph.hidden > 0 ? (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            {graph.hidden} arestas foram omitidas nesta visualização para preservar legibilidade.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PolyTreeCanvas({ data }: { data: PolyTreeData }) {
  const graph = useMemo(() => {
    const levels = new Map<number, Array<{ id: string; level: number }>>();
    data.nodes.forEach((node) => {
      const levelNodes = levels.get(node.level) ?? [];
      levelNodes.push(node);
      levels.set(node.level, levelNodes);
    });

    const width = 920;
    const height = 520;
    const maxLevel = Math.max(...data.nodes.map((node) => node.level), 1);
    const pointMap = new Map<string, { x: number; y: number }>();

    Array.from(levels.entries()).forEach(([level, nodes]) => {
      nodes.forEach((node, index) => {
        pointMap.set(node.id, {
          x: 80 + (level / Math.max(maxLevel, 1)) * (width - 160),
          y: ((index + 1) / (nodes.length + 1)) * (height - 80) + 40,
        });
      });
    });

    const maxWeight = Math.max(...data.edges.map((edge) => edge.weight), 1);
    return { width, height, pointMap, maxWeight };
  }, [data]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-panel">
      <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="h-[28rem] w-full">
        <defs>
          <marker id="polytree-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path d="M0,0 L8,4 L0,8 Z" fill="#55606f" />
          </marker>
        </defs>
        {data.edges.map((edge, index) => {
          const from = graph.pointMap.get(edge.from);
          const to = graph.pointMap.get(edge.to);
          if (!from || !to) return null;
          const strokeWidth = 0.8 + (edge.weight / graph.maxWeight) * 4;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.level}-${index}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#55606f"
                strokeOpacity="0.52"
                strokeWidth={strokeWidth}
                markerEnd="url(#polytree-arrow)"
              />
              <text x={midX} y={midY - 6} textAnchor="middle" className="fill-slate-600 text-[10px] font-semibold">
                {formatNumber(edge.weight)}
              </text>
            </g>
          );
        })}
        {data.nodes.map((node) => {
          const point = graph.pointMap.get(node.id);
          if (!point) return null;
          const isRoot = node.id === data.root;
          return (
            <g key={node.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isRoot ? 18 : 14}
                fill={isRoot ? "#c8914b" : "#dce9ee"}
                stroke={isRoot ? "#8a5a1c" : "#315f72"}
                strokeWidth="1.6"
              />
              <text x={point.x} y={point.y - 22} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                {node.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PolyTreeTable({ rows }: { rows: PolyTreeTableRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="Não existem linhas CSV disponíveis para a poly-tree." />;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-md scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs uppercase tracking-[0.14em] text-slate-600 backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left">From</th>
            <th className="px-3 py-2 text-left">To</th>
            <th className="px-3 py-2 text-right">Weight</th>
            <th className="px-3 py-2 text-right">Level</th>
            <th className="px-3 py-2 text-left">Strategy</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.From}-${row.To}-${row.Level}-${index}`} className="border-t border-slate-100">
              <td className="px-3 py-3 font-medium text-ink">{row.From}</td>
              <td className="px-3 py-3 text-slate-700">{row.To}</td>
              <td className="px-3 py-3 text-right">{formatNumber(row.Weight)}</td>
              <td className="px-3 py-3 text-right">{row.Level ?? "-"}</td>
              <td className="px-3 py-3 text-slate-600">{row.Strategy ?? "-"}</td>
              <td className="px-3 py-3 text-right">{row.Score === undefined ? "-" : row.Score.toFixed(3)}</td>
              <td className="px-3 py-3 text-slate-600">{row.Reason ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolyTreePanel({
  data,
  rows,
  error,
}: {
  data?: PolyTreeData;
  rows: PolyTreeTableRow[];
  error?: string;
}) {
  if (!data && rows.length === 0) {
    return <EmptyState message={error || "Poly-tree ainda não gerado para este dataset."} />;
  }

  const maxDepth = data?.metrics.max_depth ?? Math.max(...rows.map((row) => row.Level ?? 0), 0);
  const tableRows = polytreeRowsFromData(data, rows);
  const strategy = data?.strategy ?? data?.metrics.strategy ?? tableRows[0]?.Strategy ?? "top-k";
  const strategyLabel = strategy === "multiobjective" ? "Multiobjetivo" : "Top-K";

  return (
    <section className="space-y-5">
      {data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Raiz" value={data.root} />
          <MetricCard label="Estratégia" value={strategyLabel} />
          <MetricCard label="Nós poly-tree" value={formatNumber(data.metrics.polytree_nodes)} />
          <MetricCard label="Arestas poly-tree" value={formatNumber(data.metrics.polytree_edges)} />
          <MetricCard label="Peso preservado" value={`${data.metrics.preserved_weight_percent.toFixed(2)}%`} />
          <MetricCard label="Profundidade máxima" value={formatNumber(maxDepth)} />
        </div>
      ) : (
        <WarningPanel>Poly-tree ainda não gerado para este dataset. A tabela será apresentada se o CSV existir.</WarningPanel>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {data ? <PolyTreeCanvas data={data} /> : null}
          <PolyTreeTable rows={tableRows} />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-thesis/20 bg-thesis/5 p-5 shadow-panel">
            <h3 className="text-lg font-semibold text-ink">RAMEX Poly-tree</h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              O RAMEX Poly-tree preserva múltiplos ramos relevantes, permitindo uma visão mais rica dos padrões
              sequenciais do que a árvore simplificada.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              As duas estratégias podem produzir estrutura semelhante quando o dataset é pequeno, denso e com poucas
              alternativas estruturais; em datasets maiores, a Multiobjetivo tende a diferenciar-se por score composto.
            </p>
            <div className="mt-4 rounded-lg border border-thesis/10 bg-white/70 p-3 text-xs leading-6 text-slate-600">
              <p>
                Estratégia usada: <span className="font-semibold text-thesis">{strategyLabel}</span>
              </p>
              <p>
                Score médio:{" "}
                {typeof data?.metrics.average_score !== "number"
                  ? "Sem dados gerados"
                  : data.metrics.average_score.toFixed(3)}
              </p>
              <p>
                Interpretability score:{" "}
                {data?.metrics.interpretability_score === undefined
                  ? "Sem dados gerados"
                  : `${data.metrics.interpretability_score.toFixed(2)}%`}
              </p>
            </div>
            {data?.parameters ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600">
                {Object.entries(data.parameters).map(([key, value]) => (
                  <p key={key}>
                    {key}: <span className="font-medium text-slate-800">{String(value ?? "Sem dados gerados")}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <h4 className="font-semibold text-ink">Top-K</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>seleciona as transições mais fortes por nó</li>
                <li>simples e transparente</li>
                <li>fácil de explicar em contexto acadêmico</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <h4 className="font-semibold text-ink">Multiobjetivo</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>combina peso e probabilidade local</li>
                <li>considera cobertura, centralidade e legibilidade</li>
                <li>seleciona ramos mais informativos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PureRamexTable({ rows }: { rows: PureRamexEdge[] }) {
  if (rows.length === 0) {
    return <EmptyState message="Tabela de arestas ainda não gerada para este método." />;
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">From</th>
            <th className="px-3 py-2 text-left">To</th>
            <th className="px-3 py-2 text-right">Weight</th>
            <th className="px-3 py-2 text-right">Level</th>
            <th className="px-3 py-2 text-left">Direction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.from}-${row.to}-${index}`} className="border-t border-slate-100 odd:bg-white/70 even:bg-slate-50/80 hover:bg-sky-50/60">
              <td className="px-3 py-3 font-medium text-ink">{row.from ?? "-"}</td>
              <td className="px-3 py-3 text-slate-700">{row.to ?? "-"}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.weight ?? 0)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{row.level ?? "-"}</td>
              <td className="px-3 py-3 text-slate-600">{row.direction ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PureRamexMethodPanel({
  title,
  description,
  data,
  imageFile,
  imageUrl,
}: {
  title: string;
  description: string;
  data?: PureRamexResult;
  imageFile?: string;
  imageUrl?: string;
}) {
  if (!data) {
    return <EmptyState message={`${title} ainda não gerado para este dataset.`} />;
  }

  const metrics = data.metrics ?? {};
  const anchor = data.root
    ? data.root
    : data.initial_edge
      ? `${data.initial_edge.from} → ${data.initial_edge.to} (${formatNumber(data.initial_edge.weight ?? 0)})`
      : "Sem dados gerados";
  const forwardCount = data.edges?.filter((edge) => edge.direction === "FORWARD").length ?? 0;
  const backwardCount = data.edges?.filter((edge) => edge.direction === "BACKWARD").length ?? 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/50 bg-white/75 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={data.root ? "Raiz" : "Aresta inicial"} value={anchor} />
        <MetricCard label="Nós originais" value={formatNumber(metrics.original_nodes ?? 0)} />
        <MetricCard label="Arestas originais" value={formatNumber(metrics.original_edges ?? 0)} />
        <MetricCard label="Arestas selecionadas" value={formatNumber(metrics.selected_edges ?? 0)} />
        <MetricCard label="Peso preservado" value={`${(metrics.preserved_weight_percent ?? 0).toFixed(2)}%`} />
        <MetricCard label="Método" value={data.method ?? data.algorithm} />
        <MetricCard label="Acíclico" value={metrics.is_acyclic === undefined ? "Sem dados gerados" : String(metrics.is_acyclic)} />
        <MetricCard label="Conectado" value={metrics.is_connected === undefined ? "Sem dados gerados" : String(metrics.is_connected)} />
        <MetricCard label="Forward" value={formatNumber(forwardCount)} />
        <MetricCard label="Backward" value={formatNumber(backwardCount)} />
      </div>
      {data.warnings?.length ? (
        <WarningPanel>{data.warnings.join(" ")}</WarningPanel>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {imageUrl || imageFile ? (
          <img
            src={imageUrl ?? dataPath(imageFile ?? "")}
            alt={title}
            className="max-h-[32rem] w-full rounded-2xl border border-white/50 bg-white/80 object-contain p-3 shadow-xl shadow-slate-200/50 backdrop-blur-md"
          />
        ) : (
          <EmptyState message="Imagem ainda não disponível para este método." />
        )}
        <PureRamexTable rows={data.edges ?? []} />
      </div>
    </section>
  );
}

function PureComparisonPanel({
  data,
  datasetId,
  validation,
}: {
  data?: PureRamexData;
  datasetId: DatasetId;
  validation?: ValidationRow;
}) {
  const rows = data?.comparisonRows ?? [];
  if (!data || rows.length === 0) {
    return <EmptyState message="Validação RAMEX puro ainda não gerada para este dataset." />;
  }

  const chartRows = rows.map((row) => ({
    algoritmo: (row.Algoritmo ?? "").replace("RAMEX ", "").replace(" Heuristic", ""),
    peso: row["Peso preservado (%)"] ?? 0,
    arestas: row["Arestas selecionadas"] ?? 0,
  }));
  const best = [...rows].sort((a, b) => (b["Peso preservado (%)"] ?? 0) - (a["Peso preservado (%)"] ?? 0))[0];
  const structuralType = pureRamexStructuralType(validation, data);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-thesis/20 bg-thesis/5 p-5 shadow-panel">
        <p className="text-sm font-semibold text-thesis">Maior peso preservado</p>
        <p className="mt-2 text-2xl font-semibold text-ink">
          {best?.Algoritmo ?? "Sem dados gerados"} {best?.["Peso preservado (%)"] !== undefined ? `(${best["Peso preservado (%)"].toFixed(2)}%)` : ""}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho depende da densidade,
          linearidade e diversidade de transições do grafo.
        </p>
        <p className="mt-2 text-sm font-semibold text-thesis">Tipo estrutural do dataset: {structuralType}</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{pureRamexStructuralInterpretation(structuralType)}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-ink">Peso preservado por algoritmo</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="algoritmo" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="peso" name="Peso preservado (%)" fill="#315f72" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-ink">Arestas selecionadas por algoritmo</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="algoritmo" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="arestas" name="Arestas" fill="#c8914b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white scrollbar-thin">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Algoritmo</th>
              <th className="px-3 py-2 text-left">Método</th>
              <th className="px-3 py-2 text-right">Nós</th>
              <th className="px-3 py-2 text-right">Arestas</th>
              <th className="px-3 py-2 text-right">Peso preservado</th>
              <th className="px-3 py-2 text-left">Raiz / aresta inicial</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.Fase}-${row.Algoritmo}`} className="border-t border-slate-100">
                <td className="px-3 py-3 font-medium text-ink">{row.Algoritmo}</td>
                <td className="px-3 py-3 text-slate-700">{row.Metodo}</td>
                <td className="px-3 py-3 text-right">{row["Nos selecionados"] ?? "-"}</td>
                <td className="px-3 py-3 text-right">{row["Arestas selecionadas"] ?? "-"}</td>
                <td className="px-3 py-3 text-right">{row["Peso preservado (%)"]?.toFixed(2) ?? "-"}%</td>
                <td className="px-3 py-3 text-slate-600">{row["Raiz ou aresta inicial"] ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100 scrollbar-thin">
        {data.comparisonMarkdown ?? "Interpretação Markdown ainda não gerada."}
      </pre>
      {data.multidatasetMarkdown ? (
        <pre className="max-h-[20rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs leading-6 text-slate-100 scrollbar-thin">
          {data.multidatasetMarkdown}
        </pre>
      ) : null}
    </section>
  );
}

function RamexPurePanel({
  datasetId,
  data,
  uploaded,
  validation,
}: {
  datasetId: DatasetId;
  data?: PureRamexData;
  uploaded?: UploadResult | null;
  validation?: ValidationRow;
}) {
  const [tab, setTab] = useState<"overview" | "ramex2007" | "forward" | "backforward" | "comparison">("overview");
  const uploadedPure: PureRamexData | undefined = uploaded?.pure_ramex
    ? {
        ...uploaded.pure_ramex,
        comparisonRows: uploaded.pure_ramex.comparisonRows ?? [],
        comparisonMarkdown: uploaded.pure_ramex.comparisonMarkdown,
        multidatasetMarkdown: uploaded.pure_ramex.multidatasetMarkdown,
        missing: uploaded.pure_ramex.missing ?? [],
      }
    : uploaded?.pure
      ? {
          ramex2007: uploaded.pure.ramex2007,
          forward: uploaded.pure.forward,
          backForward: uploaded.pure.back_forward_formal,
          comparisonRows: [],
          comparisonMarkdown: uploaded.pure.validation?.summary,
          multidatasetMarkdown: "",
          missing: [],
        }
      : undefined;
  const effectiveData = uploadedPure ?? data;
  const uploadedValidation = uploaded
    ? ({
        Dataset: `Upload: ${uploaded.filename}`,
        Nos_Grafo: uploaded.metrics.nodes,
        Arestas_Grafo: uploaded.metrics.edges,
        Soma_Pesos_Grafo: uploaded.metrics.total_weight,
        Arestas_RAMEX: uploaded.metrics.ramex_edges,
        Soma_Pesos_RAMEX: uploaded.metrics.ramex_weight,
        Percentagem_Peso_Preservado: uploaded.metrics.preserved_percentage,
        Densidade_Aproximada: uploaded.metrics.density,
        Top_5_Transicoes: "",
        Interpretacao: uploaded.interpretation,
      } satisfies ValidationRow)
    : validation;

  const available = [effectiveData?.ramex2007, effectiveData?.forward, effectiveData?.backForward].filter(Boolean).length;
  const rows = effectiveData?.comparisonRows ?? [];
  const best = [...rows].sort((a, b) => (b["Peso preservado (%)"] ?? 0) - (a["Peso preservado (%)"] ?? 0))[0];
  const simplestLabel = pureRamexSimplestLabels(effectiveData);
  const polyLike = effectiveData?.backForward;
  const structuralType = uploaded?.pure_validation?.structural_type ?? pureRamexStructuralType(uploadedValidation, effectiveData);
  const imageBase = uploaded ? `${API_BASE_URL}/api/file/${uploaded.job_id}/` : undefined;

  const tabs = [
    ["overview", "Visão Geral"],
    ["ramex2007", "RAMEX 2007"],
    ["forward", "Forward"],
    ["backforward", "Back-and-Forward"],
    ["comparison", "Comparação"],
  ] as const;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Linha principal</p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">RAMEX Puro</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Esta seção apresenta as implementações mais próximas do RAMEX original, separadas das heurísticas experimentais. O objetivo é comparar abordagens baseadas em rooted branching, expansão forward e expansão back-and-forward.
        </p>
        <button
          disabled
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          <Play className="h-4 w-4" />
          Executar RAMEX Puro
        </button>
        <p className="mt-2 text-xs text-slate-500">Execução RAMEX puro ainda disponível apenas via scripts.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              tab === id ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "border-slate-200 bg-white/80 text-slate-700 hover:border-amber-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
      {tab === "overview" ? (
        <motion.section key="pure-overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
          {available === 0 ? <WarningPanel>Resultados RAMEX puro ainda não gerados para este dataset.</WarningPanel> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Dataset selecionado" value={datasets[datasetId].label} />
            <MetricCard label="Algoritmos disponíveis" value={formatNumber(available)} />
            <MetricCard label="Maior peso preservado" value={best?.Algoritmo ?? "Sem dados gerados"} />
            <MetricCard label="Peso preservado máximo" value={best?.["Peso preservado (%)"] !== undefined ? `${best["Peso preservado (%)"].toFixed(2)}%` : "Sem dados gerados"} />
            <MetricCard label="Tipo estrutural" value={structuralType} />
            <MetricCard label="Método(s) mais simples" value={simplestLabel} />
            <MetricCard label="Mais próximo da Poly-tree" value={polyLike?.algorithm ?? "Sem dados gerados"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">RAMEX Puro</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                A linha principal da framework passa a distinguir as implementações RAMEX puras das extensões exploratórias.
                A comparação permite justificar cientificamente a escolha entre rooted branching, forward e back-and-forward,
                sem assumir um algoritmo universalmente superior.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {uploaded?.pure_validation?.summary ?? pureRamexScientificSummary(uploadedValidation, effectiveData)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">Extensões complementares</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                O RAMEX-Forum é apresentado em aba própria como complemento de análise de influência, mantendo o RAMEX Puro como linha principal.
              </p>
            </div>
          </div>
        </motion.section>
      ) : null}

      {tab === "ramex2007" ? (
        <motion.div key="pure-2007" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX 2007 Rooted Branching"
          description="O RAMEX 2007 Rooted Branching representa a versão base, baseada na transformação da sequência em rede e na extração de uma árvore enraizada de peso máximo."
          data={effectiveData?.ramex2007}
          imageFile={uploaded ? undefined : `ramex2007_dataset${datasetId}.png`}
          imageUrl={uploaded?.files.ramex2007_png ? `${imageBase}${uploaded.files.ramex2007_png}` : undefined}
        />
        </motion.div>
      ) : null}
      {tab === "forward" ? (
        <motion.div key="pure-forward" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX Forward Heuristic"
          description="A Forward Heuristic é adequada quando existe uma raiz conhecida. Expande a estrutura para a frente, escolhendo transições de maior peso para novos nós."
          data={effectiveData?.forward}
          imageFile={uploaded ? undefined : `ramex_forward_dataset${datasetId}.png`}
          imageUrl={uploaded?.files.forward_png ? `${imageBase}${uploaded.files.forward_png}` : undefined}
        />
        </motion.div>
      ) : null}
      {tab === "backforward" ? (
        <motion.div key="pure-backforward" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX Back-and-Forward Heuristic"
          description="A Back-and-Forward Heuristic não depende de uma raiz explícita. Começa pela transição mais forte e expande em ambos os sentidos, aproximando-se melhor da ideia de Poly-tree RAMEX."
          data={effectiveData?.backForward}
          imageFile={uploaded ? undefined : `ramex_back_forward_dataset${datasetId}.png`}
          imageUrl={uploaded?.files.back_forward_formal_png ? `${imageBase}${uploaded.files.back_forward_formal_png}` : undefined}
        />
        </motion.div>
      ) : null}
      {tab === "comparison" ? (
        <motion.div key="pure-comparison" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <PureComparisonPanel data={effectiveData} datasetId={datasetId} validation={uploadedValidation} />
        </motion.div>
      ) : null}
      </AnimatePresence>
    </section>
  );
}

function RamexForumPanel({
  data,
  jobId,
  graphImage,
  simplifiedImage: staticSimplifiedImage,
}: {
  data?: RamexForumData | null;
  jobId?: string;
  graphImage?: string;
  simplifiedImage?: string;
}) {
  if (!data) {
    return (
      <EmptyState message="Resultados RAMEX-Forum ainda não disponíveis. Execute a análise como RAMEX-Forum ou RAMEX Puro + RAMEX-Forum." />
    );
  }

  const metrics = data.metrics ?? {};
  const edges = data.influence_graph?.edges ?? [];
  const simplified = data.simplified_influence?.edges ?? [];
  const centralNodes = data.path_analysis?.central_nodes ?? [];
  const topRelation = metrics.top_relation;
  const dominantPath = metrics.dominant_path?.join(" → ") || "Sem dados gerados";
  const forumImage = graphImage ?? (jobId && data.files?.graph_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.graph_png}`
    : undefined);
  const simplifiedImage = staticSimplifiedImage ?? (jobId && data.files?.simplified_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.simplified_png}`
    : undefined);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-teal-50 p-6 shadow-2xl shadow-cyan-200/40 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Influence Mode</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">RAMEX-Forum Influence Analysis</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          O RAMEX-Forum é uma extensão aplicada à visualização e análise de relações complexas, com foco em influência,
          pesos normalizados e interpretação de caminhos. Não substitui o RAMEX Puro; atua como abordagem complementar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Nós" value={formatNumber(metrics.nodes ?? 0)} />
        <MetricCard label="Arestas" value={formatNumber(metrics.edges ?? 0)} />
        <MetricCard label="Nó mais influente" value={metrics.most_influential_node ?? "Sem dados gerados"} />
        <MetricCard label="Nó mais recebido" value={metrics.most_received_node ?? "Sem dados gerados"} />
        <MetricCard label="Relação principal" value={`${topRelation?.from ?? "-"} → ${topRelation?.to ?? "-"}`} />
        <MetricCard label="Peso relativo médio" value={`${(metrics.average_relative_weight ?? 0).toFixed(2)}%`} />
        <MetricCard label="Caminho dominante" value={dominantPath} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
          <h4 className="font-semibold text-slate-100">Grafo de influência completo</h4>
          {forumImage ? (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
              <img src={forumImage} alt="Grafo de influência RAMEX-Forum" className="max-h-[32rem] w-full object-contain" />
            </div>
          ) : (
            <EmptyState message="Imagem RAMEX-Forum ainda não disponível." />
          )}
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
          <h4 className="font-semibold text-slate-100">Estrutura simplificada RAMEX-Forum</h4>
          {simplifiedImage ? (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
              <img src={simplifiedImage} alt="Estrutura simplificada RAMEX-Forum" className="max-h-[32rem] w-full object-contain" />
            </div>
          ) : (
            <EmptyState message="Imagem simplificada RAMEX-Forum ainda não disponível." />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 p-5 shadow-xl shadow-cyan-100/30 backdrop-blur-md">
        <h4 className="font-semibold text-ink">Interpretação automática</h4>
        <p className="mt-3 text-sm leading-7 text-slate-700">{data.interpretation}</p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Relação principal: {topRelation?.from ?? "-"} → {topRelation?.to ?? "-"} com frequência absoluta{" "}
          {formatNumber(topRelation?.weight ?? 0)} e peso relativo {(topRelation?.relative_weight ?? 0).toFixed(2)}%.
        </p>
      </div>

      <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-md scrollbar-thin">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-200 backdrop-blur">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Destino</th>
              <th className="px-3 py-2 text-right">Frequência absoluta</th>
              <th className="px-3 py-2 text-right">Peso relativo</th>
              <th className="px-3 py-2 text-left">Peso relativo (barra)</th>
              <th className="px-3 py-2 text-right">Ranking</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge, index) => (
              <tr key={`${edge.From}-${edge.To}-${index}`} className="border-t border-slate-100 odd:bg-white/70 even:bg-slate-50/80 hover:bg-cyan-50/60">
                <td className="px-3 py-3 font-medium text-ink">{edge.From}</td>
                <td className="px-3 py-3 text-slate-700">{edge.To}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Weight ?? 0)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{(edge.RelativeWeight ?? 0).toFixed(2)}%</td>
                <td className="px-3 py-3">
                  <div className="h-2.5 w-full min-w-[10rem] overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500"
                      style={{ width: `${Math.min(100, edge.RelativeWeight ?? 0)}%` }}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-white">#{edge.Rank ?? "-"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h4 className="font-semibold text-ink">Nós centrais</h4>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {centralNodes.slice(0, 6).map((node) => (
              <p key={node.id}>
                <span className="font-semibold text-ink">{node.id}</span> · saída {formatNumber(node.out_strength ?? 0)} · entrada{" "}
                {formatNumber(node.in_strength ?? 0)} · grau {formatNumber(node.degree ?? 0)}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h4 className="font-semibold text-ink">Comparação conceptual</h4>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr><td className="py-2 font-semibold">RAMEX Puro</td><td>Condensa estrutura sequencial dominante em Poly-tree formal.</td></tr>
                <tr><td className="py-2 font-semibold">RAMEX-Forum</td><td>Explora influência, centralidade, pesos relativos e caminhos dominantes.</td></tr>
                <tr><td className="py-2 font-semibold">Melhor uso</td><td>Relações complexas e exploração interpretativa complementar.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

type GraphViewerMode = "pure" | "forum" | "complete";

type GraphRelationRow = {
  from: string;
  to: string;
  weight?: number;
  relativeWeight?: number;
  rank?: number;
  mode?: string;
};

function graphAccentClasses(mode: GraphViewerMode) {
  if (mode === "forum") {
    return {
      text: "text-teal-300",
      border: "border-teal-400/40",
      button: "border-teal-400/30 text-teal-200 hover:bg-teal-400/10",
      row: "hover:bg-cyan-50",
      badge: "bg-teal-50 text-teal-700",
      bar: "from-cyan-500 to-teal-500",
    };
  }
  if (mode === "pure") {
    return {
      text: "text-amber-300",
      border: "border-amber-400/40",
      button: "border-amber-400/30 text-amber-200 hover:bg-amber-400/10",
      row: "hover:bg-amber-50",
      badge: "bg-amber-50 text-amber-700",
      bar: "from-amber-400 to-cyan-500",
    };
  }
  return {
    text: "text-cyan-300",
    border: "border-cyan-400/40",
    button: "border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10",
    row: "hover:bg-cyan-50",
    badge: "bg-cyan-50 text-cyan-700",
    bar: "from-cyan-500 to-teal-500",
  };
}

function GraphViewer({
  title,
  subtitle,
  imageSrc,
  nodes,
  edges,
  mode,
  legend,
  children,
}: {
  title: string;
  subtitle: string;
  imageSrc?: string;
  nodes?: number;
  edges?: number;
  mode: GraphViewerMode;
  legend?: string;
  children?: ReactNode;
}) {
  const accent = graphAccentClasses(mode);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dragging: boolean; x: number; y: number }>({ dragging: false, x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  function clampPosition(nextPosition: { x: number; y: number }, nextScale = scale) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 900;
    const height = rect?.height ?? 720;
    const maxX = Math.max(0, (width * nextScale - width) / 2 + width * 0.18);
    const maxY = Math.max(0, (height * nextScale - height) / 2 + height * 0.18);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPosition.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPosition.y)),
    };
  }

  function updateScale(nextScale: number) {
    const clampedScale = Math.max(0.5, Math.min(4, nextScale));
    setScale(clampedScale);
    setPosition((current) => clampPosition(current, clampedScale));
  }

  function resetView() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!isModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsModalOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-slate-400/30 ring-1 ring-white/10 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent.text}`}>{legend ?? "Graph artifact"}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nodes !== undefined ? (
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-slate-200">
              nós {formatNumber(nodes)}
            </span>
          ) : null}
          {edges !== undefined ? (
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-slate-200">
              arestas {formatNumber(edges)}
            </span>
          ) : null}
          {imageSrc ? (
            <a
              href={imageSrc}
              target="_blank"
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${accent.button}`}
            >
              <Eye className="h-3.5 w-3.5" /> abrir imagem
            </a>
          ) : null}
          {imageSrc ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${accent.button}`}
            >
              <Maximize2 className="h-3.5 w-3.5" /> expandir
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => updateScale(scale + 0.2)} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-900">
          <ZoomIn className="h-3.5 w-3.5" /> Zoom +
        </button>
        <button type="button" onClick={() => updateScale(scale - 0.2)} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-900">
          <ZoomOut className="h-3.5 w-3.5" /> Zoom -
        </button>
        <button type="button" onClick={resetView} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-900">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button type="button" onClick={resetView} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-900">
          Ajustar à janela
        </button>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-300">
          {Math.round(scale * 100)}%
        </span>
      </div>

      <div
        ref={viewportRef}
        onWheel={(event) => {
          event.preventDefault();
          updateScale(scale + (event.deltaY < 0 ? 0.12 : -0.12));
        }}
        onPointerDown={(event) => {
          if (scale <= 1) return;
          dragRef.current = { dragging: true, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current.dragging) return;
          const dx = event.clientX - dragRef.current.x;
          const dy = event.clientY - dragRef.current.y;
          dragRef.current = { dragging: true, x: event.clientX, y: event.clientY };
          setPosition((current) => clampPosition({ x: current.x + dx, y: current.y + dy }));
        }}
        onPointerUp={(event) => {
          dragRef.current.dragging = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current.dragging = false;
        }}
        className={`mt-4 flex h-[420px] min-h-[420px] touch-none items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-black/20 sm:h-[520px] md:h-[620px] lg:h-[720px] ${accent.border} ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            draggable={false}
            className="h-full w-full select-none rounded-xl object-contain p-3 transition-transform duration-100"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        ) : (
          <EmptyState message="Imagem do grafo ainda não disponível para este job." />
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        A interação por nó/aresta está disponível na tabela de relações; a imagem exportada é estática.
      </p>

      {children ? <div className="mt-5">{children}</div> : null}

      {isModalOpen && imageSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
            aria-label="Fechar imagem"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="h-[88vh] w-[94vw] rounded-3xl border border-white/10 bg-white p-3 shadow-2xl">
            <img src={imageSrc} alt={title} className="h-full w-full rounded-2xl object-contain" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GraphRelationsTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: GraphRelationRow[];
  mode: GraphViewerMode;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const accent = graphAccentClasses(mode);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-white/10 bg-white shadow-xl scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-200">
          <tr>
            <th className="px-3 py-3 text-left">{title}</th>
            <th className="px-3 py-3 text-left">Destino</th>
            <th className="px-3 py-3 text-right">Peso</th>
            {rows.some((row) => row.relativeWeight !== undefined) ? <th className="px-3 py-3 text-left">Peso relativo</th> : null}
            {rows.some((row) => row.rank !== undefined) ? <th className="px-3 py-3 text-right">Rank</th> : null}
            <th className="px-3 py-3 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 18).map((row, index) => {
            const selected = hoveredIndex === index;
            return (
              <tr
                key={`${row.from}-${row.to}-${index}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`border-t border-slate-100 odd:bg-white even:bg-slate-50/80 ${accent.row}`}
              >
                <td className="px-3 py-3 font-semibold text-slate-950">{row.from}</td>
                <td className="px-3 py-3 font-medium text-slate-700">{row.to}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-950">
                  {row.weight === undefined ? "-" : formatNumber(row.weight)}
                </td>
                {rows.some((item) => item.relativeWeight !== undefined) ? (
                  <td className="px-3 py-3">
                    <div className="flex min-w-[12rem] items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
                          style={{ width: `${Math.min(100, row.relativeWeight ?? 0)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {row.relativeWeight === undefined ? "-" : `${row.relativeWeight.toFixed(2)}%`}
                      </span>
                    </div>
                  </td>
                ) : null}
                {rows.some((item) => item.rank !== undefined) ? (
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800">
                    {row.rank === undefined ? "-" : `#${row.rank}`}
                  </td>
                ) : null}
                <td className="px-3 py-3">
                  {selected ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accent.badge}`}>
                      relação selecionada
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      hover
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryPanel({ onReuse }: { onReuse?: (result: UploadResult) => void }) {
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [detail, setDetail] = useState<HistoryJobDetail | null>(null);
  const [query, setQuery] = useState("");
  const [datasetFilter, setDatasetFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<HistoryAnalysisType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<HistoryStatus | "all">("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [loadingDetailJobId, setLoadingDetailJobId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  async function loadHistory() {
    setIsLoading(true);
    setError("");
    try {
      const loadedJobs = await getHistoryJobs();
      setJobs(loadedJobs);
    } catch (loadError) {
      setError(friendlyApiError(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function openDetail(jobId: string) {
    setIsDetailLoading(true);
    setLoadingDetailJobId(jobId);
    setError("");
    try {
      setDetail(await getHistoryJobDetail(jobId));
    } catch (loadError) {
      setError(friendlyApiError(loadError));
    } finally {
      setIsDetailLoading(false);
      setLoadingDetailJobId(null);
    }
  }

  async function reuseResult(jobId: string) {
    setError("");
    try {
      const result = await getJobResult(jobId);
      if (!result) {
        setError("O job ainda não tem resultado completo para reutilizar.");
        return;
      }
      onReuse?.(result);
      setDetail(await getHistoryJobDetail(jobId));
    } catch (loadError) {
      setError(friendlyApiError(loadError));
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!detail) return;
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [detail]);

  const datasetOptions = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.dataset_name).filter(Boolean))).sort(),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery =
        !normalizedQuery ||
        job.job_id.toLowerCase().includes(normalizedQuery) ||
        job.dataset_name.toLowerCase().includes(normalizedQuery);
      const matchesDataset = !datasetFilter || job.dataset_name === datasetFilter;
      const matchesType = typeFilter === "all" || job.analysis_type === typeFilter;
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesQuery && matchesDataset && matchesType && matchesStatus;
    });
  }, [datasetFilter, jobs, query, statusFilter, typeFilter]);

  const selectedImages: Array<[string, string]> = detail
    ? ([
        ["Grafo completo", detail.files.graph_png],
        ["RAMEX 2007", detail.files.ramex2007_png],
        ["Forward", detail.files.forward_png],
        ["Back-and-Forward formal", detail.files.back_forward_formal_png],
        ["Poly-tree", detail.files.polytree_png],
        ["RAMEX-Forum", detail.files.forum_graph_png],
        ["RAMEX-Forum simplificado", detail.files.forum_simplified_png],
      ].filter((entry): entry is [string, string] => Boolean(entry[1])))
    : [];

  const detailFiles = detail?.available_files ?? [];
  const validationRows = detail?.pure_metrics?.validation?.rows ?? [];
  const forumEdges = detail?.forum_metrics?.influence_graph?.edges ?? [];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Local Analysis Archive</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Histórico de Análises</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Análises executadas localmente e artefactos gerados pela pipeline RAMEX.
            </p>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-300/40 transition hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por job_id ou dataset"
              className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-3 text-sm text-slate-800 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          </label>
          <select
            value={datasetFilter}
            onChange={(event) => setDatasetFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          >
            <option value="">Todos os datasets</option>
            {datasetOptions.map((dataset) => (
              <option key={dataset} value={dataset}>{dataset}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as HistoryAnalysisType | "all")}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          >
            <option value="all">Todos os tipos</option>
            <option value="pure">RAMEX Puro</option>
            <option value="forum">RAMEX-Forum</option>
            <option value="both">Both</option>
            <option value="unknown">Desconhecido</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as HistoryStatus | "all")}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          >
            <option value="all">Todos os estados</option>
            <option value="completed">Concluído</option>
            <option value="failed">Falhou</option>
            <option value="running">Em execução</option>
            <option value="pending">Pendente</option>
            <option value="unknown">Desconhecido</option>
          </select>
        </div>
      </div>

      {error ? <WarningPanel>{error}</WarningPanel> : null}

      {filteredJobs.length === 0 && !isLoading ? (
        <EmptyState message="Nenhum job encontrado em backend-ramex/outputs com os filtros atuais." />
      ) : (
        <div className="overflow-auto rounded-3xl border border-white/60 bg-white/90 shadow-2xl shadow-slate-300/30 ring-1 ring-white/70 backdrop-blur-xl scrollbar-thin">
          <table className="min-w-[72rem] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-[0.14em] text-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Dataset</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Nós</th>
                <th className="px-4 py-3 text-right">Arestas</th>
                <th className="px-4 py-3 text-left">Melhor RAMEX puro</th>
                <th className="px-4 py-3 text-right">Peso preservado</th>
                <th className="px-4 py-3 text-left">Forum</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const reportUrl = historyFileUrl(job.job_id, job.files.report_pdf ?? job.files.report_md);
                const graphUrl = historyFileUrl(job.job_id, job.files.graph_png ?? job.files.graph);
                return (
                  <tr key={job.job_id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80 hover:bg-cyan-50/60">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{job.dataset_name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{job.job_id}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDateTime(job.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                        {analysisTypeLabel(job.analysis_type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        job.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : job.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-semibold tabular-nums text-slate-950">{formatNumber(job.summary.nodes ?? 0)}</td>
                    <td className="px-4 py-4 text-right font-mono font-semibold tabular-nums text-slate-950">{formatNumber(job.summary.edges ?? 0)}</td>
                    <td className="max-w-[16rem] px-4 py-4 text-slate-700">{job.summary.best_algorithm ?? "Sem dados"}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-500"
                            style={{ width: `${Math.min(100, job.summary.best_preserved_weight ?? 0)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">{(job.summary.best_preserved_weight ?? 0).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${job.has_forum ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                        {job.has_forum ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openDetail(job.job_id)}
                          disabled={loadingDetailJobId === job.job_id}
                          className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-600"
                        >
                          {loadingDetailJobId === job.job_id ? "A abrir..." : "Ver detalhe"}
                        </button>
                        {reportUrl ? <a href={reportUrl} target="_blank" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Relatório</a> : null}
                        {graphUrl ? <a href={graphUrl} target="_blank" className="rounded-full border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700">Grafo</a> : null}
                        <button onClick={() => reuseResult(job.job_id)} className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                          Reutilizar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        <div ref={detailRef} className="scroll-mt-6 space-y-5 rounded-3xl border border-cyan-200/80 bg-white/95 p-6 shadow-2xl shadow-cyan-200/30 ring-1 ring-cyan-100 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Detalhe do job</p>
              <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{detail.dataset_name}</h4>
              <p className="mt-1 font-mono text-xs text-slate-500">{detail.job_id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {detailFiles.filter((file) => /\.(csv|json|png|pdf|md)$/i.test(file)).slice(0, 8).map((file) => (
                <a
                  key={file}
                  href={historyFileUrl(detail.job_id, file)}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  {file.split("/").pop()}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Nós" value={formatNumber(detail.summary.nodes ?? 0)} />
            <MetricCard label="Arestas" value={formatNumber(detail.summary.edges ?? 0)} />
            <MetricCard label="Densidade" value={(detail.summary.density ?? 0).toFixed(4)} />
            <MetricCard label="Melhor RAMEX" value={detail.summary.best_algorithm ?? "Sem dados"} />
            <MetricCard label="Peso preservado" value={`${(detail.summary.best_preserved_weight ?? 0).toFixed(2)}%`} />
          </div>

          {selectedImages.length > 0 ? (
            <div className="grid gap-5 2xl:grid-cols-2">
              {selectedImages.map(([label, file]) => (
                <div key={`${label}-${file}`} className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <h5 className="font-semibold text-slate-100">{label}</h5>
                    <a href={historyFileUrl(detail.job_id, file)} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-cyan-300">
                      <Eye className="h-3.5 w-3.5" /> abrir imagem
                    </a>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
                    <img src={historyFileUrl(detail.job_id, file)} alt={label} className="max-h-[42rem] min-h-[30rem] w-full rounded-xl object-contain" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Este job não tem imagens PNG detetadas no histórico." />
          )}

          {validationRows.length > 0 ? (
            <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl scrollbar-thin">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Algoritmo</th>
                    <th className="px-3 py-2 text-right">Nós</th>
                    <th className="px-3 py-2 text-right">Arestas</th>
                    <th className="px-3 py-2 text-right">Peso preservado</th>
                    <th className="px-3 py-2 text-left">Âncora</th>
                  </tr>
                </thead>
                <tbody>
                  {validationRows.map((row, index) => (
                    <tr key={`${row.Algoritmo}-${index}`} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.Algoritmo}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-950">{formatNumber(row["Nos selecionados"] ?? 0)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-950">{formatNumber(row["Arestas selecionadas"] ?? 0)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-cyan-800">{((row["Peso preservado (%)"] as number | undefined) ?? 0).toFixed(2)}%</td>
                      <td className="px-3 py-3 font-medium text-slate-700">{row["Raiz ou aresta inicial"] ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {forumEdges.length > 0 ? (
            <div className="overflow-auto rounded-2xl border border-cyan-100 bg-cyan-50/50 shadow-xl scrollbar-thin">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-[0.14em] text-cyan-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Origem</th>
                    <th className="px-3 py-2 text-left">Destino</th>
                    <th className="px-3 py-2 text-right">Peso</th>
                    <th className="px-3 py-2 text-left">Peso relativo</th>
                    <th className="px-3 py-2 text-right">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {forumEdges.map((edge, index) => (
                    <tr key={`${edge.From}-${edge.To}-${index}`} className="border-t border-cyan-100 bg-white/80 hover:bg-cyan-50">
                      <td className="px-3 py-3 font-semibold text-slate-900">{edge.From}</td>
                      <td className="px-3 py-3 text-slate-700">{edge.To}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatNumber(edge.Weight ?? 0)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" style={{ width: `${Math.min(100, edge.RelativeWeight ?? 0)}%` }} />
                          </div>
                          <span className="font-mono text-xs">{(edge.RelativeWeight ?? 0).toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">#{edge.Rank ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : isDetailLoading ? (
        <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 text-sm text-slate-600 shadow-xl">A carregar detalhe...</div>
      ) : null}
    </section>
  );
}

function ValidationTable({ rows }: { rows: ValidationRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="A validação comparativa ainda não está disponível." />;
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left">Dataset</th>
            <th className="px-3 py-2 text-right">Nós</th>
            <th className="px-3 py-2 text-right">Arestas</th>
            <th className="px-3 py-2 text-right">Densidade</th>
            <th className="px-3 py-2 text-right">PESO POLY-TREE FORMAL</th>
            <th className="px-3 py-2 text-left">Interpretação</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {rows.map((row) => (
            <tr key={row.Dataset} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/65">
              <td className="px-3 py-3 font-semibold text-slate-800">{row.Dataset}</td>
              <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">{formatNumber(row.Nos_Grafo)}</td>
              <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">{formatNumber(row.Arestas_Grafo)}</td>
              <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">{row.Densidade_Aproximada.toFixed(4)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">{row.Percentagem_Peso_Preservado.toFixed(2)}%</td>
              <td className="max-w-xl px-3 py-3 text-slate-700">{row.Interpretacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationCharts({ rows }: { rows: ValidationRow[] }) {
  if (rows.length === 0) return null;

  const chartRows = rows.map((row) => ({
    dataset: row.Dataset.replace("Dataset ", "D"),
    nos: row.Nos_Grafo,
    arestas: row.Arestas_Grafo,
    densidade: Number((row.Densidade_Aproximada * 100).toFixed(2)),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h3 className="text-sm font-semibold text-ink">Nós e arestas</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dataset" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="nos" name="Nós" fill="#315f72" />
              <Bar dataKey="arestas" name="Arestas" fill="#8aa08a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h3 className="text-sm font-semibold text-ink">Densidade aproximada (%)</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dataset" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="densidade" name="Densidade" fill="#c8914b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AboutRamexPanel() {
  const problemItems = [
    "Redução da complexidade na análise de sequências",
    "Evitar a geração excessiva de regras difíceis de interpretar",
    "Condensar dados sequenciais em estruturas de rede",
    "Apoiar uma leitura global dos padrões",
    "Facilitar a interpretação por utilizadores não especialistas",
  ];

  const implementationRows = [
    ["Normalização de sequências", "Implementado"],
    ["Geração de pares A → B", "Implementado"],
    ["Frequência de transições", "Implementado"],
    ["Matriz de adjacência", "Implementado"],
    ["Grafo dirigido ponderado", "Implementado"],
    ["Estrutura RAMEX base", "Implementado na linha RAMEX pura formal"],
    ["RAMEX 2007 Rooted Branching", "Implementação RAMEX pura"],
    ["Forward Heuristic", "Implementação RAMEX pura"],
    ["Back-and-Forward Heuristic", "Implementação RAMEX pura"],
    ["Poly-tree completo", "Implementação RAMEX pura"],
  ];

  const pipelineSteps = [
    "Dataset",
    "Sequências",
    "Pares",
    "Matriz de Adjacência",
    "Grafo",
    "Rooted Branching",
    "Forward",
    "Back-and-Forward",
    "Poly-tree formal",
    "Interpretação",
  ];

  const references = [
    "Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007, LNAI 4874, pp. 406414.",
    "Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees. Advances in Intelligent Systems and Computing, 354, pp. 143153.",
    "Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products. Expert Systems, 3412174.",
    "Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática. Revista de Ciência Elementar, 9(02):041.",
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold text-thesis">Fundamentação científica da framework de análise sequencial.</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Sobre o RAMEX</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-thesis" />
            <h4 className="text-lg font-semibold text-ink">Origem e enquadramento</h4>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            O RAMEX é uma abordagem de sequence mining proposta pelo Professor Luís Cavique, orientada para a descoberta de
            padrões sequenciais através de estruturas de rede/grafo. Em vez de produzir apenas grandes listas de
            regras, a abordagem procura representar os padrões de forma visual e interpretável.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Ideia central</p>
          <p className="mt-3 text-xl font-semibold leading-8 text-ink">
            “O RAMEX transforma sequências de eventos em estruturas de rede, permitindo uma visão global dos padrões
            em vez de uma análise isolada de regras.”
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <h4 className="text-lg font-semibold text-ink">Problema que o RAMEX procura resolver</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {problemItems.map((item, index) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-thesis text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h4 className="text-lg font-semibold text-ink">Relação com esta implementação</h4>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Componente</th>
                  <th className="px-3 py-2 text-left">Estado na framework</th>
                </tr>
              </thead>
              <tbody>
                {implementationRows.map(([component, status]) => (
                  <tr key={component} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-ink">{component}</td>
                    <td className="px-3 py-3 text-slate-600">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h4 className="text-lg font-semibold text-ink">Pipeline visual</h4>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {pipelineSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  {step}
                </span>
                {index < pipelineSteps.length - 1 ? <span className="text-slate-400">→</span> : null}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            Esta sequência preserva a rastreabilidade do processo: cada artefacto intermédio pode ser inspecionado,
            validado e explicado no relatório final.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <h4 className="text-lg font-semibold text-ink">Referências científicas</h4>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          {references.map((reference) => (
            <li key={reference} className="rounded-lg bg-slate-50 px-4 py-3">
              {reference}
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-thesis/20 bg-thesis/5 p-5 shadow-panel">
          <h4 className="text-lg font-semibold text-ink">Implementações RAMEX puras</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>RAMEX 2007 Rooted Branching</li>
            <li>Forward Heuristic</li>
            <li>Back-and-Forward Heuristic</li>
          </ul>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-panel">
          <h4 className="text-lg font-semibold text-ink">RAMEX-Forum</h4>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            O RAMEX-Forum é mantido como abordagem complementar para exploração de influência, pesos relativos e
            caminhos dominantes, sem substituir a Poly-tree formal.
          </p>
        </div>
      </div>


      <div className="rounded-lg border border-thesis/20 bg-thesis/5 p-5 shadow-panel">
        <p className="text-sm leading-7 text-slate-700">
          Esta aplicação implementa uma framework académica inspirada no RAMEX. A versão atual privilegia a
          rastreabilidade das fases, a visualização dos padrões e a validação comparativa dos datasets.
        </p>
      </div>
    </section>
  );
}

function DatasetsValidationPanel({
  rows,
  selectedDataset,
  onOpenDataset,
}: {
  rows: ValidationRow[];
  selectedDataset: DatasetId;
  onOpenDataset: (datasetId: DatasetId) => void;
}) {
  const descriptions: Record<DatasetId, string> = {
    "01": "grafo denso / altamente conectado",
    "02": "grafo quase linear / sequencial",
    "03": "grafo pequeno e completo",
  };

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <h3 className="text-lg font-semibold text-ink">Casos de validação</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Os datasets 01, 02 e 03 são casos demonstrativos já processados. Servem para validar o comportamento do
          RAMEX puro em estruturas densas, quase lineares e pequenas/completas.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(datasets) as DatasetId[]).map((id) => {
          const row = rows.find((item) => item.Dataset?.includes(id));
          const isSelected = id === selectedDataset;
          return (
            <article key={id} className={`rounded-lg border bg-white p-5 shadow-panel ${isSelected ? "border-thesis" : "border-slate-200"}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">{datasets[id].short}</p>
              <h4 className="mt-2 text-xl font-semibold text-ink">{datasets[id].label}</h4>
              <p className="mt-2 text-sm font-semibold text-thesis">{descriptions[id]}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MetricCard label="Nós" value={formatNumber(row?.Nos_Grafo ?? 0)} />
                <MetricCard label="Arestas" value={formatNumber(row?.Arestas_Grafo ?? 0)} />
                <MetricCard label="Densidade" value={(row?.Densidade_Aproximada ?? 0).toFixed(4)} />
                <MetricCard label="PESO POLY-TREE FORMAL" value={`${(row?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%`} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {id === "01"
                  ? "Exige maior condensação porque concentra muitas transições possíveis."
                  : id === "02"
                    ? "Favorece métodos enraizados quando a sequência já está bem definida."
                    : "Permite comparar diferenças pequenas entre métodos em estrutura compacta."}
              </p>
              <button
                onClick={() => onOpenDataset(id)}
                className="mt-4 rounded-lg bg-thesis px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ver resultados RAMEX
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PipelineRamexPanel() {
  const steps = [
    ["Dataset", "Dados sequenciais ou tabela de eventos.", ".txt, .csv ou .xlsx"],
    ["Sequências", "Reconstrução cronológica por entidade/caso.", "sequencias normalizadas"],
    ["Pares A → B", "Extração das transições consecutivas.", "pares de transição"],
    ["Frequências absolutas", "Contagem dos pares repetidos.", "frequencias_pares.csv"],
    ["Matriz de adjacência", "Origem nas linhas e destino nas colunas.", "matriz_adjacencia.csv"],
    ["Grafo dirigido ponderado", "Rede de eventos com pesos nas arestas.", "grafo_edges.csv / grafo.png"],
    ["Rooted Branching", "Árvore enraizada de peso máximo.", "ramex2007.json"],
    ["Forward", "Expansão a partir de raiz conhecida.", "ramex_forward.json"],
    ["Back-and-Forward", "Expansão pela melhor relação inicial.", "ramex_back_forward.json"],
    ["Poly-tree formal", "Validação estrutural: DAG conectado e árvore não dirigida.", "validação RAMEX puro"],
  ];

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-5 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-ink">Pipeline RAMEX final</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A versão final segue a linha RAMEX pura: transforma dados em rede dirigida ponderada e compara métodos
          baseados em Rooted Branching, Forward e Back-and-Forward.
        </p>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Progresso conceptual</span>
            <span>100%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-full bg-gradient-to-r from-cyan-500 to-teal-500" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200/60 bg-white/90 p-4 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <div className="flex min-w-max items-center gap-3">
        {steps.map(([title, description, output], index) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <h4 className="mt-3 font-semibold text-ink">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">{output}</p>
          </div>
        ))}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-100">
        <p className="text-slate-300">[pipeline] dataset carregado</p>
        <p className="text-slate-300">[pipeline] pares extraídos e normalizados</p>
        <p className="text-slate-300">[pipeline] rooted branching, forward e back-and-forward concluídos</p>
        <p className="text-cyan-300">[pipeline] poly-tree formal validada com sucesso</p>
      </div>
    </section>
  );
}

function ReportsPanel({
  datasetName,
  executiveText,
  pureData,
  onReport,
  pdfData,
}: {
  datasetName: string;
  executiveText: string;
  pureData?: PureRamexData;
  onReport: () => void;
  pdfData?: ReportData;
}) {
  const reportBody = pureData?.comparisonMarkdown || executiveText || "Relatório ainda não gerado para este dataset.";

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(reportBody);
    } catch {
      // noop
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <p className="text-sm font-semibold text-thesis">{datasetName}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">Relatórios RAMEX puro</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Os relatórios finais privilegiam RAMEX 2007 Rooted Branching, Forward Heuristic, Back-and-Forward Heuristic,
          Poly-tree formal e validação comparativa. As heurísticas experimentais ficam fora da experiência principal.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ReportButton onClick={onReport} disabled={!pdfData} />
          <ReportExportButton data={pdfData} disabled={!pdfData} />
          <button
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <FileText className="h-4 w-4" />
            Copiar conteúdo
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Melhor método" value={pureRamexBest(pureData) ?? "Sem dados gerados"} />
          <MetricCard label="Método(s) mais simples" value={pureRamexSimplestLabels(pureData)} />
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-ink">Relatório de conformidade / validação</h3>
        <pre className="prose prose-slate mt-4 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-6 font-mono text-xs leading-7 text-slate-100 shadow-inner scrollbar-thin">
          {reportBody}
        </pre>
      </div>
    </section>
  );
}

function DemonstrationPanel({
  datasetName,
  validation,
  pureData,
  onGoTo,
  onReport,
  pdfData,
}: {
  datasetName: string;
  validation?: ValidationRow;
  pureData?: PureRamexData;
  onGoTo: (view: ViewId) => void;
  onReport: () => void;
  pdfData?: ReportData;
}) {
  const steps = [
    ["Dataset", "Entrada de dados sequenciais ou tabela de eventos."],
    ["Sequências", "Reconstrução da ordem dos eventos por entidade/caso."],
    ["Matriz", "Representação das frequências de transição entre eventos."],
    ["Grafo", "Conversão da matriz numa rede dirigida ponderada."],
    ["RAMEX Puro", "Rooted Branching, Forward e Back-and-Forward."],
    ["Validação", "Comparação estrutural e síntese automática."],
  ];
  const bestPure = pureRamexBest(pureData);
  const structuralType = pureRamexStructuralType(validation, pureData);

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold text-thesis">Percurso completo desde os dados brutos até à extração de conhecimento.</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Demonstração da Framework</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {steps.map(([title, description], index) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-thesis text-sm font-semibold text-white">
              {index + 1}
            </span>
            <h4 className="mt-3 font-semibold text-ink">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Dataset atual" value={datasetName} />
        <MetricCard label="Nós" value={formatNumber(validation?.Nos_Grafo ?? 0)} />
        <MetricCard label="Arestas" value={formatNumber(validation?.Arestas_Grafo ?? 0)} />
        <MetricCard label="Densidade" value={(validation?.Densidade_Aproximada ?? 0).toFixed(4)} />
        <MetricCard label="PESO POLY-TREE FORMAL" value={`${(validation?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%`} />
        <MetricCard label="Melhor RAMEX puro" value={bestPure ?? "Sem dados gerados"} />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <p className="text-xs font-semibold uppercase text-slate-500">Tipo estrutural do dataset</p>
        <p className="mt-2 text-lg font-semibold text-ink">{structuralType}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{pureRamexStructuralInterpretation(structuralType)}</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-panel">
        <p className="text-xl font-semibold leading-8 text-ink">
          &quot;A forma como representamos os dados determina a qualidade do conhecimento extraído.&quot;
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <h4 className="text-lg font-semibold text-ink">Objetivo</h4>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Nesta framework, os dados são primeiro normalizados em sequências. Depois são transformados em pares de
          transição, que permitem construir uma matriz de adjacência e um grafo dirigido ponderado. A partir desse
          grafo, são extraídas estruturas RAMEX, com o objetivo de condensar os padrões sequenciais mais relevantes e
          facilitar a interpretação.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onGoTo("upload")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Upload / Nova Análise
        </button>
        <button onClick={() => onGoTo("pure")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Ver RAMEX Puro
        </button>
        <button onClick={() => onGoTo("validation")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Ver Validação
        </button>
        <button onClick={() => onGoTo("reports")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Relatórios
        </button>
        <ReportButton onClick={onReport} />
        <ReportExportButton key={pdfData?.datasetName ?? "pdf-demo"} data={pdfData} disabled={!pdfData} />
      </div>
    </section>
  );
}

function UploadDatasetPanel({ onAnalyzed }: { onAnalyzed?: (result: UploadResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [datasetType, setDatasetType] = useState<UploadDatasetType>("simple_sequences");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("pure");
  const [caseColumn, setCaseColumn] = useState("");
  const [timeColumn, setTimeColumn] = useState("");
  const [eventColumn, setEventColumn] = useState("");
  const [minFrequency, setMinFrequency] = useState("0");
  const [topN, setTopN] = useState("");
  const [polytreeStrategy, setPolytreeStrategy] = useState<PolyTreeStrategy>("top-k");
  const [topKPerNode, setTopKPerNode] = useState("2");
  const [polytreeMinWeight, setPolytreeMinWeight] = useState("");
  const [maxDepth, setMaxDepth] = useState("5");
  const [alpha, setAlpha] = useState("0.35");
  const [beta, setBeta] = useState("0.25");
  const [gamma, setGamma] = useState("0.15");
  const [delta, setDelta] = useState("0.15");
  const [epsilon, setEpsilon] = useState("0.05");
  const [zeta, setZeta] = useState("0.05");
  const [preserveWeightTarget, setPreserveWeightTarget] = useState("0.7");
  const [maxBranching, setMaxBranching] = useState("3");
  const [minScore, setMinScore] = useState("0.0");
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [showTechnicalError, setShowTechnicalError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const canMapColumns = datasetType !== "simple_sequences";

  async function handleUpload() {
    if (!file) {
      setError("Selecione um ficheiro antes de enviar.");
      return;
    }

    setError("");
    setResult(null);
    setIsUploading(true);

    try {
      const uploaded = await uploadDataset(file);
      setJobId(uploaded.job_id);
      setColumns(uploaded.columns);
      if (uploaded.columns.length > 0) {
        const mapping = inferColumnMapping(uploaded.columns, datasetType);
        setCaseColumn(mapping.caseColumn);
        setTimeColumn(mapping.timeColumn);
        setEventColumn(mapping.eventColumn);
      }
    } catch (uploadError) {
      setError(friendlyApiError(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!jobId) {
      setError("Envie primeiro um ficheiro para criar um job.");
      return;
    }

    if (canMapColumns && (!caseColumn || !timeColumn || !eventColumn)) {
      setError("Complete o mapeamento de colunas antes de executar a análise.");
      return;
    }

    setError("");
    setResult(null);
    setJobState(null);
    setShowTechnicalError(false);

    try {
      const started = await startAnalyzeUploadedDataset({
        job_id: jobId,
        dataset_type: datasetType,
        analysis_type: analysisType,
        case_column: canMapColumns ? caseColumn : undefined,
        time_column: canMapColumns ? timeColumn : undefined,
        event_column: canMapColumns ? eventColumn : undefined,
        min_frequency: parseDecimalInput(minFrequency, 0),
        top_n: topN.trim() ? parseDecimalInput(topN, 0) : null,
        strategy: polytreeStrategy,
        polytree_strategy: polytreeStrategy,
        top_k_per_node: parseDecimalInput(topKPerNode, 2),
        max_depth: parseDecimalInput(maxDepth, polytreeStrategy === "multiobjective" ? 6 : 5),
        min_weight: polytreeMinWeight.trim() ? parseDecimalInput(polytreeMinWeight, 0) : null,
        alpha: parseDecimalInput(alpha, 0.35),
        beta: parseDecimalInput(beta, 0.25),
        gamma: parseDecimalInput(gamma, 0.15),
        delta: parseDecimalInput(delta, 0.15),
        epsilon: parseDecimalInput(epsilon, 0.05),
        zeta: parseDecimalInput(zeta, 0.05),
        preserve_weight_target: parseDecimalInput(preserveWeightTarget, 0.7),
        max_branching: parseDecimalInput(maxBranching, 3),
        min_score: parseDecimalInput(minScore, 0),
      });
      setJobId(started.job_id);
      setIsAnalyzing(true);
    } catch (analysisError) {
      setError(friendlyApiError(analysisError));
      setIsAnalyzing(false);
    }
  }

  useEffect(() => {
    if (!isAnalyzing || !jobId) {
      return;
    }

    let canceled = false;

    const poll = async () => {
      try {
        const state = await getJobState(jobId);
        if (canceled) return;

        setJobState(state);
        if (state.status === "completed") {
          const finalResult = await getJobResult(jobId);
          if (canceled || !finalResult) return;
          setResult(finalResult);
          onAnalyzed?.(finalResult);
          setIsAnalyzing(false);
          return;
        }

        if (state.status === "failed") {
          const failedStep = state.error?.step ? ` na etapa ${state.error.step}` : "";
          const failedMsg = state.error?.message ?? "Erro inesperado durante a execução da pipeline.";
          setError(`Erro${failedStep}: ${failedMsg}`);
          setIsAnalyzing(false);
        }
      } catch (pollError) {
        if (canceled) return;
        const errorMessage = pollError instanceof Error ? pollError.message : String(pollError);
        if (errorMessage.includes("Job não encontrado")) {
          return;
        }
        setError(friendlyApiError(pollError));
        setIsAnalyzing(false);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
    };
  }, [isAnalyzing, jobId, onAnalyzed]);

  function handleDownloadUploadReport() {
    if (!result) return;
    const report = buildTechnicalReport({
      datasetName: result.filename || file?.name || result.job_id,
      origin: "upload",
      datasetType,
      params: {
        minFrequency,
        topN: topN || null,
        maxDepth: result.formal_polytree?.metrics?.max_depth_reached ?? result.formal_polytree?.metrics?.max_depth,
      },
      metrics: {
        sequences: result.metrics.sequences,
        nodes: result.metrics.nodes,
        edges: result.metrics.edges,
        totalWeight: result.metrics.total_weight,
        density: result.metrics.density,
        ramexEdges: result.metrics.ramex_edges,
        ramexPreserved: result.metrics.preserved_percentage,
        polytreeEdges: result.formal_polytree?.metrics?.selected_edges,
        polytreePreserved: result.formal_polytree?.metrics?.preserved_weight_percent,
        root: result.metrics.root,
        polytreeRoot: pure_anchor_frontend(result.formal_polytree),
      },
      topTransitions: result.top_transitions,
      polytreeEdges: result.formal_polytree?.edges?.map(pureEdgeToTable),
      pureRamex: {
        bestAlgorithm: result.pure_validation?.best_algorithm ?? pureRamexBest(result.pure_ramex),
        structuralType: result.pure_validation?.structural_type,
        summary: result.pure_validation?.summary,
        rows: (result.pure_ramex?.comparisonRows ?? []).map((row) => ({
          algorithm: row.Algoritmo ?? "Sem dados gerados",
          method: row.Metodo,
          selectedEdges: row["Arestas selecionadas"],
          preservedWeightPercent: row["Peso preservado (%)"],
          anchor: row["Raiz ou aresta inicial"],
        })),
      },
      ramexForum: forumToReport(result.ramex_forum, result.job_id),
      interpretation: result.interpretation,
    });
    downloadMarkdown(`relatorio_tecnico_${sanitizeReportName(result.job_id)}.md`, report);
  }

  const rootNode = result?.metrics.root;
  const formalMetrics = result?.formal_polytree?.metrics;
  const uploadPureRows = result?.pure_ramex?.comparisonRows ?? [];
  const uploadBest = result?.pure_validation?.best_algorithm ?? pureRamexBest(result?.pure_ramex);
  const uploadStructuralType =
    result?.pure_validation?.structural_type ??
    pureRamexStructuralType(
      result
        ? {
            Dataset: result.filename,
            Nos_Grafo: result.metrics.nodes,
            Arestas_Grafo: result.metrics.edges,
            Soma_Pesos_Grafo: result.metrics.total_weight,
            Arestas_RAMEX: result.metrics.ramex_edges,
            Soma_Pesos_RAMEX: result.metrics.ramex_weight,
            Percentagem_Peso_Preservado: result.metrics.preserved_percentage,
            Densidade_Aproximada: result.metrics.density,
            Top_5_Transicoes: "",
            Interpretacao: result.interpretation,
          }
        : undefined,
      result?.pure_ramex,
    );
  const uploadReportProblem = reportCompletenessError(result);
  const uploadReportData: ReportData | undefined = result && !uploadReportProblem
    ? {
        datasetName: result.filename || file?.name || result.job_id,
        datasetOrigin: "upload",
        analysisType: result.analysis_type ?? analysisType,
        datasetType,
        generatedAt: new Date().toLocaleString("pt-PT"),
        parameters: {
          minFrequency: parseDecimalInput(minFrequency, 0),
          topN: topN.trim() ? parseDecimalInput(topN, 0) : null,
          polytreeStrategy: result.polytree?.strategy ?? polytreeStrategy,
          topKPerNode: parseDecimalInput(String(result.polytree?.parameters?.top_k_per_node ?? topKPerNode), 2),
          maxDepth: result.polytree?.metrics.max_depth ?? (parseDecimalInput(maxDepth, 0) || undefined),
          minWeight: parseDecimalInput(String(result.polytree?.parameters?.min_weight ?? polytreeMinWeight), 0) || undefined,
          alpha: parseDecimalInput(String(result.polytree?.parameters?.alpha ?? alpha), 0.35),
          beta: parseDecimalInput(String(result.polytree?.parameters?.beta ?? beta), 0.25),
          gamma: parseDecimalInput(String(result.polytree?.parameters?.gamma ?? gamma), 0.15),
          delta: parseDecimalInput(String(result.polytree?.parameters?.delta ?? delta), 0.15),
          epsilon: parseDecimalInput(String(result.polytree?.parameters?.epsilon ?? epsilon), 0.05),
          zeta: parseDecimalInput(String(result.polytree?.parameters?.zeta ?? zeta), 0.05),
          preserveWeightTarget: parseDecimalInput(String(result.polytree?.parameters?.preserve_weight_target ?? preserveWeightTarget), 0.7),
          maxBranching: parseDecimalInput(String(result.polytree?.parameters?.max_branching ?? maxBranching), 3),
          minScore: parseDecimalInput(String(result.polytree?.parameters?.min_score ?? minScore), 0),
        },
        metrics: {
          sequences: result.metrics.sequences,
          nodes: result.metrics.nodes,
          edges: result.metrics.edges,
          density: result.metrics.density,
          totalWeight: result.metrics.total_weight,
          ramexEdges: result.metrics.ramex_edges,
          ramexWeight: result.metrics.ramex_weight,
          ramexPreservedPercent: result.metrics.preserved_percentage,
          polytreeNodes: formalMetrics?.selected_nodes,
          polytreeEdges: formalMetrics?.selected_edges,
          polytreeWeight: formalMetrics?.selected_weight_sum,
          polytreePreservedPercent: formalMetrics?.preserved_weight_percent,
          ramex2007PreservedPercent: result.pure_ramex?.ramex2007?.metrics?.preserved_weight_percent,
          forwardPreservedPercent: result.pure_ramex?.forward?.metrics?.preserved_weight_percent,
          backForwardPreservedPercent: result.pure_ramex?.backForward?.metrics?.preserved_weight_percent,
        },
        topTransitions: result.top_transitions.map(edgeToReport),
        allTransitions: result.graph_edges?.map(edgeToReport),
        transitionMatrix: result.transition_matrix,
        ramexEdges: result.ramex_edges.map(edgeToReport),
        polytreeEdges: result.formal_polytree?.edges?.map(pureEdgeToReport),
        pureRamex: {
          bestAlgorithm: uploadBest,
          structuralType: uploadStructuralType,
          summary: result.pure_validation?.summary ?? pureRamexScientificSummary(undefined, result.pure_ramex),
          rows: uploadPureRows.map((row) => ({
            algorithm: row.Algoritmo ?? "Sem dados gerados",
            method: row.Metodo,
            selectedEdges: row["Arestas selecionadas"],
            preservedWeightPercent: row["Peso preservado (%)"],
            anchor: row["Raiz ou aresta inicial"],
          })),
        },
        ramexForum: forumToReport(result.ramex_forum ?? result.forum, result.job_id),
        interpretations: {
          executiveSummary: `${result.interpretation} A análise é enquadrada no RAMEX puro com validação formal da Poly-tree.`,
          graphInterpretation: result.interpretation,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A Poly-tree formal valida estruturalmente a saída RAMEX pura.",
          conclusion:
            "A implementação atual integra RAMEX puro, validação formal da Poly-tree e alinhamento conceptual com Cavique (2007, 2015).",
        },
        images: {
          graph: result.files.graph_png ? `${API_BASE_URL}/api/file/${result.job_id}/${result.files.graph_png}` : undefined,
          ramex: result.files.ramex_png ? `${API_BASE_URL}/api/file/${result.job_id}/${result.files.ramex_png}` : undefined,
          polytree: result.files.back_forward_formal_png
              ? `${API_BASE_URL}/api/file/${result.job_id}/${result.files.back_forward_formal_png}`
              : undefined,
          forumGraph: (result.ramex_forum ?? result.forum)?.files?.graph_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${result.job_id}/file/${(result.ramex_forum ?? result.forum)?.files?.graph_png}`
            : undefined,
          forumSimplified: (result.ramex_forum ?? result.forum)?.files?.simplified_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${result.job_id}/file/${(result.ramex_forum ?? result.forum)?.files?.simplified_png}`
            : undefined,
        },
      }
    : undefined;
  const forumResult = result?.ramex_forum ?? result?.forum;
  const graphImageSrc = result?.files.graph_png ? `${API_BASE_URL}/api/file/${result.job_id}/${result.files.graph_png}` : undefined;
  const pureImageFile = result?.files.back_forward_formal_png ?? result?.files.ramex_png;
  const pureImageSrc = result && pureImageFile ? `${API_BASE_URL}/api/file/${result.job_id}/${pureImageFile}` : undefined;
  const forumImageSrc = result && forumResult?.files?.graph_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${result.job_id}/file/${forumResult.files.graph_png}`
    : undefined;
  const graphRelationRows: GraphRelationRow[] = (result?.graph_edges ?? result?.top_transitions ?? [])
    .slice(0, 24)
    .map((edge) => ({ from: edge.From, to: edge.To, weight: edge.Weight }));
  const pureRelationRows: GraphRelationRow[] = (result?.formal_polytree?.edges ?? [])
    .map((edge) => ({
      from: edge.from ?? "",
      to: edge.to ?? "",
      weight: edge.weight,
      mode: edge.direction,
    }));
  const fallbackPureRelationRows: GraphRelationRow[] = (result?.ramex_edges ?? [])
    .map((edge) => ({ from: edge.From, to: edge.To, weight: edge.Weight }));
  const forumRelationRows: GraphRelationRow[] = (forumResult?.influence_graph?.edges ?? [])
    .map((edge) => ({
      from: edge.From ?? "",
      to: edge.To ?? "",
      weight: edge.Weight,
      relativeWeight: edge.RelativeWeight,
      rank: edge.Rank,
    }));

  return (
    <section className="space-y-7">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-7 text-white shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Centro de Comando</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">RAMEX Sequential Analysis</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Consola analítica para ingestão de datasets, execução assíncrona da pipeline RAMEX e validação comparativa.
            </p>
          </div>
          <div className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            {analysisType === "pure" ? "RAMEX Puro" : analysisType === "forum" ? "Forum" : "Both"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Dataset" value={result?.filename || file?.name || "Aguardando ficheiro"} note="Artefacto em análise" />
          <MetricCard label="Sequências" value={formatNumber(result?.metrics.sequences ?? 0)} note="Reconstruídas" />
          <MetricCard label="Nós" value={formatNumber(result?.metrics.nodes ?? 0)} note="Estados distintos" />
          <MetricCard label="Arestas" value={formatNumber(result?.metrics.edges ?? 0)} note="Transições ponderadas" />
          <MetricCard label="Estado da pipeline" value={jobState?.status ?? "pending"} note={jobState?.current_step ?? "Aguardando upload"} />
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">Novo dataset</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Envie um ficheiro e configure como as sequências devem ser reconstruídas.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Ficheiro</span>
              <input
                type="file"
                accept=".txt,.csv,.xlsx"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setJobId("");
                  setColumns([]);
                  setResult(null);
                  setJobState(null);
                }}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm transition focus:border-cyan-600 focus:outline-none focus:ring-4 focus:ring-cyan-200"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Tipo de dataset</span>
              <select
                value={datasetType}
                onChange={(event) => {
                  const nextType = event.target.value as UploadDatasetType;
                  setDatasetType(nextType);
                  if (columns.length > 0) {
                    const mapping = inferColumnMapping(columns, nextType);
                    setCaseColumn(mapping.caseColumn);
                    setTimeColumn(mapping.timeColumn);
                    setEventColumn(mapping.eventColumn);
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="simple_sequences">Sequências simples: cada linha é uma sequência</option>
                <option value="event_table">Eventos com colunas: ID, ordem/data, evento</option>
                <option value="customer_excel">Excel: Customer ID, Order Date, Category</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Tipo de análise</span>
              <select
                value={analysisType}
                onChange={(event) => setAnalysisType(event.target.value as AnalysisType)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm transition focus:border-cyan-600 focus:outline-none focus:ring-4 focus:ring-cyan-200"
              >
                <option value="pure">RAMEX Puro</option>
                <option value="forum">RAMEX-Forum</option>
                <option value="both">RAMEX Puro + RAMEX-Forum</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                O RAMEX Puro condensa a estrutura sequencial em Poly-tree formal. O RAMEX-Forum complementa a análise
                com pesos relativos, influência e caminhos dominantes.
              </p>
            </label>

            {canMapColumns ? (
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Entidade/caso", caseColumn, setCaseColumn],
                  ["Tempo/ordem", timeColumn, setTimeColumn],
                  ["Evento/categoria", eventColumn, setEventColumn],
                ].map(([label, value, setter]) => (
                  <label key={String(label)} className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">{String(label)}</span>
                    <select
                      value={String(value)}
                      onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm transition focus:border-thesis focus:outline-none focus:ring-4 focus:ring-thesis/10"
                    >
                      <option value="">Selecionar</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Frequência mínima</span>
                <input
                  value={minFrequency}
                  onChange={(event) => setMinFrequency(event.target.value)}
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Top N</span>
                <input
                  value={topN}
                  onChange={(event) => setTopN(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="opcional"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <InfoCallout>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-thesis">
                  i
                </span>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-ink">Parâmetros de Visualização (não fazem parte do RAMEX)</h4>
                    <p className="mt-2">
                      Os parâmetros “Frequência mínima” e “Top-N” são utilizados exclusivamente para facilitar a
                      visualização e interpretação dos resultados, não fazendo parte do algoritmo RAMEX em si.
                    </p>
                    <p className="mt-2">
                      O RAMEX (Cavique, 2007; 2015) distingue-se de outras abordagens de análise sequencial por não
                      depender de parâmetros como suporte mínimo ou thresholds de filtragem, evitando assim a
                      necessidade de ajuste manual e a geração excessiva de padrões.
                    </p>
                  </div>

                  <div>
                    <h5 className="font-semibold text-ink">Frequência mínima</h5>
                    <p className="mt-1">
                      A frequência mínima permite filtrar transições pouco frequentes, reduzindo ruído em datasets de
                      grande dimensão.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Utilização recomendada: grafos muito densos ou datasets com elevado volume de dados.</li>
                      <li>Impacto: melhora a legibilidade, sem alterar a lógica do algoritmo.</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-semibold text-ink">Top-N</h5>
                    <p className="mt-1">O parâmetro Top-N limita a visualização às N transições mais frequentes.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Utilização recomendada: exploração inicial ou apresentação de resultados.</li>
                      <li>Impacto: simplifica o grafo, destacando os padrões dominantes.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-sky-100 bg-white/70 px-3 py-2">
                    <h5 className="font-semibold text-ink">Nota importante</h5>
                    <p className="mt-1">
                      A utilização destes parâmetros pode omitir informação relevante. Para análise rigorosa,
                      recomenda-se a execução do RAMEX sem filtragem adicional.
                    </p>
                  </div>
                </div>
              </div>
            </InfoCallout>

            {showExperimental ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Estratégia Poly-tree</span>
                  <select
                    value={polytreeStrategy}
                    onChange={(event) => {
                      const strategy = event.target.value as PolyTreeStrategy;
                      setPolytreeStrategy(strategy);
                      setMaxDepth(strategy === "multiobjective" ? "6" : "5");
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="top-k">Top-K</option>
                    <option value="multiobjective">Multiobjetivo</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Top K por nó</span>
                  <input
                    value={topKPerNode}
                    onChange={(event) => setTopKPerNode(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Profundidade máxima</span>
                  <input
                    value={maxDepth}
                    onChange={(event) => setMaxDepth(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-500">Min weight</span>
                  <input
                    value={polytreeMinWeight}
                    onChange={(event) => setPolytreeMinWeight(event.target.value)}
                    type="number"
                    min="0"
                    placeholder="opcional"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                {polytreeStrategy === "multiobjective" ? (
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">Preserve weight target</span>
                    <input
                      value={preserveWeightTarget}
                      onChange={(event) => setPreserveWeightTarget(event.target.value)}
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm transition focus:border-thesis focus:outline-none focus:ring-4 focus:ring-thesis/10"
                    />
                  </label>
                ) : null}
              </div>

              {polytreeStrategy === "multiobjective" ? (
                <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-thesis">Parâmetros avançados</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    {[
                      ["alpha", alpha, setAlpha],
                      ["beta", beta, setBeta],
                      ["gamma", gamma, setGamma],
                      ["delta", delta, setDelta],
                      ["epsilon", epsilon, setEpsilon],
                      ["zeta", zeta, setZeta],
                      ["max branching", maxBranching, setMaxBranching],
                      ["min score", minScore, setMinScore],
                    ].map(([label, value, setter]) => (
                      <label key={String(label)} className="block">
                        <span className="text-xs font-semibold uppercase text-slate-500">{String(label)}</span>
                        <input
                          value={String(value)}
                          onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                          type="number"
                          step="0.01"
                          min="0"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-mono tabular-nums transition focus:border-thesis focus:outline-none focus:ring-4 focus:ring-thesis/10"
                        />
                      </label>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleUpload}
                disabled={isUploading || !file}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-700 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-700/30 transition hover:-translate-y-0.5 hover:from-cyan-600 hover:to-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <FileUp className="h-4 w-4" />
                {isUploading ? "A enviar..." : "Enviar ficheiro"}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !jobId}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:-translate-y-0.5 hover:from-amber-500 hover:to-amber-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <Play className="h-4 w-4" />
                {isAnalyzing ? "A analisar..." : "Executar RAMEX completo"}
              </button>
            </div>

            {error ? (
              <WarningPanel>
                <div className="space-y-2">
                  <p>{error}</p>
                  {jobState?.error?.technical ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowTechnicalError((value) => !value)}
                        className="text-sm font-semibold text-cyan-700 underline"
                      >
                        {showTechnicalError ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
                      </button>
                      {showTechnicalError ? (
                        <pre className="mt-2 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                          {jobState.error.technical}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </WarningPanel>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">Pipeline vivo</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Progresso</span>
                <span className="font-mono font-semibold tabular-nums text-cyan-700">{jobState?.progress ?? 0}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${jobState?.progress ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Etapa atual: <span className="font-semibold text-slate-800">{jobState?.current_step ?? "A aguardar upload"}</span>
              </p>
            </div>

            <div className="pb-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(jobState?.steps ?? []).map((step) => {
                const icon =
                  step.status === "completed"
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : step.status === "running"
                      ? <Activity className="h-3.5 w-3.5" />
                      : step.status === "failed"
                        ? "!"
                        : <Circle className="h-3.5 w-3.5" />;
                const bg =
                  step.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : step.status === "running"
                      ? "bg-cyan-100 text-cyan-700"
                      : step.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500";
                return (
                  <div
                    key={step.id}
                    className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 text-sm text-slate-700 ${
                      step.status === "running"
                        ? "border-cyan-200 bg-cyan-50/80 shadow-md shadow-cyan-100/40"
                        : "border-slate-200/70 bg-slate-50/80"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${bg} ${step.status === "running" ? "ramex-pulse" : ""}`}>
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1 break-words leading-5">{step.label}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">{step.progress}%</span>
                  </div>
                );
              })}
                {!jobState ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">A aguardar upload</div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Últimos logs</p>
              <div className="mt-2 space-y-2 rounded-2xl bg-slate-950 p-3 font-mono text-xs text-slate-100">
                {(jobState?.logs ?? [])
                  .slice(-5)
                  .reverse()
                  .map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 break-words">
                      <span className="text-slate-400">{log.timestamp}</span> · {log.message}
                    </div>
                  ))}
                {jobState?.logs?.length ? null : (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-300">Sem logs ainda.</div>
                )}
              </div>
            </div>
          </div>
          {jobId ? <p className="mt-4 font-mono text-xs text-slate-500">job_id: {jobId}</p> : null}
        </div>
      </div>

      {result ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Sequências" value={formatNumber(result.metrics.sequences)} />
            <MetricCard label="Nós" value={formatNumber(result.metrics.nodes)} />
            <MetricCard label="Arestas" value={formatNumber(result.metrics.edges)} />
            <MetricCard label="Densidade" value={result.metrics.density.toFixed(4)} />
            <MetricCard label="PESO POLY-TREE FORMAL" value={`${result.metrics.preserved_percentage.toFixed(2)}%`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <ReportButton onClick={handleDownloadUploadReport} />
            <ReportExportButton data={uploadReportData} disabled={!uploadReportData} />
          </div>
          {uploadReportProblem ? <WarningPanel>{uploadReportProblem}</WarningPanel> : null}

          {result.metrics.dense ? (
            <WarningPanel>
              O grafo gerado é denso. Para melhorar a leitura, aumente a frequência mínima ou use Top N.
            </WarningPanel>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">Resumo interpretativo</h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.interpretation}</p>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Top transições</p>
                <div className="mt-2 space-y-2">
                  {result.top_transitions.map((edge, index) => (
                    <p key={`${edge.From}-${edge.To}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                      {edge.From} → {edge.To} ({formatNumber(edge.Weight)})
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <MatrixTable matrix={result.matrix} datasetId="03" />
          </div>

          <div className="grid grid-cols-1 gap-8">
            <GraphViewer
              title="Grafo completo"
              subtitle="Rede dirigida ponderada construída a partir das transições observadas no dataset."
              imageSrc={graphImageSrc}
              nodes={result.metrics.nodes}
              edges={result.metrics.edges}
              mode="complete"
              legend="Grafo observado"
            >
              <GraphRelationsTable title="Transição" rows={graphRelationRows} mode="complete" />
            </GraphViewer>

            {result.analysis_type !== "forum" ? (
              <GraphViewer
                title="Poly-tree formal / RAMEX"
                subtitle={`Estrutura RAMEX pura selecionada a partir do grafo completo. Raiz/âncora: ${rootNode ?? "indisponível"}.`}
                imageSrc={pureImageSrc}
                nodes={result.formal_polytree?.metrics?.selected_nodes ?? result.metrics.ramex_edges + 1}
                edges={result.formal_polytree?.metrics?.selected_edges ?? result.metrics.ramex_edges}
                mode="pure"
                legend="RAMEX Puro"
              >
                <GraphRelationsTable
                  title="Aresta selecionada"
                  rows={pureRelationRows.length > 0 ? pureRelationRows : fallbackPureRelationRows}
                  mode="pure"
                />
              </GraphViewer>
            ) : null}

            {result.analysis_type === "both" || result.analysis_type === "forum" ? (
              <GraphViewer
                title="RAMEX-Forum"
                subtitle="Grafo de influência RAMEX-Forum com relações normalizadas e leitura complementar de caminhos dominantes."
                imageSrc={forumImageSrc}
                nodes={forumResult?.metrics?.nodes}
                edges={forumResult?.metrics?.edges}
                mode="forum"
                legend="Influence analysis"
              >
                <GraphRelationsTable title="Relação normalizada" rows={forumRelationRows} mode="forum" />
              </GraphViewer>
            ) : null}
          </div>

          {showExperimental && result.polytree ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-ink">RAMEX Poly-tree</h3>
              <PolyTreePanel data={result.polytree} rows={result.polytree_edges ?? []} />
              {result.files.polytree_png ? (
                <a
                  href={`${API_BASE_URL}/api/file/${result.job_id}/${result.files.polytree_png}`}
                  target="_blank"
                  className="text-sm font-semibold text-thesis underline"
                >
                  Abrir PNG da Poly-tree
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function Home() {
  const [datasetId, setDatasetId] = useState<DatasetId>("03");
  const [viewId, setViewId] = useState<ViewId>("upload");
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixData>();
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [ramexEdges, setRamexEdges] = useState<Edge[]>([]);
  const [polytreeData, setPolytreeData] = useState<PolyTreeData>();
  const [polytreeRows, setPolytreeRows] = useState<PolyTreeTableRow[]>([]);
  const [polytreeError, setPolytreeError] = useState("");
  const [polytreeViewStrategy, setPolytreeViewStrategy] = useState<PolyTreeStrategy>("top-k");
  const [pureRamexData, setPureRamexData] = useState<PureRamexData>();
  const [staticForumData, setStaticForumData] = useState<RamexForumData>();
  const [executiveText, setExecutiveText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadedResult, setUploadedResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    let mounted = true;
    const currentErrors: string[] = [];

    async function loadData() {
      try {
        const validation = await loadCsv("validacao_comparativa.csv", validationMapper);
        if (mounted) setValidationRows(validation);
      } catch (error) {
        currentErrors.push(error instanceof Error ? error.message : "Erro ao carregar validação comparativa.");
      }

      try {
        const textResponse = await fetch(dataPath("validacao_comparativa.txt"));
        if (textResponse.ok) {
          const text = await textResponse.text();
          if (mounted) setExecutiveText(text);
        }
      } catch {
        currentErrors.push("Não foi possível carregar o relatório TXT.");
      }

      if (mounted) setErrors(currentErrors);
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const currentErrors: string[] = [];

    async function loadDatasetData() {
      setMatrix(undefined);
      setGraphEdges([]);
      setRamexEdges([]);
      setPolytreeData(undefined);
      setPolytreeRows([]);
      setPolytreeError("");
      setPolytreeViewStrategy("top-k");
      setPureRamexData(undefined);

      try {
        const loadedMatrix = await loadMatrix(`matriz_adjacencia_dataset${datasetId}.csv`);
        if (mounted) setMatrix(loadedMatrix);
      } catch (error) {
        currentErrors.push(error instanceof Error ? error.message : "Erro ao carregar matriz.");
      }

      try {
        const loadedGraphEdges = await loadCsv(`grafo_edges_dataset${datasetId}.csv`, edgeMapper);
        if (mounted) setGraphEdges(loadedGraphEdges);
      } catch (error) {
        currentErrors.push(error instanceof Error ? error.message : "Erro ao carregar grafo.");
      }

      try {
        const loadedRamexEdges = await loadCsv(`ramex_dataset${datasetId}.csv`, edgeMapper);
        if (mounted) setRamexEdges(loadedRamexEdges);
      } catch (error) {
        currentErrors.push(error instanceof Error ? error.message : "Erro ao carregar RAMEX.");
      }

      try {
        const loadedPolytree = await loadJson<PolyTreeData>(`ramex_polytree_dataset${datasetId}.json`);
        if (mounted) {
          setPolytreeData(loadedPolytree);
          setPolytreeViewStrategy(loadedPolytree.strategy === "multiobjective" ? "multiobjective" : "top-k");
        }
      } catch (error) {
        if (mounted) setPolytreeError("Poly-tree ainda não gerado para este dataset.");
      }

      try {
        const loadedPolytreeRows = await loadCsv(`ramex_polytree_dataset${datasetId}.csv`, polytreeRowMapper);
        if (mounted) setPolytreeRows(loadedPolytreeRows);
      } catch {
        if (mounted) setPolytreeRows([]);
      }

      const pureMissing: string[] = [];
      let ramex2007: PureRamexResult | undefined;
      let forward: PureRamexResult | undefined;
      let backForward: PureRamexResult | undefined;
      let comparisonRows: PureRamexComparisonRow[] = [];
      let comparisonMarkdown: string | undefined;
      let multidatasetMarkdown: string | undefined;

      try {
        ramex2007 = await loadJson<PureRamexResult>(`ramex2007_dataset${datasetId}.json`);
      } catch {
        pureMissing.push(`ramex2007_dataset${datasetId}.json`);
      }
      try {
        forward = await loadJson<PureRamexResult>(`ramex_forward_dataset${datasetId}.json`);
      } catch {
        pureMissing.push(`ramex_forward_dataset${datasetId}.json`);
      }
      try {
        backForward = await loadJson<PureRamexResult>(`ramex_back_forward_dataset${datasetId}.json`);
      } catch {
        pureMissing.push(`ramex_back_forward_dataset${datasetId}.json`);
      }
      try {
        comparisonRows = await loadCsv(`validacao_ramex_puro_dataset${datasetId}.csv`, pureComparisonMapper);
      } catch {
        pureMissing.push(`validacao_ramex_puro_dataset${datasetId}.csv`);
      }
      comparisonMarkdown = await loadOptionalText(`validacao_ramex_puro_dataset${datasetId}.md`);
      multidatasetMarkdown = await loadOptionalText("validacao_ramex_multidataset.md");

      if (mounted) {
        setPureRamexData({
          ramex2007,
          forward,
          backForward,
          comparisonRows,
          comparisonMarkdown,
          multidatasetMarkdown,
          missing: pureMissing,
        });
      }

      try {
        const loadedForum = await loadJson<RamexForumData>(`dataset${datasetId}/forum/ramex_forum_metrics.json`);
        if (mounted) setStaticForumData(loadedForum);
      } catch {
        if (mounted) setStaticForumData(undefined);
      }

      if (mounted) setErrors(currentErrors);
    }

    loadDatasetData();
    return () => {
      mounted = false;
    };
  }, [datasetId]);

  const selectedValidation = useMemo(() => {
    return validationRows.find((row) => datasetLabelToId(row.Dataset) === datasetId);
  }, [datasetId, validationRows]);

  const rootNode = useMemo(() => {
    const levelOne = ramexEdges.find((edge) => edge.Level === 1);
    return levelOne?.From ?? ramexEdges[0]?.From;
  }, [ramexEdges]);

  const denseGraph = selectedValidation ? selectedValidation.Arestas_Grafo > 1000 : graphEdges.length > 1000;
  const staticTopTransitions = useMemo(
    () => [...graphEdges].sort((a, b) => b.Weight - a.Weight).slice(0, 10),
    [graphEdges],
  );

  // For static datasets, transition matrix is not available (would need to be generated)
  const staticTransitionMatrix = undefined;

  function handleDownloadStaticReport() {
    const report = buildTechnicalReport({
      datasetName: datasets[datasetId].label,
      origin: "prÃ©-carregado",
      datasetType: "dataset prÃ©-carregado",
      params: {
        minFrequency: 0,
        topN: null,
        maxDepth: pureRamexData?.backForward?.metrics?.max_depth_reached ?? pureRamexData?.backForward?.metrics?.max_depth,
      },
      metrics: {
        nodes: selectedValidation?.Nos_Grafo,
        edges: selectedValidation?.Arestas_Grafo,
        totalWeight: selectedValidation?.Soma_Pesos_Grafo,
        density: selectedValidation?.Densidade_Aproximada,
        ramexEdges: selectedValidation?.Arestas_RAMEX,
        ramexPreserved: selectedValidation?.Percentagem_Peso_Preservado,
        polytreeEdges: pureRamexData?.backForward?.metrics?.selected_edges,
        polytreePreserved: pureRamexData?.backForward?.metrics?.preserved_weight_percent,
        root: rootNode,
        polytreeRoot: pure_anchor_frontend(pureRamexData?.backForward),
      },
      topTransitions: staticTopTransitions,
      polytreeEdges: pureRamexData?.backForward?.edges?.map(pureEdgeToTable),
      pureRamex: {
        bestAlgorithm: pureRamexBest(pureRamexData),
        structuralType: pureRamexStructuralType(selectedValidation, pureRamexData),
        summary: pureRamexScientificSummary(selectedValidation, pureRamexData),
        rows: pureRamexRowsForReport(pureRamexData),
      },
      interpretation: selectedValidation?.Interpretacao,
    });
    downloadMarkdown(`relatorio_tecnico_dataset${datasetId}.md`, report);
  }

  function handleDownloadCurrentReport() {
    if (!uploadedResult) {
      handleDownloadStaticReport();
      return;
    }

    const report = buildTechnicalReport({
      datasetName: uploadedResult.filename,
      origin: "upload",
      datasetType: "upload analisado",
      params: {
        minFrequency: 0,
        topN: null,
        maxDepth: uploadedResult.formal_polytree?.metrics?.max_depth_reached ?? uploadedResult.formal_polytree?.metrics?.max_depth,
      },
      metrics: {
        sequences: uploadedResult.metrics.sequences,
        nodes: uploadedResult.metrics.nodes,
        edges: uploadedResult.metrics.edges,
        totalWeight: uploadedResult.metrics.total_weight,
        density: uploadedResult.metrics.density,
        ramexEdges: uploadedResult.metrics.ramex_edges,
        ramexPreserved: uploadedResult.metrics.preserved_percentage,
        polytreeEdges: uploadedResult.formal_polytree?.metrics?.selected_edges,
        polytreePreserved: uploadedResult.formal_polytree?.metrics?.preserved_weight_percent,
        root: uploadedResult.metrics.root,
        polytreeRoot: pure_anchor_frontend(uploadedResult.formal_polytree),
      },
      topTransitions: uploadedResult.top_transitions,
      polytreeEdges: uploadedResult.formal_polytree?.edges?.map(pureEdgeToTable),
      pureRamex: {
        bestAlgorithm: uploadedResult.pure_validation?.best_algorithm ?? pureRamexBest(uploadedResult.pure_ramex),
        summary: uploadedResult.pure_validation?.summary ?? pureRamexScientificSummary(demoValidation, uploadedResult.pure_ramex),
        structuralType: uploadedResult.pure_validation?.structural_type ?? pureRamexStructuralType(demoValidation, uploadedResult.pure_ramex),
        rows: pureRamexRowsForReport(uploadedResult.pure_ramex),
      },
      ramexForum: forumToReport(uploadedResult.ramex_forum, uploadedResult.job_id),
      interpretation: uploadedResult.interpretation,
    });
    downloadMarkdown(`relatorio_tecnico_${sanitizeReportName(uploadedResult.job_id)}.md`, report);
  }

  const demoValidation = uploadedResult
    ? ({
        Dataset: `Upload: ${uploadedResult.filename}`,
        Nos_Grafo: uploadedResult.metrics.nodes,
        Arestas_Grafo: uploadedResult.metrics.edges,
        Soma_Pesos_Grafo: uploadedResult.metrics.total_weight,
        Arestas_RAMEX: uploadedResult.metrics.ramex_edges,
        Soma_Pesos_RAMEX: uploadedResult.metrics.ramex_weight,
        Percentagem_Peso_Preservado: uploadedResult.metrics.preserved_percentage,
        Densidade_Aproximada: uploadedResult.metrics.density,
        Top_5_Transicoes: "",
        Interpretacao: uploadedResult.interpretation,
      } satisfies ValidationRow)
    : selectedValidation;

  const staticReportData: ReportData | undefined = selectedValidation
    ? {
        datasetName: datasets[datasetId].label,
        datasetOrigin: "preloaded",
        analysisType: "pure",
        datasetType: "dataset prÃ©-carregado",
        generatedAt: new Date().toLocaleString("pt-PT"),
        parameters: {
          minFrequency: 0,
          topN: null,
          polytreeStrategy: polytreeData?.strategy ?? "top-k",
          topKPerNode: Number(polytreeData?.parameters?.top_k_per_node ?? 2),
          maxDepth: polytreeData?.metrics.max_depth,
          minWeight: Number(polytreeData?.parameters?.min_weight ?? 0),
          alpha: Number(polytreeData?.parameters?.alpha ?? 0.35),
          beta: Number(polytreeData?.parameters?.beta ?? 0.25),
          gamma: Number(polytreeData?.parameters?.gamma ?? 0.15),
          delta: Number(polytreeData?.parameters?.delta ?? 0.15),
          epsilon: Number(polytreeData?.parameters?.epsilon ?? 0.05),
          zeta: Number(polytreeData?.parameters?.zeta ?? 0.05),
          preserveWeightTarget: Number(polytreeData?.parameters?.preserve_weight_target ?? 0.7),
          maxBranching: Number(polytreeData?.parameters?.max_branching ?? 3),
          minScore: Number(polytreeData?.parameters?.min_score ?? 0),
        },
        metrics: {
          nodes: selectedValidation.Nos_Grafo,
          edges: selectedValidation.Arestas_Grafo,
          density: selectedValidation.Densidade_Aproximada,
          totalWeight: selectedValidation.Soma_Pesos_Grafo,
          ramexEdges: selectedValidation.Arestas_RAMEX,
          ramexWeight: selectedValidation.Soma_Pesos_RAMEX,
          ramexPreservedPercent: selectedValidation.Percentagem_Peso_Preservado,
          polytreeNodes: pureRamexData?.backForward?.metrics?.selected_nodes,
          polytreeEdges: pureRamexData?.backForward?.metrics?.selected_edges,
          polytreeWeight: pureRamexData?.backForward?.metrics?.selected_weight_sum,
          polytreePreservedPercent: pureRamexData?.backForward?.metrics?.preserved_weight_percent,
          ramex2007PreservedPercent: pureRamexData?.ramex2007?.metrics?.preserved_weight_percent,
          forwardPreservedPercent: pureRamexData?.forward?.metrics?.preserved_weight_percent,
          backForwardPreservedPercent: pureRamexData?.backForward?.metrics?.preserved_weight_percent,
        },
        topTransitions: staticTopTransitions.map(edgeToReport),
        allTransitions: graphEdges.map(edgeToReport),
        transitionMatrix: staticTransitionMatrix,
        ramexEdges: ramexEdges.map(edgeToReport),
        polytreeEdges: pureRamexData?.backForward?.edges?.map(pureEdgeToReport),
        pureRamex: {
          bestAlgorithm: pureRamexBest(pureRamexData),
          structuralType: pureRamexStructuralType(selectedValidation, pureRamexData),
          summary: pureRamexScientificSummary(selectedValidation, pureRamexData),
          rows: pureRamexRowsForReport(pureRamexData),
        },
        interpretations: {
          executiveSummary: `${selectedValidation.Interpretacao} A análise é enquadrada no RAMEX puro com validação formal da Poly-tree.`,
          graphInterpretation: selectedValidation.Interpretacao,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A Poly-tree formal valida estruturalmente a saída RAMEX pura.",
          conclusion:
            "A implementação atual integra RAMEX puro, validação formal da Poly-tree e alinhamento conceptual com Cavique (2007, 2015).",
        },
        images: {
          graph: dataPath(`grafo_dataset${datasetId}.png`),
          ramex: dataPath(`ramex_dataset${datasetId}.png`),
          polytree: dataPath(`ramex_back_forward_formal_dataset${datasetId}.png`),
        },
      }
    : undefined;

  const uploadedReportProblem = reportCompletenessError(uploadedResult);
  const uploadedReportData: ReportData | undefined = uploadedResult && !uploadedReportProblem
    ? {
        datasetName: uploadedResult.filename,
        datasetOrigin: "upload",
        analysisType: uploadedResult.analysis_type,
        datasetType: "upload analisado",
        generatedAt: new Date().toLocaleString("pt-PT"),
        parameters: {
          minFrequency: 0,
          topN: null,
          polytreeStrategy: uploadedResult.polytree?.strategy ?? "top-k",
          topKPerNode: Number(uploadedResult.polytree?.parameters?.top_k_per_node ?? 2),
          maxDepth: uploadedResult.polytree?.metrics.max_depth,
          minWeight: Number(uploadedResult.polytree?.parameters?.min_weight ?? 0),
          alpha: Number(uploadedResult.polytree?.parameters?.alpha ?? 0.35),
          beta: Number(uploadedResult.polytree?.parameters?.beta ?? 0.25),
          gamma: Number(uploadedResult.polytree?.parameters?.gamma ?? 0.15),
          delta: Number(uploadedResult.polytree?.parameters?.delta ?? 0.15),
          epsilon: Number(uploadedResult.polytree?.parameters?.epsilon ?? 0.05),
          zeta: Number(uploadedResult.polytree?.parameters?.zeta ?? 0.05),
          preserveWeightTarget: Number(uploadedResult.polytree?.parameters?.preserve_weight_target ?? 0.7),
          maxBranching: Number(uploadedResult.polytree?.parameters?.max_branching ?? 3),
          minScore: Number(uploadedResult.polytree?.parameters?.min_score ?? 0),
        },
        metrics: {
          sequences: uploadedResult.metrics.sequences,
          nodes: uploadedResult.metrics.nodes,
          edges: uploadedResult.metrics.edges,
          density: uploadedResult.metrics.density,
          totalWeight: uploadedResult.metrics.total_weight,
          ramexEdges: uploadedResult.metrics.ramex_edges,
          ramexWeight: uploadedResult.metrics.ramex_weight,
          ramexPreservedPercent: uploadedResult.metrics.preserved_percentage,
          polytreeNodes: uploadedResult.formal_polytree?.metrics?.selected_nodes,
          polytreeEdges: uploadedResult.formal_polytree?.metrics?.selected_edges,
          polytreeWeight: uploadedResult.formal_polytree?.metrics?.selected_weight_sum,
          polytreePreservedPercent: uploadedResult.formal_polytree?.metrics?.preserved_weight_percent,
          ramex2007PreservedPercent: uploadedResult.pure_ramex?.ramex2007?.metrics?.preserved_weight_percent,
          forwardPreservedPercent: uploadedResult.pure_ramex?.forward?.metrics?.preserved_weight_percent,
          backForwardPreservedPercent: uploadedResult.pure_ramex?.backForward?.metrics?.preserved_weight_percent,
        },
        topTransitions: uploadedResult.top_transitions.map(edgeToReport),
        ramexEdges: uploadedResult.ramex_edges.map(edgeToReport),
        polytreeEdges: uploadedResult.formal_polytree?.edges?.map(pureEdgeToReport),
        pureRamex: {
          bestAlgorithm: uploadedResult.pure_validation?.best_algorithm ?? pureRamexBest(uploadedResult.pure_ramex),
          summary: uploadedResult.pure_validation?.summary ?? pureRamexScientificSummary(demoValidation, uploadedResult.pure_ramex),
          structuralType: uploadedResult.pure_validation?.structural_type ?? pureRamexStructuralType(demoValidation, uploadedResult.pure_ramex),
          rows: pureRamexRowsForReport(uploadedResult.pure_ramex),
        },
        ramexForum: forumToReport(uploadedResult.ramex_forum ?? uploadedResult.forum, uploadedResult.job_id),
        interpretations: {
          executiveSummary: `${uploadedResult.interpretation} A análise é enquadrada no RAMEX puro com validação formal da Poly-tree.`,
          graphInterpretation: uploadedResult.interpretation,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A Poly-tree formal valida estruturalmente a saída RAMEX pura.",
          conclusion:
            "A implementação atual integra RAMEX puro, validação formal da Poly-tree e alinhamento conceptual com Cavique (2007, 2015).",
        },
        images: {
          graph: uploadedResult.files.graph_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.graph_png}`
            : undefined,
          ramex: uploadedResult.files.ramex_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.ramex_png}`
            : undefined,
          polytree: uploadedResult.files.back_forward_formal_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.back_forward_formal_png}`
            : undefined,
          forumGraph: (uploadedResult.ramex_forum ?? uploadedResult.forum)?.files?.graph_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${uploadedResult.job_id}/file/${(uploadedResult.ramex_forum ?? uploadedResult.forum)?.files?.graph_png}`
            : undefined,
          forumSimplified: (uploadedResult.ramex_forum ?? uploadedResult.forum)?.files?.simplified_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${uploadedResult.job_id}/file/${(uploadedResult.ramex_forum ?? uploadedResult.forum)?.files?.simplified_png}`
            : undefined,
        },
      }
    : undefined;

  const currentReportData = uploadedResult ? uploadedReportData : staticReportData;

  function handleSelectPreloadedDataset(id: DatasetId) {
    setDatasetId(id);
    setUploadedResult(null);
  }

  const summaryParagraphs = [
    "Metodologia inspirada nos trabalhos do Professor Luís Cavique sobre RAMEX e sequence mining.",
    "Dataset 01: grafo denso/disperso, com muitos nós, muitas ligações e necessidade de filtragem para leitura visual.",
    "Dataset 02: baixa recorrência, porque as transições surgem sobretudo como eventos únicos e pouco repetidos.",
    "Dataset 03: padrões fortes e interpretáveis, com poucos nós, transições recorrentes e estrutura RAMEX compreensível.",
  ];

  const modeBadge =
    viewId === "forum"
      ? "RAMEX-Forum"
      : viewId === "upload" && uploadedResult?.analysis_type === "both"
        ? "Comparativo"
        : "RAMEX Puro";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-slate-800 bg-slate-950/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r lg:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Artefacto Digital</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white">RAMEX Sequential Analysis Framework</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Visual Analytics científica para análise de padrões sequenciais.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <section>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Dataset</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(datasets) as DatasetId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => handleSelectPreloadedDataset(id)}
                    className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-thesis/10 ${
                      datasetId === id
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-lg shadow-cyan-900/40"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
                    }`}
                  >
                    {datasets[id].short}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Visualização</label>
              <div className="mt-2 space-y-2">
                {views.map((view) => {
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.id}
                      onClick={() => setViewId(view.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-cyan-300/20 ${
                        viewId === view.id
                          ? "border-cyan-300/50 bg-cyan-500/15 text-white shadow-lg shadow-cyan-900/30"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="block">{view.label}</span>
                        <span className={`mt-0.5 block text-xs ${viewId === view.id ? "text-cyan-100/90" : "text-slate-400"}`}>
                          {view.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>

        <section className="flex-1 bg-slate-50 p-5 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {viewId !== "about" ? (
              <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-semibold text-cyan-700">
                    {viewId === "upload" ? "Dataset personalizado" : datasets[datasetId].label}
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                    {views.find((view) => view.id === viewId)?.label}
                  </h2>
                  {uploadedResult?.job_id ? (
                    <p className="mt-2 font-mono text-xs text-slate-500">job_id: {uploadedResult.job_id}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700">
                    {modeBadge}
                  </div>
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {uploadedResult?.filename ?? datasets[datasetId].label}
                  </div>
                  {uploadedResult?.job_id ? (
                    <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-xs font-semibold text-slate-600">
                      job_id {uploadedResult.job_id}
                    </div>
                  ) : null}
                  <div className="scale-[0.92]">
                    <ReportExportButton data={currentReportData} disabled={!currentReportData} label="Exportar relatório" />
                  </div>
                </div>
              </header>
            ) : null}

            {errors.length > 0 ? (
              <div className="space-y-2">
                {errors.map((error) => (
                  <WarningPanel key={error}>{error}</WarningPanel>
                ))}
              </div>
            ) : null}

            {viewId !== "upload" && viewId !== "history" && viewId !== "about" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Nós" value={formatNumber(selectedValidation?.Nos_Grafo ?? 0)} />
                <MetricCard label="Arestas" value={formatNumber(selectedValidation?.Arestas_Grafo ?? graphEdges.length)} />
                <MetricCard
                  label="Densidade"
                  value={(selectedValidation?.Densidade_Aproximada ?? 0).toFixed(4)}
                  note="grafo dirigido"
                />
                <MetricCard
                  label="Soma dos pesos"
                  value={formatNumber(selectedValidation?.Soma_Pesos_Grafo ?? 0)}
                />
                <MetricCard
                  label="PESO POLY-TREE FORMAL"
                  value={`${(selectedValidation?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%`}
                />
              </div>
            ) : null}

            {viewId === "upload" ? <UploadDatasetPanel onAnalyzed={setUploadedResult} /> : null}

            {viewId === "history" ? <HistoryPanel onReuse={setUploadedResult} /> : null}

            {viewId === "about" ? <AboutRamexPanel /> : null}

            {viewId === "demo" ? (
              <DemonstrationPanel
                datasetName={demoValidation?.Dataset ?? datasets[datasetId].label}
                validation={demoValidation}
                pureData={pureRamexData}
                onGoTo={setViewId}
                onReport={handleDownloadCurrentReport}
                pdfData={currentReportData}
              />
            ) : null}

            {viewId === "pure" ? (
              <RamexPurePanel datasetId={datasetId} data={pureRamexData} uploaded={uploadedResult} validation={selectedValidation} />
            ) : null}

            {viewId === "forum" ? (
              <RamexForumPanel
                data={uploadedResult?.ramex_forum ?? uploadedResult?.forum ?? staticForumData}
                jobId={uploadedResult?.ramex_forum || uploadedResult?.forum ? uploadedResult.job_id : undefined}
                graphImage={
                  uploadedResult?.ramex_forum || uploadedResult?.forum
                    ? undefined
                    : dataPath(`dataset${datasetId}/forum/ramex_forum_graph.png`)
                }
                simplifiedImage={
                  uploadedResult?.ramex_forum || uploadedResult?.forum
                    ? undefined
                    : dataPath(`dataset${datasetId}/forum/ramex_forum_simplified.png`)
                }
              />
            ) : null}

            {viewId === "datasets" ? (
              <DatasetsValidationPanel
                rows={validationRows}
                selectedDataset={datasetId}
                onOpenDataset={(id) => {
                  handleSelectPreloadedDataset(id);
                  setViewId("pure");
                }}
              />
            ) : null}

            {viewId === "pipeline" ? <PipelineRamexPanel /> : null}

            {viewId === "reports" ? (
              <ReportsPanel
                datasetName={demoValidation?.Dataset ?? datasets[datasetId].label}
                executiveText={executiveText}
                pureData={pureRamexData}
                onReport={handleDownloadCurrentReport}
                pdfData={currentReportData}
              />
            ) : null}

            {viewId === "matrix" ? (
              <section className="rounded-lg border border-slate-200 bg-white/75 p-5 shadow-panel">
                <MatrixTable matrix={matrix} datasetId={datasetId} />
              </section>
            ) : null}

            {viewId === "graph" ? (
              <section className="space-y-4">
                <GraphCanvas edges={graphEdges} denseHint={denseGraph} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <img
                    src={dataPath(`grafo_dataset${datasetId}.png`)}
                    alt={`Grafo do dataset ${datasetId}`}
                    className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain p-3 shadow-panel"
                  />
                  {datasetId === "01" ? (
                    <img
                      src={dataPath("grafo_dataset01_top50_fase06.png")}
                      alt="Grafo filtrado top 50 do dataset 01"
                      className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain p-3 shadow-panel"
                    />
                  ) : null}
                </div>
              </section>
            ) : null}

            {viewId === "ramex" ? (
              <section className="space-y-4">
                <GraphCanvas edges={ramexEdges} root={rootNode} denseHint={false} />
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <img
                    src={dataPath(`ramex_dataset${datasetId}.png`)}
                    alt={`Estrutura RAMEX base do dataset ${datasetId}`}
                    className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain p-3 shadow-panel"
                  />
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                    <h3 className="text-lg font-semibold text-ink">Estrutura principal</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Nó raiz destacado: <span className="font-semibold text-amberline">{rootNode ?? "indisponível"}</span>.
                      A estrutura mantém as transições selecionadas pela fase 07 e preserva os pesos originais.
                    </p>
                    <p className="mt-4 text-3xl font-semibold text-thesis">
                      {(selectedValidation?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%
                    </p>
                    <p className="text-sm text-slate-500">peso preservado face ao grafo da fase 06</p>
                  </div>
                </div>
              </section>
            ) : null}

            {viewId === "polytree" ? (
              <section className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase text-slate-500">Estratégia Poly-tree</span>
                      <select
                        value={polytreeViewStrategy}
                        onChange={(event) => setPolytreeViewStrategy(event.target.value as PolyTreeStrategy)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-mono tabular-nums transition focus:border-thesis focus:outline-none focus:ring-4 focus:ring-thesis/10"
                      >
                        <option value="top-k">Top-K</option>
                        <option value="multiobjective">Multiobjetivo</option>
                      </select>
                    </label>
                    <button
                      disabled
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
                    >
                      <GitBranch className="h-4 w-4" />
                      Executar Poly-tree
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Nos datasets pré-carregados, esta aba mostra os artefactos já gerados. Para executar uma nova
                    estratégia pelo backend, use Upload Dataset ou o script `10_ramex_polytree.py`.
                  </p>
                </div>
                <PolyTreePanel data={polytreeData} rows={polytreeRows} error={polytreeError} />
              </section>
            ) : null}

            {viewId === "validation" ? (
              <section className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <ReportButton onClick={handleDownloadStaticReport} disabled={!selectedValidation} />
                  <ReportExportButton data={staticReportData} disabled={!staticReportData} />
                </div>
                <ValidationCharts rows={validationRows} />
                <ValidationTable rows={validationRows} />
              </section>
            ) : null}

            {viewId === "summary" ? (
              <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                  <h3 className="text-lg font-semibold text-ink">Resumo executivo</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ReportButton onClick={handleDownloadStaticReport} disabled={!selectedValidation} />
                    <ReportExportButton data={staticReportData} disabled={!staticReportData} />
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                    {summaryParagraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                  <h3 className="text-lg font-semibold text-ink">Conclusão da validação</h3>
                  <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100 scrollbar-thin">
                    {executiveText || "Relatório TXT ainda não gerado."}
                  </pre>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}



