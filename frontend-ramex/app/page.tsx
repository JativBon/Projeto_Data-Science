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
import { RamexSankey } from "../src/components/RamexSankey";

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
  | "sankey"
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
type EventMode = "simple" | "advanced";
type NumericDiscretizationMode = "ignore" | "quantile" | "variation_pct";
type CaseWindowMode = "none" | "daily" | "weekly" | "monthly" | "quarterly";
type PreviewRow = Record<string, string | number | boolean | null>;

type ForumEdge = {
  From?: string;
  To?: string;
  Weight?: number;
  RelativeWeight?: number;
  Rank?: number;
  InfluenceWeight?: number;
  SmoothedWeight?: number;
  Frequency?: number;
  DeltaT?: number;
  TemporalDecay?: number;
  Level?: number;
  Direction?: string;
  Reason?: string;
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
  temporal_phase1?: {
    mode?: string;
    phase?: string;
    parameters?: Record<string, string | number | boolean | null | undefined>;
    metrics?: {
      events?: number;
      entities?: number;
      signals?: number;
      temporal_relations?: number;
      raw_influence_relations?: number;
      filtered_influence_relations?: number;
      latency_max?: number;
      epsilon?: number;
      filters_active?: {
        min_frequency?: number;
        min_influence?: number;
        max_latency?: number | null;
      };
      cycles_allowed?: boolean;
      has_cycles?: boolean;
      multiple_inputs_allowed?: boolean;
      total_influence_weight?: number;
    };
    signal_counter?: {
      rows?: Array<{ entity?: string; timestamp?: string | number; signal?: string; signal_counter?: number }>;
      total_rows?: number;
    };
    temporal_influence?: { edges?: ForumEdge[]; total_edges?: number };
    influence_graph?: { edges?: ForumEdge[]; cycles_allowed?: boolean };
    influence_matrix?: MatrixData;
    interpretation?: string;
    notes?: string[];
    files?: Record<string, string>;
  };
  temporal_phase2?: {
    mode?: string;
    phase?: string;
    metrics?: {
      heuristic_used?: "forward" | "back_and_forward" | string;
      initial_node_mode?: string;
      selected_initial_node?: string | null;
      initial_edge?: string | null;
      nodes_before?: number;
      edges_before?: number;
      nodes_after?: number;
      edges_after?: number;
      total_influence_weight?: number;
      selected_influence_weight?: number;
      preserved_influence_percent?: number;
      max_depth?: number;
      top_k?: number;
      is_dag?: boolean;
      is_tree?: boolean;
      is_polytree?: boolean;
      dominant_path?: string[];
      warnings?: string[];
    };
    structure?: {
      algorithm?: string;
      structure?: string;
      edges?: ForumEdge[];
      validation?: Record<string, boolean>;
    };
    selected_edges?: ForumEdge[];
    dominant_path?: Array<{ Step?: number; From?: string; To?: string; Weight?: number; InfluenceWeight?: number; Direction?: string }>;
    interpretation?: string;
    files?: Record<string, string>;
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

type CoverageMetrics = {
  original_nodes: number;
  original_edges: number;
  filtered_nodes: number;
  filtered_edges: number;
  ramex_nodes: number;
  ramex_edges: number;
  uncovered_nodes: string[];
  uncovered_nodes_count: number;
  node_coverage_percent: number;
  original_weight: number;
  filtered_weight: number;
  ramex_weight: number;
  preserved_weight_percent: number;
  removed_by_filter_edges: number;
  removed_by_filter_weight: number;
  disconnected_components_count: number;
  warning_messages: string[];
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
  coverage_metrics?: CoverageMetrics;
  top_transitions: Edge[];
  matrix: MatrixData;
  graph_edges: Edge[];
  ramex_edges: Edge[];
  event_construction?: {
    mode?: EventMode;
    case_column?: string | null;
    time_column?: string;
    case_window?: CaseWindowMode;
    event_column?: string;
    event_columns?: string[];
    ignored_columns?: string[];
    numeric_discretization?: Record<string, string>;
    rules?: Record<string, string>;
    generated_event_column?: string;
    generated_case_column?: string;
    unique_events?: number;
    event_examples?: string[];
    warnings?: string[];
    explanation?: string;
  };
  ramex2007_transformation?: {
    graph_edges?: Edge[];
    adjacency_matrix?: MatrixData;
    matrix?: MatrixData;
    source_exists?: boolean;
    sink_exists?: boolean;
    has_cycles?: boolean;
    files?: Record<string, string>;
  };
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

type NormalizedUploadResult = {
  observed: {
    sequences: number;
    nodes: number;
    edges: number;
    density: number;
    totalWeight: number;
    topTransitions: Edge[];
    graphEdges: Edge[];
    adjacencyMatrix?: MatrixData;
    graphImage?: string;
    sankeyData: Edge[];
  };
  ramex2007: {
    available: boolean;
    phase1: {
      orderedDataset?: string;
      sequencesWithNextItem?: string;
      source: string;
      sink: string;
      graphGEdges: Edge[];
      adjacencyMatrix?: MatrixData;
      adjacencyMatrixImage?: string;
      hasCycles?: boolean;
    };
    phase2: {
      root?: string;
      method?: string;
      treeCompleteImage?: string;
      treeAnalyticalImage?: string;
      sankeyData: unknown[];
      selectedEdges: unknown[];
      dominantPaths: NonNullable<PureRamexResult["expansion"]>["dominant_paths"];
      metrics?: PureRamexResult["metrics"];
    };
  };
  forum: {
    available: boolean;
    phase1?: NonNullable<RamexForumData["temporal_phase1"]>;
    phase2?: NonNullable<RamexForumData["temporal_phase2"]>;
  };
  experimental: {
    available: boolean;
    simplified?: Edge[];
    forward?: PureRamexResult;
    backForward?: PureRamexResult;
    comparisons?: PureRamexComparisonRow[];
  };
  files: {
    artifacts: Record<string, string>;
  };
  errors: string[];
  warnings: string[];
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
  root_selection?: string;
  nodes_original?: number;
  edges_original?: number;
  nodes_selected?: number;
  edges_selected?: number;
  total_weight_original?: number;
  selected_weight?: number;
  preserved_weight_percent?: number;
  is_dag?: boolean;
  is_arborescence?: boolean;
  root_in_degree?: number;
  max_non_root_in_degree?: number;
  reachable_from_root?: boolean;
  imageUrl?: string;
  csvUrl?: string;
  jsonUrl?: string;
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
    root_in_degree?: number;
    max_non_root_in_degree?: number;
    max_indegree_except_root?: number;
    is_arborescence?: boolean;
    reachable_from_root?: boolean;
  };
  root_selection_method?: string;
  edges?: PureRamexEdge[];
  warnings?: string[];
  transformation?: {
    ordered_csv?: string;
    sequences_csv?: string;
    graph_edges_csv?: string;
    adjacency_matrix_csv?: string;
    adjacency_matrix_png?: string;
    source_node?: string;
    sink_node?: string;
    original_graph_can_contain_cycles?: boolean;
    global_view_note?: string;
  };
  condensation?: {
    compression_ratio?: number;
    removed_edges?: number;
    preserved_weight?: number;
    preserved_weight_percent?: number;
    rooted_branching_algorithm?: string;
  };
  expansion?: {
    dominant_paths?: Array<{
      path?: string;
      branch_depth?: number;
      path_weight?: number;
      bottleneck_weight?: number;
    }>;
    metrics?: {
      dominant_paths_count?: number;
      max_branch_depth?: number;
      average_branching_factor?: number;
      max_branching_factor?: number;
    };
  };
};

type NormalizedRamex2007Result = {
  algorithm: string;
  method?: string;
  root?: string;
  rootSelection?: string;
  nodes: number;
  edges: number;
  selectedWeight: number;
  totalWeight: number;
  preservedWeightPercent: number;
  isDag?: boolean;
  isArborescence?: boolean;
  reachableFromRoot?: boolean;
  rootInDegree?: number;
  maxNonRootInDegree?: number;
  warnings: string[];
  imageUrl?: string;
  csvUrl?: string;
  jsonUrl?: string;
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

type Ramex2007DatasetComparisonRow = {
  Dataset: string;
  Nos: number;
  Arestas: number;
  Raiz: string;
  PesoPreservado: number;
  DAG?: boolean;
  Arborescencia?: boolean;
  Observacao: string;
};

const datasets: Record<DatasetId, { label: string; short: string }> = {
  "01": { label: "Dataset 01", short: "D01" },
  "02": { label: "Dataset 02", short: "D02" },
  "03": { label: "Dataset 03", short: "D03" },
};

const showExperimental = process.env.NEXT_PUBLIC_SHOW_EXPERIMENTAL === "true";

const views: Array<{ id: ViewId; label: string; icon: ElementType; description: string }> = [
  { id: "upload", label: "Upload / Nova Análise", icon: FileUp, description: "Centro de Comando e execução assíncrona" },
  { id: "pure", label: "RAMEX 2007 / 2015", icon: Network, description: "Rooted Branching, Forward e Back-and-Forward" },
  { id: "sankey", label: "Sankey — Fluxos", icon: Activity, description: "Visualização complementar; não substitui RAMEX" },
  { id: "polytree", label: "Validação / Poly-tree", icon: GitBranch, description: "Validação estrutural das árvores e poly-trees" },
  { id: "validation", label: "Comparação de Datasets", icon: BarChart3, description: "Métricas por dataset e abordagem RAMEX" },
  { id: "history", label: "Histórico", icon: HistoryIcon, description: "Análises locais e artefactos gerados" },
  { id: "reports", label: "Relatórios", icon: Download, description: "Exportação técnica em Markdown/PDF" },
  { id: "about", label: "Sobre o RAMEX", icon: BookOpen, description: "Contexto académico e referências" },
  { id: "forum", label: "RAMEX-Forum temporal", icon: Sigma, description: "Sinais, latência e influência temporal" },
  { id: "datasets", label: "Datasets de Validação", icon: Grid3X3, description: "Casos estáticos para benchmark" },
  { id: "pipeline", label: "Pipeline RAMEX", icon: GitBranch, description: "Etapas formais do framework" },
  { id: "demo", label: "Demonstração", icon: Presentation, description: "Dataset → transformação → RAMEX 2007/2015 → Forum temporal" },
  ...(showExperimental
    ? ([
        { id: "matrix", label: "Matriz de Adjacência", icon: Grid3X3, description: "Leitura tabular da transição" },
        { id: "graph", label: "Grafo", icon: Network, description: "Rede completa com amostragem" },
        { id: "ramex", label: "Estrutura RAMEX base", icon: GitBranch, description: "Núcleo selecionado do grafo" },
        { id: "polytree", label: "Poly-tree experimental", icon: GitBranch, description: "Estratégias Top-K e Multiobjetivo como exploração visual" },
        { id: "summary", label: "Resumo Executivo Antigo", icon: Sigma, description: "Consolidação textual da validação" },
      ] as Array<{ id: ViewId; label: string; icon: ElementType; description: string }> )
    : []),
];

const dataPath = (fileName: string) => `/data/${fileName}`;
const API_BASE_URL = process.env.NEXT_PUBLIC_RAMEX_API_URL ?? "http://localhost:8000";

function normalizeRamex2007Result(
  raw?: PureRamexResult,
  urls: { imageUrl?: string; csvUrl?: string; jsonUrl?: string } = {},
): NormalizedRamex2007Result | undefined {
  if (!raw) return undefined;
  const metrics = raw.metrics ?? {};
  return {
    algorithm: raw.algorithm ?? "RAMEX 2007 Rooted Branching",
    method: raw.method,
    root: raw.root,
    rootSelection: raw.root_selection,
    nodes: raw.nodes_selected ?? metrics.selected_nodes ?? 0,
    edges: raw.edges_selected ?? metrics.selected_edges ?? 0,
    selectedWeight: raw.selected_weight ?? metrics.selected_weight_sum ?? 0,
    totalWeight: raw.total_weight_original ?? metrics.original_weight_sum ?? 0,
    preservedWeightPercent: raw.preserved_weight_percent ?? metrics.preserved_weight_percent ?? 0,
    isDag: raw.is_dag ?? metrics.is_dag ?? metrics.is_acyclic,
    isArborescence: raw.is_arborescence ?? metrics.is_arborescence,
    reachableFromRoot: raw.reachable_from_root ?? metrics.reachable_from_root ?? metrics.is_connected,
    rootInDegree: raw.root_in_degree ?? metrics.root_in_degree,
    maxNonRootInDegree: raw.max_non_root_in_degree ?? metrics.max_non_root_in_degree ?? metrics.max_indegree_except_root,
    warnings: raw.warnings ?? [],
    imageUrl: raw.imageUrl ?? urls.imageUrl,
    csvUrl: raw.csvUrl ?? urls.csvUrl,
    jsonUrl: raw.jsonUrl ?? urls.jsonUrl,
  };
}

function ramex2007DatasetComparisonRow(datasetId: DatasetId, raw?: PureRamexResult): Ramex2007DatasetComparisonRow | undefined {
  const normalized = normalizeRamex2007Result(raw);
  if (!normalized) return undefined;
  return {
    Dataset: datasets[datasetId].label,
    Nos: raw?.nodes_original ?? raw?.metrics?.original_nodes ?? 0,
    Arestas: raw?.edges_original ?? raw?.metrics?.original_edges ?? 0,
    Raiz: normalized.root ?? "Sem dados gerados",
    PesoPreservado: normalized.preservedWeightPercent,
    DAG: normalized.isDag,
    Arborescencia: normalized.isArborescence,
    Observacao: normalized.warnings.join(" ") || "RAMEX 2007 formal validado.",
  };
}

function friendlyApiError(error: unknown): string {
  if (error instanceof TypeError) return `Não foi possível contactar o backend RAMEX em ${API_BASE_URL}. Confirme se o FastAPI está ativo na porta 8000.`;
  if (error instanceof Error) return error.message;
  return "Erro inesperado ao contactar o backend RAMEX.";
}

function findColumn(columns: string[], candidates: string[]): string {
  const normalized = columns.map((col) => ({ original: col, key: col.trim().toLowerCase() }));
  for (const candidate of candidates) {
    const match = normalized.find((c) => c.key === candidate.toLowerCase());
    if (match) return match.original;
  }
  for (const candidate of candidates) {
    const match = normalized.find((c) => c.key.includes(candidate.toLowerCase()));
    if (match) return match.original;
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
  if (value === undefined || value === null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace("%", "").replace(",", "."));
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
  if (!response.ok) throw new Error(`Ficheiro não encontrado: ${fileName}`);

  const text = await response.text();
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) throw new Error(`Erro ao ler CSV: ${fileName}`);

  return parsed.data.map(mapper);
}

async function loadMatrix(fileName: string): Promise<MatrixData> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) throw new Error(`Ficheiro não encontrado: ${fileName}`);

  const text = await response.text();
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0 || parsed.data.length === 0) throw new Error(`Não foi possível ler a matriz: ${fileName}`);

  const columns = parsed.meta.fields ?? Object.keys(parsed.data[0]);
  return { columns, rows: parsed.data };
}

async function loadJson<T>(fileName: string): Promise<T> {
  const response = await fetch(dataPath(fileName));
  if (!response.ok) throw new Error(`Ficheiro não encontrado: ${fileName}`);
  return response.json();
}

async function uploadDataset(file: File): Promise<{ job_id: string; filename: string; columns: string[]; preview_rows?: PreviewRow[]; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail ?? "Erro ao enviar ficheiro.");
  return payload;
}

async function startAnalyzeUploadedDataset(payload: {
  job_id: string;
  dataset_type: UploadDatasetType;
  analysis_type?: AnalysisType;
  case_column?: string;
  entity_column?: string;
  time_column?: string;
  event_column?: string;
  event_mode?: EventMode;
  event_columns?: string[];
  numeric_discretization?: Record<string, NumericDiscretizationMode>;
  case_window?: CaseWindowMode;
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
  forum_initial_node?: string | null;
  forum_forward_top_k?: number;
  forum_max_depth?: number;
  forum_min_smoothed_weight?: number | null;
  forum_force_heuristic?: "auto" | "forward" | "back_and_forward";
}): Promise<{ job_id: string; status: string }> {
  console.log("RUN FULL PAYLOAD SENT", payload);
  const response = await fetch(`${API_BASE_URL}/api/analyze?async_mode=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Erro ao iniciar análise RAMEX assíncrona.");
  return data;
}

async function getJobState(jobId: string): Promise<JobState> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/jobs/${jobId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Erro ao obter estado do job.");
  return data as JobState;
}

async function getJobResult(jobId: string): Promise<UploadResult | null> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/jobs/${jobId}/result`);
  if (response.status === 202) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Erro ao obter resultado final do job.");
  return withCoverageMetrics(data as UploadResult);
}

async function getHistoryJobs(): Promise<HistoryJob[]> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/history`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Erro ao carregar histórico RAMEX.");
  return data.jobs ?? [];
}

async function getHistoryJobDetail(jobId: string): Promise<HistoryJobDetail> {
  const response = await fetch(`${API_BASE_URL}/api/ramex/history/${jobId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "Erro ao carregar detalhe do histórico.");
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

function formatNumber(value: unknown, fractionDigits = 0): string {
  if (value === undefined || value === null || value === "") return "-";

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace("%", "").replace(",", "."));

  if (!Number.isFinite(parsed)) return String(value);

  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(parsed);
}

function nodesFromEdges(edges: Edge[]): Set<string> {
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.From);
    nodes.add(edge.To);
  }
  return nodes;
}

function edgeWeightSum(edges: Edge[]): number {
  return edges.reduce((sum, edge) => sum + (Number.isFinite(edge.Weight) ? edge.Weight : 0), 0);
}

function withCoverageMetrics(result: UploadResult): UploadResult {
  if (result.coverage_metrics) return result;

  const filteredNodes = nodesFromEdges(result.graph_edges ?? []);
  const ramexNodes = nodesFromEdges(result.ramex_edges ?? []);
  const uncoveredNodes = Array.from(filteredNodes).filter((node) => !ramexNodes.has(node)).sort();
  const originalNodes = result.metrics.nodes ?? filteredNodes.size;
  const originalEdges = result.metrics.edges ?? result.graph_edges.length;
  const originalWeight = result.metrics.total_weight ?? edgeWeightSum(result.graph_edges ?? []);
  const filteredWeight = edgeWeightSum(result.graph_edges ?? []);
  const ramexWeight = result.metrics.ramex_weight ?? edgeWeightSum(result.ramex_edges ?? []);
  const nodeCoveragePercent = originalNodes > 0 ? (ramexNodes.size / originalNodes) * 100 : 0;
  const preservedWeightPercent = originalWeight > 0 ? (ramexWeight / originalWeight) * 100 : 0;
  const warningMessages = [
    "coverage_metrics não veio no payload do backend; este diagnóstico foi reconstruído no frontend com os dados disponíveis.",
  ];

  if (uncoveredNodes.length > 0) {
    warningMessages.push(`${uncoveredNodes.length} nó(s) do grafo filtrado não aparecem na estrutura RAMEX atual.`);
  }
  // Aviso de peso preservado removido: refere-se à heurística greedy experimental (RAMEX base),
  // não ao RAMEX 2007 formal. Condensação baixa é esperada em grafos densos e não é um erro.

  return {
    ...result,
    coverage_metrics: {
      original_nodes: originalNodes,
      original_edges: originalEdges,
      filtered_nodes: filteredNodes.size,
      filtered_edges: result.graph_edges.length,
      ramex_nodes: ramexNodes.size,
      ramex_edges: result.ramex_edges.length,
      uncovered_nodes: uncoveredNodes,
      uncovered_nodes_count: uncoveredNodes.length,
      node_coverage_percent: nodeCoveragePercent,
      original_weight: originalWeight,
      filtered_weight: filteredWeight,
      ramex_weight: ramexWeight,
      preserved_weight_percent: preservedWeightPercent,
      removed_by_filter_edges: Math.max(originalEdges - result.graph_edges.length, 0),
      removed_by_filter_weight: Math.max(originalWeight - filteredWeight, 0),
      disconnected_components_count: 0,
      warning_messages: warningMessages,
    },
  };
}

function structuralColumnSet(...columns: Array<string | undefined | null>) {
  return new Set(columns.filter(Boolean).map((column) => String(column).trim().toLowerCase()));
}

function isStructuralEventColumn(column: string, caseColumn?: string, timeColumn?: string) {
  const structural = structuralColumnSet(caseColumn, timeColumn);
  return structural.has(column.trim().toLowerCase());
}

function inferAdvancedEventColumns(columns: string[], caseColumn?: string, timeColumn?: string, simpleEventColumn?: string) {
  const structural = structuralColumnSet(caseColumn, timeColumn);
  const usableColumns = columns.filter((column) => !structural.has(column.trim().toLowerCase()));
  const asset = findColumn(columns, ["asset", "ativo", "symbol", "ticker", "produto"]);
  const signal = findColumn(columns, ["signal", "sinal", "event", "evento", "estado"]);
  const variation = findColumn(columns, ["variation_pct", "variation", "var_pct", "change_pct", "return_pct"]);
  const hasAssetSignal = Boolean(asset && signal && usableColumns.includes(asset) && usableColumns.includes(signal));
  const fallbackEvent = simpleEventColumn && !structural.has(simpleEventColumn.trim().toLowerCase()) ? simpleEventColumn : "";
  const selected = hasAssetSignal ? [asset, signal] : [fallbackEvent].filter(Boolean);
  return {
    selected,
    numericRules: variation ? { [variation]: "variation_pct" as NumericDiscretizationMode } : {},
    recommendation: hasAssetSignal
      ? `Sugestão automática: evento = ${asset} + "_" + ${signal}${variation ? `, com ${variation} discretizada se quiser enriquecer o evento.` : "."}`
      : "",
  };
}

function isNumericPreviewColumn(rows: PreviewRow[], column: string) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  if (!values.length) return false;
  return values.filter((value) => Number.isFinite(Number(String(value).replace(",", ".")))).length / values.length >= 0.8;
}

function discretizePreviewValue(value: unknown, mode: NumericDiscretizationMode) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || mode === "ignore") return "";
  if (mode === "variation_pct") {
    if (parsed < -2) return "STRONG_DOWN";
    if (parsed < -0.5) return "DOWN";
    if (parsed <= 0.5) return "STABLE";
    if (parsed <= 2) return "UP";
    return "STRONG_UP";
  }
  if (parsed < 0) return "LOW";
  if (parsed === 0) return "MEDIUM";
  return "HIGH";
}

function sanitizePreviewEventPart(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "nan") return "";
  return text.replace(/\s+/g, "_").replace(/[^0-9A-Za-zÀ-ÿ._-]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function buildAdvancedPreviewEvent(row: PreviewRow, rows: PreviewRow[], eventColumns: string[], rules: Record<string, NumericDiscretizationMode>) {
  const parts = eventColumns.flatMap((column) => {
    const isNumeric = isNumericPreviewColumn(rows, column);
    if (isNumeric) {
      const mode = rules[column] ?? "ignore";
      const label = discretizePreviewValue(row[column], mode);
      return label ? [mode === "quantile" ? `${sanitizePreviewEventPart(column)}_${label}` : label] : [];
    }
    const part = sanitizePreviewEventPart(row[column]);
    return part ? [part] : [];
  });
  return parts.join("_");
}

function uploadFileUrl(result: UploadResult, filename?: string): string | undefined {
  return filename ? `${API_BASE_URL}/api/file/${result.job_id}/${filename}` : undefined;
}

function forumFileUrl(result: UploadResult, filename?: string): string | undefined {
  return filename ? `${API_BASE_URL}/api/ramex-forum/jobs/${result.job_id}/file/${filename}` : undefined;
}

function normalizeUploadResult(raw: UploadResult): NormalizedUploadResult {
  const result = withCoverageMetrics(raw);
  const type = result.analysis_type ?? "pure";
  const pure = result.pure_ramex ?? {
    ramex2007: result.pure?.ramex2007,
    forward: result.pure?.forward,
    backForward: result.pure?.back_forward_formal,
    comparisonRows: [],
    missing: [],
  };
  const forum = result.ramex_forum ?? result.forum ?? undefined;
  const ramex2007 = pure.ramex2007 ?? result.pure?.ramex2007;
  const warnings: string[] = [];
  const errors: string[] = [];

  if ((type === "pure" || type === "both") && !ramex2007) {
    errors.push("RAMEX 2007 formal não está disponível neste resultado.");
  }
  if ((type === "forum" || type === "both") && !forum?.temporal_phase1) {
    errors.push("RAMEX-Forum Fase 1 não está disponível neste resultado.");
  }
  if ((type === "forum" || type === "both") && !forum?.temporal_phase2) {
    errors.push("RAMEX-Forum Fase 2 não está disponível neste resultado.");
  }
  if (result.coverage_metrics?.warning_messages?.length) {
    warnings.push(...result.coverage_metrics.warning_messages);
  }

  return {
    observed: {
      sequences: result.metrics.sequences,
      nodes: result.metrics.nodes,
      edges: result.metrics.edges,
      density: result.metrics.density,
      totalWeight: result.metrics.total_weight,
      topTransitions: result.top_transitions ?? [],
      graphEdges: result.graph_edges ?? [],
      adjacencyMatrix: result.matrix,
      graphImage: uploadFileUrl(result, result.files.graph_png),
      sankeyData: result.graph_edges ?? [],
    },
    ramex2007: {
      available: Boolean(ramex2007),
      phase1: {
        orderedDataset: result.files.ramex2007_ordered_csv,
        sequencesWithNextItem: result.files.ramex2007_sequences_csv,
        source: "SOURCE",
        sink: "SINK",
        graphGEdges: result.ramex2007_transformation?.graph_edges?.map((edge) => ({
          From: String(edge.From ?? ""),
          To: String(edge.To ?? ""),
          Weight: Number(edge.Weight ?? 0),
          Level: edge.Level === undefined ? undefined : Number(edge.Level),
        })) ?? [],
        adjacencyMatrix: result.ramex2007_transformation?.matrix,
        adjacencyMatrixImage: uploadFileUrl(result, result.files.ramex2007_adjacency_matrix_png),
        hasCycles: true,
      },
      phase2: {
        root: ramex2007?.root,
        method: ramex2007?.method ?? ramex2007?.algorithm,
        treeCompleteImage: uploadFileUrl(result, result.files.ramex2007_png),
        sankeyData: ramex2007?.edges ?? [],
        selectedEdges: ramex2007?.edges ?? [],
        dominantPaths: ramex2007?.expansion?.dominant_paths,
        metrics: ramex2007?.metrics,
      },
    },
    forum: {
      available: Boolean(forum?.temporal_phase1 || forum?.temporal_phase2),
      phase1: forum?.temporal_phase1,
      phase2: forum?.temporal_phase2,
    },
    experimental: {
      available: Boolean(showExperimental && (result.ramex_edges?.length || pure.forward || pure.backForward)),
      simplified: result.ramex_edges,
      forward: pure.forward,
      backForward: pure.backForward,
      comparisons: pure.comparisonRows,
    },
    files: {
      artifacts: result.files ?? {},
    },
    errors,
    warnings,
  };
}

type SankeyLimit = 20 | 50 | 100 | "all";
type SankeyRecord = { source: string; target: string; value: number };

function readFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function readFirstNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function edgesToSankeyRecords(edges: unknown[]): SankeyRecord[] {
  const merged = new Map<string, SankeyRecord>();

  for (const rawEdge of edges) {
    if (!rawEdge || typeof rawEdge !== "object") continue;
    const edge = rawEdge as Record<string, unknown>;
    const source = readFirstString(edge, ["from", "From", "source", "Source", "origem"]);
    const target = readFirstString(edge, ["to", "To", "target", "Target", "destino"]);
    const value = readFirstNumber(edge, ["weight", "Weight", "SmoothedWeight", "smoothed_weight", "InfluenceWeight", "influence_weight", "frequency", "Frequency", "value"]);

    if (!source || !target || !Number.isFinite(value) || value <= 0) continue;

    const key = `${source}\u0000${target}`;
    const previous = merged.get(key);
    if (previous) {
      previous.value += value;
    } else {
      merged.set(key, { source, target, value });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.value - a.value || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
}

function applySankeyLimit(records: SankeyRecord[], limit: SankeyLimit): SankeyRecord[] {
  return limit === "all" ? records : records.slice(0, limit);
}

function sanitizeReportName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "dataset";
}

function downloadMarkdown(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
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
  const labels: Record<HistoryAnalysisType, string> = {
    pure: "RAMEX 2007 / 2015",
    forum: "RAMEX-Forum temporal",
    both: "RAMEX 2007/2015 + Forum temporal",
    unknown: "Desconhecido",
  };
  return labels[value] ?? "Desconhecido";
}

function graphInterpretation(nodes?: number, edges?: number, density?: number, ramexPreserved?: number): string {
  const n = nodes ?? 0;
  const e = edges ?? 0;
  const d = density ?? 0;
  const preserved = ramexPreserved ?? 0;

  let structural: string;
  if (d >= 0.2 && e > 1000) {
    structural = `O grafo tem ${n} nós, ${e} arestas e densidade ${d.toFixed(4)}; a leitura visual pode exigir filtragem.`;
  } else if (n >= 50 && e <= n * 2) {
    structural = `O grafo tem ${n} nós e ${e} arestas; há poucas ligações face ao número de nós.`;
  } else if (n <= 10 && e > 0) {
    structural = `O grafo tem ${n} nós e ${e} arestas; a estrutura é pequena e fácil de verificar.`;
  } else {
    structural = `O grafo tem ${n} nós, ${e} arestas e densidade ${d.toFixed(4)}.`;
  }

  const preservation = preserved < 20
    ? `A estrutura RAMEX preserva ${preserved.toFixed(2)}% do peso.`
    : `A estrutura RAMEX preserva ${preserved.toFixed(2)}% do peso, uma parcela relevante do dataset.`;

  return `${structural} ${preservation}`;
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
  eventConstruction?: UploadResult["event_construction"];
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
- Modo de construção de eventos: ${input.eventConstruction?.mode === "advanced" ? "avançado" : "simples"}
- Colunas de evento: ${(input.eventConstruction?.event_columns ?? [input.eventConstruction?.event_column].filter(Boolean)).join(", ") || "Não especificado"}
- Colunas ignoradas: ${(input.eventConstruction?.ignored_columns ?? []).join(", ") || "Nenhuma"}

## 2. Objetivo da análise

Esta análise separa três leituras: RAMEX 2007 formal, baseado em transformação da base de dados e Maximum Weight Rooted Branching; RAMEX 2015, baseado nas heurísticas Forward e Back-and-Forward para tree/poly-tree; e RAMEX-Forum temporal, baseado em influência temporal, smoothing, sinais, latência e extração estrutural.

O RAMEX não analisa todas as variáveis tabulares diretamente. Em vez disso, transforma variáveis selecionadas em eventos sequenciais discretos e depois analisa as transições entre esses eventos.

### Construção dos eventos

- Regra usada: ${input.eventConstruction?.mode === "advanced" ? "modo avançado por composição de colunas" : "modo simples por coluna única"}
- Janela temporal de case_id: ${input.eventConstruction?.case_window ?? "none"}
- Regras de discretização: ${input.eventConstruction?.rules ? Object.entries(input.eventConstruction.rules).map(([col, rule]) => `${col}: ${rule}`).join("; ") : "Sem discretização"}
- Coluna interna de evento: ${input.eventConstruction?.generated_event_column ?? "__ramex_event__"}
- Coluna interna de caso: ${input.eventConstruction?.generated_case_column ?? "__ramex_case_id__"}
- Exemplos de eventos gerados: ${(input.eventConstruction?.event_examples ?? []).slice(0, 10).join(", ") || "Sem exemplos disponíveis"}
- Avisos: ${(input.eventConstruction?.warnings ?? []).join(" | ") || "Sem avisos"}

## 3. Pipeline executada

1. Dataset e reconstrução sequencial;
2. Transformação RAMEX 2007 em rede de estados com SOURCE/SINK;
3. Condensação RAMEX 2007 por Maximum Weight Rooted Branching;
4. RAMEX 2015: Forward Tree ou Back-and-Forward Poly-tree quando aplicável;
5. RAMEX-Forum temporal: rede de influência e extração estrutural;
6. Interpretação, gráficos, Sankey e relatório.

## 4. Camada observacional

- Número de sequências: ${metricValue(input.metrics.sequences)}
- Número de nós: ${metricValue(input.metrics.nodes)}
- Número de arestas: ${metricValue(input.metrics.edges)}
- Soma total dos pesos: ${metricValue(input.metrics.totalWeight)}
- Densidade: ${metricValue(input.metrics.density)}

O grafo observado representa as transições reconstruídas diretamente do dataset. Não inclui SOURCE/SINK, exceto quando se abre explicitamente a rede formal RAMEX 2007.

### Top transições observadas

| From | To | Weight |
| --- | --- | ---: |
${topRows.length ? topRows.map((edge) => `| ${edge.From} | ${edge.To} | ${formatNumber(edge.Weight)} |`).join("\n") : "| Sem dados gerados | Sem dados gerados | Sem dados gerados |"}

## 5. RAMEX 2007 formal

RAMEX 2007 é tratado como implementação formal de Cavique 2007: transformação em rede de estados, SOURCE/SINK, atributo next_item, matriz de adjacência e Maximum Weight Rooted Branching.

- Raiz: ${metricValue(input.pureRamex?.ramex2007Root)}
- Arestas selecionadas: ${metricValue(input.metrics.ramexEdges)}
- Peso preservado RAMEX 2007: ${metricValue(input.metrics.ramexPreserved, "%")}
- A árvore B final deve ser DAG/arborescência.
- A rede G formal pode conter ciclos; a aciclicidade surge após a condensação.

## 6. RAMEX 2015 e RAMEX-Forum temporal

RAMEX 2015 é representado pelas heurísticas Forward e Back-and-Forward sobre a rede de transições. O RAMEX-Forum só deve ser interpretado como pipeline temporal/influência quando existirem dados de sinais, latência e relações temporais.

${input.ramexForum ? `RAMEX-Forum temporal foi executado como pipeline de influência.

### Fase 1 — influência temporal

- Sinais: ${metricValue(input.ramexForum.temporalPhase1?.signals)}
- Relações temporais: ${metricValue(input.ramexForum.temporalPhase1?.temporalRelations)}
- latency_max: ${metricValue(input.ramexForum.temporalPhase1?.latencyMax)}
- epsilon: ${metricValue(input.ramexForum.temporalPhase1?.epsilon)}

### Fase 2 — extração estrutural

- Heurística Fase 2: ${metricValue(input.ramexForum.temporalPhase2?.heuristicUsed)}
- Influência preservada Fase 2: ${metricValue(input.ramexForum.temporalPhase2?.preservedInfluencePercent, "%")}
- Caminho dominante Fase 2: ${metricValue(input.ramexForum.temporalPhase2?.dominantPath?.join(" -> "))}

` : "RAMEX-Forum não foi executado neste resultado."}

## 7. Visualizações

- Grafo observado: fonte = camada observacional.
- Árvore técnica RAMEX 2007: fonte = rooted branching formal.
- Sankey RAMEX 2007: fonte = árvore B/rooted branching.
- Sankey RAMEX-Forum temporal: fonte = influência temporal/estrutura Fase 2.
- Sankey de fluxos: visualização complementar; não substitui o algoritmo RAMEX.

Filtros visuais não alteram a análise nem os artefactos CSV/JSON.

${input.pureRamex?.rows?.length ? `## 8. Anexo — RAMEX 2015 / heurísticas complementares

Estas linhas distinguem métodos formais e heurísticas bibliográficas: Forward e Back-and-Forward pertencem ao enquadramento RAMEX 2015; outras heurísticas antigas devem ser lidas apenas como exploração inicial.

| Abordagem | Método | Arestas | Peso preservado | Raiz / aresta inicial |
| --- | --- | ---: | ---: | --- |
${input.pureRamex.rows.map((row) => `| ${row.algorithm} | ${metricValue(row.method)} | ${metricValue(row.selectedEdges)} | ${metricValue(row.preservedWeightPercent, "%")} | ${metricValue(row.anchor)} |`).join("\n")}

` : ""}

## ${input.pureRamex?.rows?.length ? "9" : "8"}. Limitações

- As visualizações analíticas e Sankey podem ser filtradas para legibilidade, sem alterar CSV/JSON.
- Forward e Back-and-Forward devem ser apresentados como RAMEX 2015; heurísticas antigas/locais devem permanecer apenas como exploração inicial.
- A fórmula temporal inicial do RAMEX-Forum deve ser calibrada com datasets reais.

## ${input.pureRamex?.rows?.length ? "10" : "9"}. Trabalho futuro

- Trabalho futuro: calibrar fórmulas de influência temporal RAMEX-Forum e validar em mais datasets reais.
- Adicionar anexos automáticos com todos os CSV/JSON exportados.
- Expandir testes com testes_SCADA e outros sinais temporais reais.

## ${input.pureRamex?.rows?.length ? "11" : "10"}. Conclusão

${dynamicInterpretation} A análise distingue RAMEX 2007 formal, RAMEX 2015 Forward/Back-and-Forward e RAMEX-Forum temporal, preservando os artefactos completos para validação.

## ${input.pureRamex?.rows?.length ? "12" : "11"}. Referências

- Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007, LNAI 4874, pp. 406–414.
- Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees. Advances in Intelligent Systems and Computing, 354, pp. 143–153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products. Expert Systems, 34:e12174.
- Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática. Revista de Ciência Elementar, 9(02):041.
`;
}

function uploadResultToValidationRow(result: UploadResult): ValidationRow {
  return {
    Dataset: `Upload: ${result.filename}`,
    Nos_Grafo: result.metrics.nodes,
    Arestas_Grafo: result.metrics.edges,
    Soma_Pesos_Grafo: result.metrics.total_weight,
    Arestas_RAMEX: result.metrics.ramex_edges,
    Soma_Pesos_RAMEX: result.metrics.ramex_weight,
    Percentagem_Peso_Preservado: result.metrics.preserved_percentage,
    Densidade_Aproximada: result.metrics.density,
    Top_5_Transicoes: "",
    Interpretacao: result.interpretation,
  };
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
    temporalPhase1: data.temporal_phase1 ? {
      signals: data.temporal_phase1.metrics?.signals,
      temporalRelations: data.temporal_phase1.metrics?.temporal_relations,
      latencyMax: data.temporal_phase1.metrics?.latency_max,
      epsilon: data.temporal_phase1.metrics?.epsilon,
      totalInfluenceWeight: data.temporal_phase1.metrics?.total_influence_weight,
      graph: jobId && data.temporal_phase1.files?.graph_png
        ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.temporal_phase1.files.graph_png}`
        : undefined,
      matrix: jobId && data.temporal_phase1.files?.influence_matrix_png
        ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.temporal_phase1.files.influence_matrix_png}`
        : undefined,
    } : undefined,
    temporalPhase2: data.temporal_phase2 ? {
      heuristicUsed: data.temporal_phase2.metrics?.heuristic_used,
      initialNodeMode: data.temporal_phase2.metrics?.initial_node_mode,
      selectedInitialNode: data.temporal_phase2.metrics?.selected_initial_node,
      initialEdge: data.temporal_phase2.metrics?.initial_edge,
      nodesBefore: data.temporal_phase2.metrics?.nodes_before,
      edgesBefore: data.temporal_phase2.metrics?.edges_before,
      nodesAfter: data.temporal_phase2.metrics?.nodes_after,
      edgesAfter: data.temporal_phase2.metrics?.edges_after,
      preservedInfluencePercent: data.temporal_phase2.metrics?.preserved_influence_percent,
      isDag: data.temporal_phase2.metrics?.is_dag,
      isTree: data.temporal_phase2.metrics?.is_tree,
      isPolytree: data.temporal_phase2.metrics?.is_polytree,
      dominantPath: data.temporal_phase2.metrics?.dominant_path,
      edges: data.temporal_phase2.selected_edges?.map((edge) => ({
        from: edge.From,
        to: edge.To,
        weight: edge.Weight,
        direction: edge.Direction,
      })),
      structureImage: jobId && data.temporal_phase2.files?.phase2_structure_png
        ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.temporal_phase2.files.phase2_structure_png}`
        : undefined,
      heuristicImage: jobId && data.temporal_phase2.files
        ? data.temporal_phase2.metrics?.heuristic_used === "forward" && data.temporal_phase2.files.forward_tree_png
          ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.temporal_phase2.files.forward_tree_png}`
          : data.temporal_phase2.files.back_forward_polytree_png
            ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.temporal_phase2.files.back_forward_polytree_png}`
            : undefined
        : undefined,
    } : undefined,
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
    return "Output RAMEX 2007 incompleto: ficheiro ramex2007 JSON não encontrado";
  }
  return undefined;
}

function forumCompletenessError(result?: UploadResult | null): string | undefined {
  const forum = result?.ramex_forum ?? result?.forum;
  if (!forum?.temporal_phase1) {
    return "Output RAMEX-Forum incompleto: Fase 1 temporal não encontrada";
  }
  if (!forum.temporal_phase2) {
    return "Output RAMEX-Forum incompleto: Fase 2 estrutural não encontrada";
  }
  return undefined;
}

function reportCompletenessError(result?: UploadResult | null): string | undefined {
  if (!result) return undefined;
  const type = result.analysis_type ?? "pure";
  if ((type === "pure" || type === "both") && pureCompletenessError(result)) return pureCompletenessError(result);
  if ((type === "forum" || type === "both") && forumCompletenessError(result)) return forumCompletenessError(result);
}

function pure_anchor_frontend(payload?: PureRamexResult): string | undefined {
  if (!payload) return undefined;
  if (payload.root) return payload.root;
  if (payload.initial_edge) return `${payload.initial_edge.from} -> ${payload.initial_edge.to}`;
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
  return [...(data?.comparisonRows ?? [])]
    .sort((a, b) => (b["Peso preservado (%)"] ?? 0) - (a["Peso preservado (%)"] ?? 0))[0]?.Algoritmo;
}

function pureRamexStructuralType(validation?: ValidationRow, data?: PureRamexData): string {
  const density = validation?.Densidade_Aproximada ?? 0;
  const nodes = validation?.Nos_Grafo ?? 0;
  const ramex2007Preserved = data?.ramex2007?.metrics?.preserved_weight_percent ?? 0;

  if (nodes <= 10 && density > 0.7) return "grafo pequeno e completo";
  if (density < 0.05 && ramex2007Preserved > 80) return "grafo quase linear / sequencial";
  if (density > 0.7) return "grafo denso / altamente conectado";
  return "grafo de estrutura intermédia";
}

function pureRamexStructuralInterpretation(structuralType: string): string {
  if (structuralType === "grafo denso / altamente conectado") {
    return "Em grafos densos, os métodos reduzem muitas transições para uma estrutura acíclica curta. O peso preservado tende a ser baixo.";
  }
  if (structuralType === "grafo quase linear / sequencial") {
    return "Em grafos quase lineares, o RAMEX 2007 Rooted Branching tende a preservar mais peso porque a ordem já está definida.";
  }
  if (structuralType === "grafo pequeno e completo") {
    return "Em grafos pequenos e completos, as diferenças entre métodos tendem a ser reduzidas.";
  }
  return "Em grafos intermédios, compare peso preservado, simplicidade e arestas selecionadas.";
}

function pureRamexSimplestLabels(data?: PureRamexData): string {
  const rows = data?.comparisonRows ?? [];
  const edgeCounts = rows.map((r) => r["Arestas selecionadas"]).filter((v): v is number => typeof v === "number");
  if (edgeCounts.length === 0) return "Sem dados gerados";
  const minEdges = Math.min(...edgeCounts);
  return rows
    .filter((r) => r["Arestas selecionadas"] === minEdges)
    .map((r) => r.Algoritmo ?? "Sem dados gerados")
    .join(", ");
}

function pureRamexScientificSummary(validation?: ValidationRow, data?: PureRamexData): string {
  const structuralType = pureRamexStructuralType(validation, data);
  return `Tipo estrutural do dataset: ${structuralType}. ${pureRamexStructuralInterpretation(structuralType)}`;
}


type ValidationCheckStatus = "ok" | "warning" | "na" | "missing";

type TechnicalValidationCheck = {
  method: string;
  criterion: string;
  status: ValidationCheckStatus;
  evidence: string;
  recommendation?: string;
};

function validationStatusLabel(status: ValidationCheckStatus): string {
  if (status === "ok") return "OK";
  if (status === "warning") return "Atenção";
  if (status === "missing") return "Em falta";
  return "N.A.";
}

function validationStatusClasses(status: ValidationCheckStatus): string {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "missing") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function validationStatusIcon(status: ValidationCheckStatus) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4" />;
  if (status === "missing") return <X className="h-4 w-4" />;
  return <Circle className="h-4 w-4" />;
}

function booleanValidation(
  value: boolean | undefined,
  okEvidence: string,
  warningEvidence: string,
  unavailableEvidence = "Métrica não exportada nesta execução.",
): Pick<TechnicalValidationCheck, "status" | "evidence"> {
  if (value === undefined) return { status: "na", evidence: unavailableEvidence };
  return value ? { status: "ok", evidence: okEvidence } : { status: "warning", evidence: warningEvidence };
}

function methodPreservedWeight(result?: PureRamexResult): number | undefined {
  return result?.preserved_weight_percent ?? result?.metrics?.preserved_weight_percent;
}

function buildTechnicalValidationRows(data?: PureRamexData, validation?: ValidationRow): TechnicalValidationCheck[] {
  const rows: TechnicalValidationCheck[] = [];
  const density = validation?.Densidade_Aproximada;
  const nodes = validation?.Nos_Grafo ?? data?.ramex2007?.metrics?.original_nodes ?? data?.forward?.metrics?.original_nodes ?? data?.backForward?.metrics?.original_nodes;
  const edges = validation?.Arestas_Grafo ?? data?.ramex2007?.metrics?.original_edges ?? data?.forward?.metrics?.original_edges ?? data?.backForward?.metrics?.original_edges;

  if (density !== undefined) {
    rows.push({
      method: "Grafo observado",
      criterion: "Densidade visual",
      status: density > 0.7 ? "warning" : "ok",
      evidence: density > 0.7
        ? `Densidade ${formatNumber(density, 4)} com ${formatNumber(nodes ?? 0)} nós e ${formatNumber(edges ?? 0)} arestas; recomenda-se Sankey ou Top-N para leitura.`
        : `Densidade ${formatNumber(density, 4)}; leitura visual tendencialmente mais estável.`,
      recommendation: density > 0.7 ? "Usar filtros visuais/Sankey sem alterar CSV/JSON." : undefined,
    });
  }

  const ramex2007 = normalizeRamex2007Result(data?.ramex2007);
  if (!ramex2007) {
    rows.push({ method: "RAMEX 2007", criterion: "Rooted Branching formal", status: "missing", evidence: "Resultado RAMEX 2007 não disponível." });
  } else {
    rows.push({
      method: "RAMEX 2007",
      criterion: "Raiz / SOURCE definido",
      status: ramex2007.root ? "ok" : "warning",
      evidence: ramex2007.root ? `Raiz identificada: ${ramex2007.root}.` : "Raiz não exportada no artefacto.",
    });
    const dag = booleanValidation(ramex2007.isDag, "Estrutura final assinalada como acíclica.", "A estrutura final não foi assinalada como DAG.");
    rows.push({ method: "RAMEX 2007", criterion: "DAG após condensação", ...dag });
    const arbo = booleanValidation(ramex2007.isArborescence, "Arborescência validada pela pipeline.", "Arborescência não validada pela pipeline.");
    rows.push({ method: "RAMEX 2007", criterion: "Arborescência", ...arbo });
    rows.push({
      method: "RAMEX 2007",
      criterion: "In-degree de raiz e nós não-raiz",
      status: (ramex2007.rootInDegree ?? 0) <= 0 && (ramex2007.maxNonRootInDegree ?? 1) <= 1 ? "ok" : "warning",
      evidence: `root_in_degree=${formatNumber(ramex2007.rootInDegree ?? 0)}; max_non_root_in_degree=${formatNumber(ramex2007.maxNonRootInDegree ?? 0)}.`,
    });
    const expectedEdges = Math.max((ramex2007.nodes ?? 0) - 1, 0);
    rows.push({
      method: "RAMEX 2007",
      criterion: "Arestas = nós - 1",
      status: ramex2007.edges === expectedEdges ? "ok" : "warning",
      evidence: `${formatNumber(ramex2007.edges)} arestas para ${formatNumber(ramex2007.nodes)} nós selecionados.`,
    });
  }

  const forward = data?.forward;
  if (!forward) {
    rows.push({ method: "RAMEX 2015 — Forward", criterion: "Execução com nó inicial", status: "missing", evidence: "Forward não disponível neste resultado." });
  } else {
    const fMetrics = forward.metrics ?? {};
    rows.push({
      method: "RAMEX 2015 — Forward",
      criterion: "Nó inicial conhecido",
      status: forward.root ? "ok" : "na",
      evidence: forward.root ? `Raiz/nó inicial: ${forward.root}.` : "Não foi exportado nó inicial explícito; interpretar como comparação quando aplicável.",
    });
    const acyclic = booleanValidation(fMetrics.is_acyclic ?? fMetrics.is_dag, "Estrutura Forward assinalada como acíclica.", "Forward não foi assinalado como acíclico.");
    rows.push({ method: "RAMEX 2015 — Forward", criterion: "Tree acíclica", ...acyclic });
    rows.push({
      method: "RAMEX 2015 — Forward",
      criterion: "Peso preservado registado",
      status: methodPreservedWeight(forward) === undefined ? "na" : "ok",
      evidence: methodPreservedWeight(forward) === undefined ? "Percentagem não exportada." : `${formatNumber(methodPreservedWeight(forward), 2)}% de peso preservado.`,
    });
  }

  const backForward = data?.backForward;
  if (!backForward) {
    rows.push({ method: "RAMEX 2015 — Back-and-Forward", criterion: "Poly-tree bidirecional", status: "missing", evidence: "Back-and-Forward não disponível neste resultado." });
  } else {
    const bMetrics = backForward.metrics ?? {};
    const forwardCount = backForward.edges?.filter((edge) => edge.direction === "FORWARD").length ?? 0;
    const backwardCount = backForward.edges?.filter((edge) => edge.direction === "BACKWARD").length ?? 0;
    rows.push({
      method: "RAMEX 2015 — Back-and-Forward",
      criterion: "Aresta inicial",
      status: backForward.initial_edge ? "ok" : "na",
      evidence: backForward.initial_edge
        ? `${backForward.initial_edge.from} → ${backForward.initial_edge.to} (${formatNumber(backForward.initial_edge.weight ?? 0)}).`
        : "Aresta inicial não exportada explicitamente.",
    });
    const isPoly = bMetrics.is_polytree ?? bMetrics.is_tree_undirected;
    const polyCheck = booleanValidation(isPoly, "Estrutura assinalada como poly-tree/árvore não dirigida.", "Estrutura não foi assinalada como poly-tree.");
    rows.push({ method: "RAMEX 2015 — Back-and-Forward", criterion: "Conformidade Poly-tree", ...polyCheck });
    const connected = booleanValidation(bMetrics.is_connected, "Estrutura assinalada como conectada.", "Estrutura não foi assinalada como conectada.");
    rows.push({ method: "RAMEX 2015 — Back-and-Forward", criterion: "Conectividade", ...connected });
    rows.push({
      method: "RAMEX 2015 — Back-and-Forward",
      criterion: "Expansão forward/backward",
      status: forwardCount > 0 && backwardCount > 0 ? "ok" : "warning",
      evidence: `FORWARD=${formatNumber(forwardCount)}; BACKWARD=${formatNumber(backwardCount)}.`,
    });
  }

  rows.push({
    method: "Sankey",
    criterion: "Papel da visualização",
    status: "ok",
    evidence: "Visualização complementar de fluxos; não substitui RAMEX 2007, RAMEX 2015 nem RAMEX-Forum temporal.",
  });

  return rows;
}

function TechnicalValidationPanel({ rows }: { rows: TechnicalValidationCheck[] }) {
  if (rows.length === 0) {
    return <EmptyState message="Ainda não existem métricas suficientes para construir o painel de validação técnica." />;
  }

  const warnings = rows.filter((row) => row.status === "warning" || row.status === "missing").length;

  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Validação técnica</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Diagnóstico das estruturas RAMEX</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Esta checklist cruza métricas exportadas pela pipeline com critérios bibliográficos: arborescência RAMEX 2007, heurísticas RAMEX 2015, conformidade Poly-tree e papel complementar do Sankey.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${warnings ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {warnings ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {warnings ? `${warnings} ponto(s) a rever` : "Sem alertas críticos"}
        </span>
      </div>
      <div className="mt-5 overflow-auto rounded-2xl border border-slate-200 bg-white scrollbar-thin">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-left">Critério</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Evidência</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.method}-${row.criterion}-${index}`} className="border-t border-slate-100 align-top odd:bg-white even:bg-slate-50/70">
                <td className="px-4 py-3 font-semibold text-slate-950">{row.method}</td>
                <td className="px-4 py-3 text-slate-700">{row.criterion}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${validationStatusClasses(row.status)}`}>
                    {validationStatusIcon(row.status)}
                    {validationStatusLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {row.evidence}
                  {row.recommendation ? <span className="mt-1 block text-xs font-semibold text-amber-700">{row.recommendation}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
      <p className="mt-3 break-words font-mono text-2xl font-semibold leading-tight tabular-nums tracking-tight text-slate-950 lg:text-3xl">
        {value}
      </p>
      {note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}
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

function CoverageDiagnosticsPanel({ metrics }: { metrics?: CoverageMetrics }) {
  if (!metrics) return null;

  const visibleUncovered = metrics.uncovered_nodes.slice(0, 20);
  const remainingUncovered = Math.max(metrics.uncovered_nodes_count - visibleUncovered.length, 0);

  return (
    <section className="space-y-4 rounded-3xl border border-cyan-200/70 bg-cyan-50/60 p-5 shadow-xl shadow-cyan-100/40 ring-1 ring-white/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Diagnóstico de Cobertura</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Grafo original vs filtrado vs RAMEX</h3>
        </div>
        <div className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-cyan-700">
          Diagnóstico
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grafo original</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Nós</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.original_nodes)}</p>
            </div>
            <div>
              <p className="text-slate-500">Arestas</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.original_edges)}</p>
            </div>
            <div>
              <p className="text-slate-500">Peso</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.original_weight, 2)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grafo filtrado</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Nós</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.filtered_nodes)}</p>
            </div>
            <div>
              <p className="text-slate-500">Arestas</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.filtered_edges)}</p>
            </div>
            <div>
              <p className="text-slate-500">Peso</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.filtered_weight, 2)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Removido por filtro: {formatNumber(metrics.removed_by_filter_edges)} arestas,
            {" "}{formatNumber(metrics.removed_by_filter_weight, 2)} de peso.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">RAMEX</p>
          <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Nós</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.ramex_nodes)}</p>
            </div>
            <div>
              <p className="text-slate-500">Arestas</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.ramex_edges)}</p>
            </div>
            <div>
              <p className="text-slate-500">Peso</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{formatNumber(metrics.ramex_weight, 2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Cobertura</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{metrics.node_coverage_percent.toFixed(1)}%</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Peso preservado face ao original: {metrics.preserved_weight_percent.toFixed(2)}%.
          </p>
        </div>
      </div>

      {metrics.warning_messages.length > 0 ? (
        <WarningPanel>
          <ul className="space-y-1">
            {metrics.warning_messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </WarningPanel>
      ) : null}

      {metrics.uncovered_nodes_count > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow-panel">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {formatNumber(metrics.uncovered_nodes_count)} nós não cobertos
            </span>
            <span className="text-slate-500">Primeiros nós fora da estrutura RAMEX:</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleUncovered.map((node) => (
              <span key={node} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700">
                {node}
              </span>
            ))}
            {remainingUncovered > 0 ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                + {formatNumber(remainingUncovered)} restantes
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

    </section>
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
          Matriz grande: a visualização foi limitada apenas no ecrã a {visibleRows.length} linhas e {visibleColumns.length} colunas. Os dados e a análise não foram alterados.
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

    for (const edge of edges) {
      nodeSet.add(edge.From);
      nodeSet.add(edge.To);
      const from = degree.get(edge.From) ?? { in: 0, out: 0, weight: 0 };
      const to = degree.get(edge.To) ?? { in: 0, out: 0, weight: 0 };
      degree.set(edge.From, { ...from, out: from.out + 1, weight: from.weight + edge.Weight });
      degree.set(edge.To, { ...to, in: to.in + 1, weight: to.weight + edge.Weight });
    }

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

    return {
      points,
      pointMap,
      visibleEdges,
      maxWeight,
      width,
      height,
      hidden: edges.length - visibleEdges.length,
      hiddenNodes: Math.max(nodeSet.size - nodes.length, 0),
      totalNodes: nodeSet.size,
      totalEdges: edges.length,
      degree,
    };
  }, [denseHint, edges]);

  if (edges.length === 0) {
    return <EmptyState message="Não existem arestas disponíveis para este grafo." />;
  }

  return (
    <div className="space-y-3">
      {denseHint ? (
        <WarningPanel>
          Grafo denso: a visualização em rede pode ocultar ou sobrepor relações. Use Sankey ou filtros visuais para interpretar os fluxos principais.
        </WarningPanel>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-3 text-xs text-slate-600 shadow-panel sm:grid-cols-2">
        <p>
          Nós mostrados: <span className="font-mono font-semibold text-slate-900">{formatNumber(graph.points.length)}</span> de{" "}
          <span className="font-mono font-semibold text-slate-900">{formatNumber(graph.totalNodes)}</span>
        </p>
        <p>
          Arestas mostradas: <span className="font-mono font-semibold text-slate-900">{formatNumber(graph.visibleEdges.length)}</span> de{" "}
          <span className="font-mono font-semibold text-slate-900">{formatNumber(graph.totalEdges)}</span>
        </p>
      </div>
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
        {graph.hidden > 0 || graph.hiddenNodes > 0 ? (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Visualização parcial: {formatNumber(graph.hiddenNodes)} nós e {formatNumber(graph.hidden)} arestas foram ocultados apenas na visualização para preservar legibilidade.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SankeyPanel({
  edges,
  title = "Sankey de transições",
  description = "Fluxos principais entre eventos do grafo observado.",
}: {
  edges: unknown[];
  title?: string;
  description?: string;
}) {
  const allRecords = useMemo(() => edgesToSankeyRecords(edges), [edges]);
  const [limit, setLimit] = useState<SankeyLimit>(() => (allRecords.length > 100 ? 50 : "all"));
  const shownRecords = useMemo(() => applySankeyLimit(allRecords, limit), [allRecords, limit]);
  const totalWeight = allRecords.reduce((sum, edge) => sum + edge.value, 0);
  const shownWeight = shownRecords.reduce((sum, edge) => sum + edge.value, 0);
  const omittedEdges = Math.max(allRecords.length - shownRecords.length, 0);
  const percentShown = totalWeight > 0 ? shownWeight / totalWeight * 100 : 0;

  const sankey = useMemo(() => {
    const sourceTotals = new Map<string, number>();
    const targetTotals = new Map<string, number>();
    for (const edge of shownRecords) {
      sourceTotals.set(edge.source, (sourceTotals.get(edge.source) ?? 0) + edge.value);
      targetTotals.set(edge.target, (targetTotals.get(edge.target) ?? 0) + edge.value);
    }

    const sources = Array.from(sourceTotals.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const targets = Array.from(targetTotals.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const width = 1180;
    const height = Math.max(420, Math.max(sources.length, targets.length, 1) * 34 + 80);
    const top = 42;
    const bottom = height - 42;
    const nodeHeight = 18;
    const sourceStep = sources.length > 1 ? (bottom - top) / (sources.length - 1) : 0;
    const targetStep = targets.length > 1 ? (bottom - top) / (targets.length - 1) : 0;
    const sourceY = new Map(sources.map(([node], index) => [node, top + sourceStep * index]));
    const targetY = new Map(targets.map(([node], index) => [node, top + targetStep * index]));
    const maxValue = Math.max(...shownRecords.map((edge) => edge.value), 1);

    const sourceLabelX = 36;
    const sourceNodeX = 286;
    const targetNodeX = width - 304;
    const targetLabelX = width - 36;
    const sourceValueX = sourceNodeX + 150;
    const targetValueX = targetNodeX - 10;
    const flowStartX = sourceNodeX + 154;
    const flowEndX = targetNodeX - 14;

    return {
      width,
      height,
      nodeHeight,
      sources,
      targets,
      sourceY,
      targetY,
      maxValue,
      sourceLabelX,
      sourceNodeX,
      targetNodeX,
      targetLabelX,
      sourceValueX,
      targetValueX,
      flowStartX,
      flowEndX,
    };
  }, [shownRecords]);

  if (allRecords.length === 0) {
    return <EmptyState message="Não existem transições válidas para construir Sankey." />;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-cyan-200/70 bg-white/90 p-5 shadow-xl shadow-cyan-100/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Sankey</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <label className="min-w-[12rem] text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Limite visual</span>
            <select
              value={String(limit)}
              onChange={(event) => setLimit(event.target.value === "all" ? "all" : Number(event.target.value) as SankeyLimit)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
              <option value="all">Todas</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Nós" value={formatNumber(new Set(allRecords.flatMap((edge) => [edge.source, edge.target])).size)} />
          <MetricCard label="Arestas totais" value={formatNumber(allRecords.length)} />
          <MetricCard label="Arestas mostradas" value={formatNumber(shownRecords.length)} />
          <MetricCard label="Peso mostrado" value={formatNumber(shownWeight, 2)} />
          <MetricCard label="Peso visualizado" value={`${percentShown.toFixed(1)}%`} />
        </div>

        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Este limite afeta apenas a visualização Sankey, não os dados nem o RAMEX.
        </p>
      </div>

      {shownRecords.length > 100 ? (
        <WarningPanel>
          Sankey com muitas relações: a leitura pode ficar densa. Use Top 20, Top 50 ou Top 100 para focar os fluxos principais.
        </WarningPanel>
      ) : null}

      {omittedEdges > 0 ? (
        <WarningPanel>
          Visualização parcial: {formatNumber(omittedEdges)} arestas foram omitidas apenas no Sankey, preservando {percentShown.toFixed(1)}% do peso total mostrado.
        </WarningPanel>
      ) : null}

      <div className="overflow-auto rounded-3xl border border-white/60 bg-white/90 p-4 shadow-xl shadow-slate-200/50">
        <svg viewBox={`0 0 ${sankey.width} ${sankey.height}`} className="min-h-[34rem] w-full min-w-[980px]">
          <defs>
            <linearGradient id="sankeyFlow" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#0e7490" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#d8903f" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {shownRecords.map((edge, index) => {
            const y1 = sankey.sourceY.get(edge.source) ?? 0;
            const y2 = sankey.targetY.get(edge.target) ?? 0;
            const strokeWidth = Math.max(1.2, Math.min(22, 1 + edge.value / sankey.maxValue * 20));
            const x1 = sankey.flowStartX;
            const x2 = sankey.flowEndX;
            const key = `${edge.source}-${edge.target}-${index}`;
            return (
              <g key={key}>
                <path
                  d={`M ${x1} ${y1} C ${x1 + 220} ${y1}, ${x2 - 220} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="url(#sankeyFlow)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={0.28 + Math.min(0.5, edge.value / sankey.maxValue * 0.5)}
                />
                <title>{`${edge.source} -> ${edge.target}: ${formatNumber(edge.value, 2)}`}</title>
              </g>
            );
          })}

          {sankey.sources.map(([node, value]) => {
            const y = sankey.sourceY.get(node) ?? 0;
            return (
              <g key={`source-${node}`}>
                <title>{`${node}: ${formatNumber(value, 2)}`}</title>
                <text x={sankey.sourceLabelX} y={y + 4} className="fill-slate-700 text-[11px] font-semibold">
                  {node}
                </text>
                <rect x={sankey.sourceNodeX} y={y - sankey.nodeHeight / 2} width="140" height={sankey.nodeHeight} rx="5" fill="#dce9ee" stroke="#315f72" />
                <text x={sankey.sourceValueX} y={y + 4} className="fill-slate-500 font-mono text-[10px]">
                  {formatNumber(value, 1)}
                </text>
              </g>
            );
          })}

          {sankey.targets.map(([node, value]) => {
            const y = sankey.targetY.get(node) ?? 0;
            return (
              <g key={`target-${node}`}>
                <title>{`${node}: ${formatNumber(value, 2)}`}</title>
                <text x={sankey.targetValueX} y={y + 4} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
                  {formatNumber(value, 1)}
                </text>
                <rect x={sankey.targetNodeX} y={y - sankey.nodeHeight / 2} width="140" height={sankey.nodeHeight} rx="5" fill="#f7dfb8" stroke="#b7791f" />
                <text x={sankey.targetLabelX} y={y + 4} textAnchor="end" className="fill-slate-700 text-[11px] font-semibold">
                  {node}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function PolyTreeCanvas({ data }: { data: PolyTreeData }) {
  const graph = useMemo(() => {
    const levels = new Map<number, Array<{ id: string; level: number }>>();
    for (const node of data.nodes) {
      const bucket = levels.get(node.level) ?? [];
      bucket.push(node);
      levels.set(node.level, bucket);
    }

    const width = 920;
    const height = 520;
    const maxLevel = Math.max(...data.nodes.map((node) => node.level), 1);
    const pointMap = new Map<string, { x: number; y: number }>();

    for (const [level, nodes] of levels.entries()) {
      nodes.forEach((node, index) => {
        pointMap.set(node.id, {
          x: 80 + (level / Math.max(maxLevel, 1)) * (width - 160),
          y: ((index + 1) / (nodes.length + 1)) * (height - 80) + 40,
        });
      });
    }

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
              <td className="px-3 py-3 text-right">{formatNumber(row.Score, 3)}</td>
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

function resolvedImageSrc(imageFile?: string, imageUrl?: string) {
  return imageUrl ?? (imageFile ? dataPath(imageFile) : undefined);
}

function RamexImageViewport({
  src,
  title,
  heightClass = "h-[34rem]",
  dark = false,
}: {
  src: string;
  title: string;
  heightClass?: string;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const clampView = (next: { scale: number; x: number; y: number }) => {
    const container = containerRef.current;
    if (!container || naturalSize.width <= 0 || naturalSize.height <= 0) return next;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scaledWidth = naturalSize.width * next.scale;
    const scaledHeight = naturalSize.height * next.scale;
    const x = scaledWidth <= containerWidth
      ? (containerWidth - scaledWidth) / 2
      : Math.min(0, Math.max(containerWidth - scaledWidth, next.x));
    const y = scaledHeight <= containerHeight
      ? (containerHeight - scaledHeight) / 2
      : Math.min(0, Math.max(containerHeight - scaledHeight, next.y));
    return { ...next, x, y };
  };

  const fitToContainer = () => {
    const container = containerRef.current;
    if (!container || naturalSize.width <= 0 || naturalSize.height <= 0) return;
    const scale = Math.min(
      container.clientWidth / naturalSize.width,
      container.clientHeight / naturalSize.height,
    ) * 0.95;
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    setFitScale(safeScale);
    setView(clampView({ scale: safeScale, x: 0, y: 0 }));
  };

  useEffect(() => {
    fitToContainer();
    const handleResize = () => fitToContainer();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalSize.width, naturalSize.height]);

  const zoomBy = (delta: number) => {
    setView((current) => {
      const nextScale = Math.max(fitScale * 0.5, Math.min(current.scale + delta, Math.max(4, fitScale * 8)));
      return clampView({ scale: nextScale, x: current.x, y: current.y });
    });
  };

  const setActualSize = () => setView((current) => clampView({ scale: 1, x: current.x, y: current.y }));
  const canPan = view.scale > fitScale + 0.01;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={fitToContainer} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          Ajustar à janela
        </button>
        <button onClick={setActualSize} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          100%
        </button>
        <button onClick={() => zoomBy(0.15)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => zoomBy(-0.15)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button onClick={fitToContainer} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Reset view">
          <RotateCcw className="h-4 w-4" />
        </button>
        <a href={src} download className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Download PNG">
          <Download className="h-4 w-4" />
        </a>
      </div>
      <div
        ref={containerRef}
        className={`${heightClass} relative min-h-[24rem] overflow-hidden rounded-xl border ${dark ? "border-white/10 bg-slate-100" : "border-slate-200 bg-slate-50"} select-none`}
        onMouseDown={(event) => {
          if (!canPan) return;
          dragRef.current = { active: true, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
        }}
        onMouseMove={(event) => {
          if (!dragRef.current.active || !canPan) return;
          const next = {
            scale: view.scale,
            x: dragRef.current.originX + event.clientX - dragRef.current.startX,
            y: dragRef.current.originY + event.clientY - dragRef.current.startY,
          };
          setView(clampView(next));
        }}
        onMouseUp={() => { dragRef.current.active = false; }}
        onMouseLeave={() => { dragRef.current.active = false; }}
        onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 0.12 : -0.12);
        }}
      >
        <img
          src={src}
          alt={title}
          onLoad={(event) => setNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
          draggable={false}
          style={{
            width: naturalSize.width || "auto",
            height: naturalSize.height || "auto",
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "top left",
            cursor: canPan ? "grab" : "default",
          }}
          className="absolute left-0 top-0 max-w-none rounded-lg bg-white shadow-sm"
        />
      </div>
    </div>
  );
}

function RamexTechnicalTreeViewer({ src, title }: { src?: string; title: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  if (!src) return <EmptyState message="Árvore técnica completa ainda não disponível." />;


  return (
    <section className="rounded-2xl border border-white/50 bg-white/85 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-950">Árvore RAMEX 2007 completa, sem cortes</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            A árvore técnica completa apresenta todos os nós e todas as arestas selecionadas pelo Maximum Weight Rooted Branching, servindo como evidência formal da arborescência obtida.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFullscreen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Maximize2 className="h-4 w-4" /> Ver árvore técnica completa
          </button>
          <a href={src} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Eye className="h-4 w-4" /> Abrir imagem
          </a>
        </div>
      </div>
      <div className="mt-4">
        <RamexImageViewport src={src} title={title} />
      </div>
      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/90 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Árvore técnica completa RAMEX 2007</p>
            <div className="flex gap-2">
              <a href={src} download className="rounded-lg bg-white/10 p-2 text-white"><Download className="h-4 w-4" /></a>
              <button onClick={() => setFullscreen(false)} className="rounded-lg bg-white/10 p-2 text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mx-auto h-[85vh] w-[90vw] rounded-xl">
            <RamexImageViewport src={src} title={title} heightClass="h-full" dark />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function layoutRamexEdges(edges: PureRamexEdge[], root?: string) {
  const levels = new Map<string, number>();
  if (root) levels.set(root, 0);
  edges.forEach((edge) => {
    const from = String(edge.from ?? "");
    const to = String(edge.to ?? "");
    const targetLevel = Math.max(1, Number(edge.level ?? (levels.get(from) ?? 0) + 1));
    levels.set(from, Math.min(levels.get(from) ?? targetLevel - 1, targetLevel - 1));
    levels.set(to, Math.min(levels.get(to) ?? targetLevel, targetLevel));
  });
  const grouped = new Map<number, string[]>();
  levels.forEach((level, node) => grouped.set(level, [...(grouped.get(level) ?? []), node]));
  const maxLevel = Math.max(1, ...Array.from(grouped.keys()));
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes, level) => {
    const ordered = nodes.sort();
    ordered.forEach((node, index) => {
      positions.set(node, {
        x: 60 + (level / maxLevel) * 840,
        y: 50 + ((index + 1) / (ordered.length + 1)) * 420,
      });
    });
  });
  return positions;
}

function RamexAnalyticalTree({ edges, root }: { edges: PureRamexEdge[]; root?: string }) {
  const [topN, setTopN] = useState(35);
  const [maxDepth, setMaxDepth] = useState(6);
  const visible = useMemo(() => {
    return [...edges]
      .filter((edge) => (edge.level ?? 0) <= maxDepth)
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, topN);
  }, [edges, maxDepth, topN]);
  const positions = useMemo(() => layoutRamexEdges(visible, root), [visible, root]);
  const maxWeight = Math.max(1, ...visible.map((edge) => edge.weight ?? 0));

  if (!edges.length) return null;
  return (
    <section className="rounded-2xl border border-white/50 bg-white/85 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-950">Grafo Analítico RAMEX 2007</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">Visualização analítica filtrada para legibilidade. Não substitui a árvore técnica completa.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">Top N
            <select value={topN} onChange={(event) => setTopN(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              {[20, 35, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">Profundidade
            <input type="range" min={1} max={12} value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} />
            <span className="font-mono">{maxDepth}</span>
          </label>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        <svg viewBox="0 0 980 540" className="h-[32rem] min-w-[760px] w-full" role="img" aria-label="Grafo analítico RAMEX 2007">
          <rect width="980" height="540" rx="18" fill="#f8fafc" />
          {visible.map((edge, index) => {
            const source = positions.get(String(edge.from ?? ""));
            const target = positions.get(String(edge.to ?? ""));
            if (!source || !target) return null;
            const width = 1.5 + Math.sqrt((edge.weight ?? 0) / maxWeight) * 9;
            return (
              <line key={`${edge.from}-${edge.to}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#315f72" strokeWidth={width} strokeOpacity={0.58}>
                <title>{`${edge.from} -> ${edge.to} | Weight ${edge.weight ?? 0} | Level ${edge.level ?? "-"}`}</title>
              </line>
            );
          })}
          {Array.from(positions.entries()).map(([node, pos]) => (
            <g key={node}>
              <circle cx={pos.x} cy={pos.y} r={node === root ? 11 : node.toUpperCase() === "SINK" ? 9 : 7} fill={node === root ? "#c8914b" : node.toUpperCase() === "SINK" ? "#334155" : "#e8f4f8"} stroke="#18212f" />
              <text x={pos.x} y={pos.y - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#18212f">{node}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function RamexFlowReading({ edges, expansion }: { edges: PureRamexEdge[]; expansion?: PureRamexResult["expansion"] }) {
  const topLinks = [...edges].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 5);
  const levelWeights = edges.reduce<Record<string, number>>((acc, edge) => {
    const key = String(edge.level ?? "-");
    acc[key] = (acc[key] ?? 0) + (edge.weight ?? 0);
    return acc;
  }, {});
  const strongestLevel = Object.entries(levelWeights).sort((a, b) => b[1] - a[1])[0];
  const branchCounts = edges.reduce<Record<string, number>>((acc, edge) => {
    const key = String(edge.from ?? "");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const branchNode = Object.entries(branchCounts).sort((a, b) => b[1] - a[1])[0];
  const totalWeight = edges.reduce((sum, edge) => sum + (edge.weight ?? 0), 0);
  const dominantPath = expansion?.dominant_paths?.[0]?.path ?? "Sem caminho dominante calculado";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel">
      <h4 className="text-lg font-semibold text-ink">Leitura do fluxo</h4>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Caminho dominante" value={dominantPath} />
        <MetricCard label="Nível com maior peso" value={strongestLevel ? `${strongestLevel[0]} (${formatNumber(strongestLevel[1])})` : "-"} />
        <MetricCard label="Nó com maior ramificação" value={branchNode ? `${branchNode[0]} (${branchNode[1]})` : "-"} />
        <MetricCard label="Peso total selecionado" value={formatNumber(totalWeight)} />
        <MetricCard label="Top ligações" value={formatNumber(topLinks.length)} />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {topLinks.map((edge, index) => (
          <p key={`${edge.from}-${edge.to}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {edge.from} → {edge.to} ({formatNumber(edge.weight ?? 0)})
          </p>
        ))}
      </div>
    </section>
  );
}

function RamexExpansionPlayer({ edges, root }: { edges: PureRamexEdge[]; root?: string }) {
  const maxStep = Math.max(1, ...edges.map((edge) => Number(edge.level ?? 1)));
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setStep((value) => value >= maxStep ? 1 : value + 1), 900);
    return () => window.clearInterval(id);
  }, [playing, maxStep]);
  const visible = edges.filter((edge) => Number(edge.level ?? 1) <= step);
  const positions = useMemo(() => layoutRamexEdges(edges, root), [edges, root]);
  const maxWeight = Math.max(1, ...edges.map((edge) => edge.weight ?? 0));
  if (!edges.length) return null;
  return (
    <section className="rounded-2xl border border-white/50 bg-white/85 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-950">Reprodução da expansão RAMEX</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">A expansão percorre a estrutura condensada, evidenciando a propagação dos ramos a partir da raiz.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <Play className="h-4 w-4" /> {playing ? "Pause" : "Play"}
          </button>
          <span className="text-sm font-semibold text-slate-600">Etapa {step} / {maxStep}</span>
        </div>
      </div>
      <input className="mt-4 w-full" type="range" min={1} max={maxStep} value={step} onChange={(event) => setStep(Number(event.target.value))} />
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        <svg viewBox="0 0 980 540" className="h-[30rem] min-w-[760px] w-full">
          <rect width="980" height="540" rx="18" fill="#f8fafc" />
          {visible.map((edge, index) => {
            const source = positions.get(String(edge.from ?? ""));
            const target = positions.get(String(edge.to ?? ""));
            if (!source || !target) return null;
            const width = 1.5 + Math.sqrt((edge.weight ?? 0) / maxWeight) * 10;
            return <line key={`${edge.from}-${edge.to}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#0f766e" strokeWidth={width} strokeOpacity={0.78} />;
          })}
          {Array.from(positions.entries()).map(([node, pos]) => (
            <g key={node} opacity={node === root || visible.some((edge) => edge.from === node || edge.to === node) ? 1 : 0.22}>
              <circle cx={pos.x} cy={pos.y} r={node === root ? 11 : 7} fill={node === root ? "#c8914b" : "#e8f4f8"} stroke="#18212f" />
              <text x={pos.x} y={pos.y - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#18212f">{node}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
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
  const normalized2007 = title.includes("RAMEX 2007")
    ? normalizeRamex2007Result(data, { imageUrl, csvUrl: data.csvUrl, jsonUrl: data.jsonUrl })
    : undefined;
  const anchor = data.root
    ?? (data.initial_edge ? `${data.initial_edge.from} → ${data.initial_edge.to} (${formatNumber(data.initial_edge.weight ?? 0)})` : "Sem dados gerados");
  const forwardCount = data.edges?.filter((e) => e.direction === "FORWARD").length ?? 0;
  const backwardCount = data.edges?.filter((e) => e.direction === "BACKWARD").length ?? 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/50 bg-white/75 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={data.root ? "Raiz" : "Aresta inicial"} value={normalized2007?.root ?? anchor} />
        {normalized2007 ? <MetricCard label="Critério da raiz" value={normalized2007.rootSelection ?? "Sem dados gerados"} /> : null}
        <MetricCard label="Nós originais" value={formatNumber(metrics.original_nodes ?? data.nodes_original ?? 0)} />
        <MetricCard label="Arestas originais" value={formatNumber(metrics.original_edges ?? data.edges_original ?? 0)} />
        <MetricCard label="Nós selecionados" value={formatNumber(normalized2007?.nodes ?? metrics.selected_nodes ?? 0)} />
        <MetricCard label="Arestas selecionadas" value={formatNumber(normalized2007?.edges ?? metrics.selected_edges ?? 0)} />
        <MetricCard label="Peso selecionado" value={formatNumber(normalized2007?.selectedWeight ?? metrics.selected_weight_sum ?? 0)} />
        <MetricCard label="Peso preservado" value={`${(normalized2007?.preservedWeightPercent ?? metrics.preserved_weight_percent ?? 0).toFixed(2)}%`} />
        <MetricCard label="Método" value={data.method ?? data.algorithm} />
        {normalized2007 ? (
          <>
            <MetricCard label="DAG" value={normalized2007.isDag === undefined ? "Sem dados gerados" : String(normalized2007.isDag)} />
            <MetricCard label="Arborescência válida" value={normalized2007.isArborescence === undefined ? "Sem dados gerados" : String(normalized2007.isArborescence)} />
            <MetricCard label="Alcançável da raiz" value={normalized2007.reachableFromRoot === undefined ? "Sem dados gerados" : String(normalized2007.reachableFromRoot)} />
            <MetricCard label="Root in-degree" value={formatNumber(normalized2007.rootInDegree ?? 0)} />
            <MetricCard label="Max in-degree não-raiz" value={formatNumber(normalized2007.maxNonRootInDegree ?? 0)} />
          </>
        ) : (
          <>
            <MetricCard label="Acíclico" value={metrics.is_acyclic === undefined ? "Sem dados gerados" : String(metrics.is_acyclic)} />
            <MetricCard label="Conectado" value={metrics.is_connected === undefined ? "Sem dados gerados" : String(metrics.is_connected)} />
            {metrics.is_polytree !== undefined ? (
              <MetricCard label="Poly-tree válida" value={String(metrics.is_polytree)} />
            ) : null}
            {data.root ? (
              <MetricCard label="Raiz" value={String(data.root)} />
            ) : null}
            {(data.root_selection_method ?? data.root_selection) ? (
              <MetricCard
                label="Critério da raiz"
                value={
                  (data.root_selection_method ?? data.root_selection) === "from_10A"
                    ? "Herdada do RAMEX 2007"
                    : (data.root_selection_method ?? data.root_selection) === "max_out_weight_fallback"
                      ? "Maior peso de saída (fallback)"
                      : String(data.root_selection_method ?? data.root_selection)
                }
              />
            ) : null}
            <MetricCard label="Arestas Forward" value={formatNumber(forwardCount)} />
            <MetricCard label="Arestas Backward" value={formatNumber(backwardCount)} />
          </>
        )}
      </div>
      {data.warnings?.length ? (
        <WarningPanel>{data.warnings.join(" ")}</WarningPanel>
      ) : null}
      {normalized2007 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-thesis">Fase 1 - Transformação do Problema</p>
            <h4 className="mt-2 text-lg font-semibold text-ink">Rede de transição de estados G</h4>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              O RAMEX 2007 é composto por duas fases principais: transformação da base de dados numa rede de transição de estados e pesquisa de uma sequência de ramificação altamente provável.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              O RAMEX apresenta uma visão global da base de dados porque todas as transições entre itens são incorporadas numa única rede de estados.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricCard label="SOURCE" value={data.transformation?.source_node ?? "SOURCE"} />
              <MetricCard label="SINK" value={data.transformation?.sink_node ?? "SINK"} />
              <MetricCard label="Rede G com ciclos" value={data.transformation?.original_graph_can_contain_cycles === false ? "Nao" : "Sim"} />
              <MetricCard label="Pesos RAMEX" value="Frequências absolutas" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-thesis">RAMEX vs Markov</p>
            <table className="mt-4 min-w-full text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Peso</th>
                  <th className="px-3 py-2 text-left">Leitura</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-ink">RAMEX</td>
                  <td className="px-3 py-3 text-slate-700">Frequências absolutas</td>
                  <td className="px-3 py-3 text-slate-700">Visão global da rede de estados</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium text-ink">Markov</td>
                  <td className="px-3 py-3 text-slate-700">Frequências relativas/probabilidades</td>
                  <td className="px-3 py-3 text-slate-700">Probabilidade local de transição</td>
                </tr>
              </tbody>
            </table>
            {data.transformation?.adjacency_matrix_png ? (
              <a href={dataPath(data.transformation.adjacency_matrix_png)} target="_blank" className="mt-4 inline-flex text-sm font-semibold text-thesis underline">
                Abrir matriz de adjacencia RAMEX 2007
              </a>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-thesis">Fase 2 - Pesquisa das Sequências</p>
            <h4 className="mt-2 text-lg font-semibold text-ink">Condensação e expansão</h4>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              A rede original G pode conter ciclos, a aciclicidade surge apenas após o processo de condensação por Maximum Weight Rooted Branching.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricCard label="Condensação" value={data.condensation?.rooted_branching_algorithm ?? "Fulkerson/Edmonds"} />
              <MetricCard label="Compression ratio" value={`${((data.condensation?.compression_ratio ?? 0) * 100).toFixed(2)}%`} />
              <MetricCard label="Arestas removidas" value={formatNumber(data.condensation?.removed_edges ?? 0)} />
              <MetricCard label="Profundidade" value={formatNumber(data.expansion?.metrics?.max_branch_depth ?? 0)} />
            </div>
          </div>
        </div>
      ) : null}
      {normalized2007 ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-thesis">Fase 2 - Condensação</p>
            <h4 className="mt-2 text-lg font-semibold text-ink">Métricas do rooted branching e evidência formal</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <MetricCard label="DAG" value={String(normalized2007.isDag ?? false)} />
              <MetricCard label="Arborescência" value={String(normalized2007.isArborescence ?? false)} />
              <MetricCard label="Root in-degree" value={formatNumber(normalized2007.rootInDegree ?? 0)} />
              <MetricCard label="Max non-root in-degree" value={formatNumber(normalized2007.maxNonRootInDegree ?? 0)} />
              <MetricCard label="Edges = nodes - 1" value={String((normalized2007.edges ?? 0) === Math.max((normalized2007.nodes ?? 0) - 1, 0))} />
            </div>
          </div>
          <RamexTechnicalTreeViewer src={resolvedImageSrc(imageFile, imageUrl)} title="Árvore técnica completa RAMEX 2007" />
          <PureRamexTable rows={data.edges ?? []} />
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-thesis">Fase 2 - Expansão</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              A separação entre grafo técnico e grafo analítico permite conciliar rigor formal e legibilidade. O primeiro demonstra a árvore completa obtida pelo algoritmo; o segundo destaca os ramos dominantes para interpretação.
            </p>
          </div>
          <RamexAnalyticalTree edges={data.edges ?? []} root={normalized2007.root} />
          <RamexFlowReading edges={data.edges ?? []} expansion={data.expansion} />
          <RamexSankey edges={data.edges ?? []} root={normalized2007.root} preservedWeight={normalized2007.selectedWeight} />
          <RamexExpansionPlayer edges={data.edges ?? []} root={normalized2007.root} />
        </>
      ) : (
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
      )}
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
    return <EmptyState message="Validação RAMEX 2007 ainda não gerada para este dataset." />;
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
          {best?.Algoritmo ?? "Sem dados gerados"} {best?.["Peso preservado (%)"] !== undefined ? `(${formatNumber(best["Peso preservado (%)"], 2)}%)` : ""}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          A comparação não aponta para um método único. O desempenho depende da densidade,
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
                <td className="px-3 py-3 text-right">{formatNumber(row["Peso preservado (%)"], 2)}%</td>
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
        ramex2007: uploaded.pure_ramex.ramex2007
          ? {
              ...uploaded.pure_ramex.ramex2007,
              imageUrl: uploaded.files.ramex2007_png ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007_png}` : undefined,
              csvUrl: uploaded.files.ramex2007 ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007}` : undefined,
              jsonUrl: uploaded.files.ramex2007_png ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007_png.replace(".png", ".json")}` : undefined,
            }
          : undefined,
        comparisonRows: uploaded.pure_ramex.comparisonRows ?? [],
        missing: uploaded.pure_ramex.missing ?? [],
      }
    : uploaded?.pure
      ? {
          ramex2007: uploaded.pure.ramex2007
            ? {
                ...uploaded.pure.ramex2007,
                imageUrl: uploaded.files.ramex2007_png ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007_png}` : undefined,
                csvUrl: uploaded.files.ramex2007 ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007}` : undefined,
                jsonUrl: uploaded.files.ramex2007_png ? `${API_BASE_URL}/api/file/${uploaded.job_id}/${uploaded.files.ramex2007_png.replace(".png", ".json")}` : undefined,
              }
            : undefined,
          forward: uploaded.pure.forward,
          backForward: uploaded.pure.back_forward_formal,
          comparisonRows: [],
          comparisonMarkdown: uploaded.pure.validation?.summary,
          multidatasetMarkdown: "",
          missing: [],
        }
      : undefined;
  const effectiveData = uploadedPure ?? data;
  const uploadedValidation = uploaded ? uploadResultToValidationRow(uploaded) : validation;

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
    ["forward", "RAMEX 2015 — Forward"],
    ["backforward", "RAMEX 2015 — Back-and-Forward"],
    ["comparison", "Comparação"],
  ] as const;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Alinhamento bibliográfico</p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">RAMEX 2007 / 2015</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Esta secção separa o RAMEX 2007 como transformação formal da base de dados numa rede de estados seguida de Maximum Weight Rooted Branching, e o RAMEX 2015 como conjunto de heurísticas Forward e Back-and-Forward para geração de tree/poly-tree.
        </p>
        <button
          disabled
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          <Play className="h-4 w-4" />
          Executar RAMEX 2007
        </button>
        <p className="mt-2 text-xs text-slate-500">Execução RAMEX 2007 ainda disponível apenas via scripts.</p>
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
          {available === 0 ? <WarningPanel>Resultados RAMEX 2007 ainda não gerados para este dataset.</WarningPanel> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Dataset selecionado" value={datasets[datasetId].label} />
            <MetricCard label="Algoritmos disponíveis" value={formatNumber(available)} />
            <MetricCard label="Maior peso preservado" value={best?.Algoritmo ?? "Sem dados gerados"} />
            <MetricCard label="Peso preservado máximo" value={best?.["Peso preservado (%)"] !== undefined ? `${formatNumber(best["Peso preservado (%)"], 2)}%` : "Sem dados gerados"} />
            <MetricCard label="Tipo estrutural" value={structuralType} />
            <MetricCard label="Método(s) mais simples" value={simplestLabel} />
            <MetricCard label="Mais próximo da Poly-tree" value={polyLike?.algorithm ?? "Sem dados gerados"} />
          </div>
          <TechnicalValidationPanel rows={buildTechnicalValidationRows(effectiveData, uploadedValidation)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h3 className="text-lg font-semibold text-ink">RAMEX 2007</h3>
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
                O RAMEX-Forum temporal é apresentado em aba própria apenas quando existe lógica de influência temporal, sinais, latência e extração estrutural.
              </p>
            </div>
          </div>
        </motion.section>
      ) : null}

      {tab === "ramex2007" ? (
        <motion.div key="pure-2007" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX 2007 Rooted Branching"
          description="O RAMEX 2007 Rooted Branching usa Maximum Weight Rooted Branching na fase 10A formal. A fase simplificada 07 é mantida apenas como heurística exploratória."
          data={effectiveData?.ramex2007}
          imageFile={uploaded ? undefined : `ramex2007_dataset${datasetId}.png`}
          imageUrl={uploaded?.files.ramex2007_png ? `${imageBase}${uploaded.files.ramex2007_png}` : undefined}
        />
        </motion.div>
      ) : null}
      {tab === "forward" ? (
        <motion.div key="pure-forward" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX 2015 — Forward Heuristic"
          description="A Forward Heuristic é adequada quando existe uma raiz ou nó inicial conhecido. Expande a árvore para a frente, escolhendo transições elegíveis de maior peso."
          data={effectiveData?.forward}
          imageFile={uploaded ? undefined : `ramex_forward_dataset${datasetId}.png`}
          imageUrl={uploaded?.files.forward_png ? `${imageBase}${uploaded.files.forward_png}` : undefined}
        />
        </motion.div>
      ) : null}
      {tab === "backforward" ? (
        <motion.div key="pure-backforward" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <PureRamexMethodPanel
          title="RAMEX 2015 — Back-and-Forward Poly-tree"
          description="A Back-and-Forward Heuristic é adequada quando não existe nó inicial claro. Começa pela relação mais forte e expande em ambos os sentidos, procurando uma poly-tree de maior peso."
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
      <EmptyState message="RAMEX-Forum temporal requer resultados gerados pela pipeline de influência temporal. Execute RAMEX-Forum temporal ou análise completa para obter Fase 1 e Fase 2." />
    );
  }

  const metrics = data.metrics ?? {};
  const edges = data.influence_graph?.edges ?? [];
  const simplified = data.simplified_influence?.edges ?? [];
  const centralNodes = data.path_analysis?.central_nodes ?? [];
  const topRelation = metrics.top_relation;
  const dominantPath = metrics.dominant_path?.join(" → ") || "Sem dados gerados";
  const forumImage = graphImage
    ?? (jobId && data.files?.graph_png ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.graph_png}` : undefined);
  const simplifiedImage = staticSimplifiedImage
    ?? (jobId && data.files?.simplified_png ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${data.files.simplified_png}` : undefined);
  const temporal = data.temporal_phase1;
  const temporalMetrics = temporal?.metrics ?? {};
  const temporalEdges = temporal?.influence_graph?.edges ?? temporal?.temporal_influence?.edges ?? [];
  const temporalFiles = temporal?.files ?? {};
  const temporalGraphImage = jobId && temporalFiles.graph_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${temporalFiles.graph_png}`
    : undefined;
  const temporalMatrixImage = jobId && temporalFiles.influence_matrix_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${temporalFiles.influence_matrix_png}`
    : undefined;
  const totalTemporalWeight = temporalMetrics.total_influence_weight ?? temporalEdges.reduce((sum, edge) => sum + (edge.Weight ?? edge.SmoothedWeight ?? 0), 0);
  const phase2 = data.temporal_phase2;
  const phase2Metrics = phase2?.metrics ?? {};
  const phase2Edges = phase2?.selected_edges ?? phase2?.structure?.edges ?? [];
  const phase2Files = phase2?.files ?? {};
  const phase2StructureImage = jobId && phase2Files.phase2_structure_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${phase2Files.phase2_structure_png}`
    : undefined;
  const phase2SpecificImage = jobId
    ? phase2Metrics.heuristic_used === "forward" && phase2Files.forward_tree_png
      ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${phase2Files.forward_tree_png}`
      : phase2Files.back_forward_polytree_png
        ? `${API_BASE_URL}/api/ramex-forum/jobs/${jobId}/file/${phase2Files.back_forward_polytree_png}`
        : undefined
    : undefined;

  return (
    <section className="space-y-5">
      {temporal ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 shadow-2xl shadow-teal-100/50 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">RAMEX-Forum · Fase 1 formal</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Transformação temporal do problema</h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {temporal.interpretation ?? "O dataset original foi transformado numa rede temporal de influência, onde cada nó representa um sinal/evento e cada aresta representa uma influência temporal suavizada e filtrada."}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Esta fase prepara a rede temporal, os contadores de sinal, a influência, o epsilon smoothing, a filtragem de ruído e a matriz de influência. Não executa heurísticas forward, back-and-forward, poly-tree, condensação ou expansão.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Sinais" value={formatNumber(temporalMetrics.signals ?? 0)} />
            <MetricCard label="Entidades" value={formatNumber(temporalMetrics.entities ?? 0)} />
            <MetricCard label="Relações temporais" value={formatNumber(temporalMetrics.temporal_relations ?? 0)} />
            <MetricCard label="latency_max" value={`${formatNumber(temporalMetrics.latency_max ?? 0, 0)} s`} />
            <MetricCard label="epsilon" value={formatNumber(temporalMetrics.epsilon ?? 0, 3)} />
            <MetricCard label="Peso total" value={formatNumber(totalTemporalWeight, 2)} />
            <MetricCard label="Ciclos permitidos" value={temporalMetrics.cycles_allowed ? "Sim" : "Não"} />
            <MetricCard label="Ciclos detetados" value={temporalMetrics.has_cycles ? "Sim" : "Não"} />
            <MetricCard label="Múltiplas entradas" value={temporalMetrics.multiple_inputs_allowed ? "Permitidas" : "Não"} />
            <MetricCard label="min_frequency" value={formatNumber(temporalMetrics.filters_active?.min_frequency ?? 0)} />
            <MetricCard label="min_influence" value={formatNumber(temporalMetrics.filters_active?.min_influence ?? 0, 2)} />
            <MetricCard label="max_latency" value={`${formatNumber(temporalMetrics.filters_active?.max_latency ?? 0, 0)} s`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
              <h4 className="font-semibold text-slate-100">Grafo temporal técnico</h4>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Completo para debugging académico: ciclos e múltiplas entradas são preservados nesta fase.
              </p>
              {temporalGraphImage ? (
                <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
                  <img src={temporalGraphImage} alt="Grafo temporal RAMEX-Forum" className="max-h-[34rem] w-full object-contain" />
                </div>
              ) : (
                <EmptyState message="Grafo temporal RAMEX-Forum ainda não disponível." />
              )}
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
              <h4 className="font-semibold text-slate-100">Heatmap da matriz de influência</h4>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Matriz FROM x TO com pesos absolutos suavizados. Não há normalização Markoviana.
              </p>
              {temporalMatrixImage ? (
                <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
                  <img src={temporalMatrixImage} alt="Matriz de influência RAMEX-Forum" className="max-h-[34rem] w-full object-contain" />
                </div>
              ) : (
                <EmptyState message="Heatmap RAMEX-Forum ainda não disponível." />
              )}
            </div>
          </div>

          <SankeyPanel
            edges={temporalEdges}
            title="Sankey temporal RAMEX-Forum"
            description="Propagação temporal entre sinais, com espessura proporcional ao peso de influência suavizado."
          />

          <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-md scrollbar-thin">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-200 backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Frequência</th>
                  <th className="px-3 py-2 text-right">Delta t</th>
                  <th className="px-3 py-2 text-right">Decay</th>
                  <th className="px-3 py-2 text-right">Peso suavizado</th>
                </tr>
              </thead>
              <tbody>
                {temporalEdges.slice(0, 80).map((edge, index) => (
                  <tr key={`${edge.From}-${edge.To}-${index}`} className="border-t border-slate-100 odd:bg-white/70 even:bg-slate-50/80 hover:bg-teal-50/60">
                    <td className="px-3 py-3 font-medium text-ink">{edge.From}</td>
                    <td className="px-3 py-3 text-slate-700">{edge.To}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Frequency ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.DeltaT ?? 0, 2)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.TemporalDecay ?? 0, 4)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Weight ?? edge.SmoothedWeight ?? 0, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h4 className="font-semibold text-ink">Timeline de sinais</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {(temporal.signal_counter?.rows ?? []).slice(0, 12).map((row, index) => (
                  <p key={`${row.entity}-${row.timestamp}-${row.signal}-${index}`}>
                    <span className="font-semibold text-ink">{row.entity}</span> · t={row.timestamp} · {row.signal} · contador {formatNumber(row.signal_counter ?? 0)}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h4 className="font-semibold text-ink">RAMEX-Forum vs Markov</h4>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="py-2 font-semibold">RAMEX-Forum</td><td>Influência temporal global, rede de propagação e pesos absolutos suavizados.</td></tr>
                    <tr><td className="py-2 font-semibold">Markov</td><td>Probabilidades locais, dependência imediata e normalização probabilística.</td></tr>
                    <tr><td className="py-2 font-semibold">Nesta fase</td><td>Não são usadas probabilidades Markovianas nem normalização de pesos.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {phase2 ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-6 shadow-2xl shadow-amber-100/50 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">RAMEX-Forum · Fase 2</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Extração estrutural</h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {phase2.interpretation ?? "Na Fase 2, o RAMEX-Forum transforma a rede temporal de influência numa estrutura interpretável. Quando existe nó inicial, aplica-se Forward Heuristic. Na ausência de nó inicial claro, aplica-se Back-and-Forward Heuristic para construir uma Poly-tree de influência."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Modo escolhido" value={phase2Metrics.heuristic_used === "forward" ? "Forward Tree" : "Back-and-Forward"} />
            <MetricCard label="Nó inicial" value={phase2Metrics.selected_initial_node ?? phase2Metrics.initial_edge ?? "Sem nó inicial"} />
            <MetricCard label="Modo inicial" value={phase2Metrics.initial_node_mode ?? "auto"} />
            <MetricCard label="Nós antes/depois" value={`${formatNumber(phase2Metrics.nodes_before ?? 0)} → ${formatNumber(phase2Metrics.nodes_after ?? 0)}`} />
            <MetricCard label="Arestas antes/depois" value={`${formatNumber(phase2Metrics.edges_before ?? 0)} → ${formatNumber(phase2Metrics.edges_after ?? 0)}`} />
            <MetricCard label="Influência preservada" value={`${formatNumber(phase2Metrics.preserved_influence_percent ?? 0, 2)}%`} />
            <MetricCard label="DAG" value={phase2Metrics.is_dag ? "true" : "false"} />
            <MetricCard label="Árvore" value={phase2Metrics.is_tree ? "true" : "false"} />
            <MetricCard label="Poly-tree" value={phase2Metrics.is_polytree ? "true" : "false"} />
            <MetricCard label="max_depth" value={formatNumber(phase2Metrics.max_depth ?? 0)} />
            <MetricCard label="top_k" value={formatNumber(phase2Metrics.top_k ?? 0)} />
            <MetricCard label="Peso selecionado" value={formatNumber(phase2Metrics.selected_influence_weight ?? 0, 2)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
              <h4 className="font-semibold text-slate-100">Grafo técnico da Fase 2</h4>
              {phase2StructureImage ? (
                <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
                  <img src={phase2StructureImage} alt="Estrutura RAMEX-Forum Fase 2" className="max-h-[34rem] w-full object-contain" />
                </div>
              ) : (
                <EmptyState message="Estrutura RAMEX-Forum Fase 2 ainda não disponível." />
              )}
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
              <h4 className="font-semibold text-slate-100">{phase2Metrics.heuristic_used === "forward" ? "Forward Tree" : "Back-and-Forward Poly-tree"}</h4>
              {phase2SpecificImage ? (
                <div className="mt-4 rounded-2xl border border-slate-700 bg-white p-2 shadow-xl">
                  <img src={phase2SpecificImage} alt="Heurística RAMEX-Forum Fase 2" className="max-h-[34rem] w-full object-contain" />
                </div>
              ) : (
                <EmptyState message="Imagem específica da heurística ainda não disponível." />
              )}
            </div>
          </div>

          <SankeyPanel
            edges={phase2Edges}
            title="Sankey RAMEX-Forum Fase 2"
            description="Fluxo da estrutura extraída sobre a rede temporal de influência."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h4 className="font-semibold text-ink">Caminho dominante</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {(phase2.dominant_path ?? []).length ? phase2.dominant_path?.map((row, index) => (
                  <p key={`${row.From}-${row.To}-${index}`}>
                    <span className="font-mono text-xs text-slate-500">#{row.Step ?? index + 1}</span>{" "}
                    <span className="font-semibold text-ink">{row.From}</span> → {row.To} · peso {formatNumber(row.Weight ?? 0, 3)} · {row.Direction}
                  </p>
                )) : <p>Sem caminho dominante gerado.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
              <h4 className="font-semibold text-ink">Validação estrutural</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {Object.entries(phase2.structure?.validation ?? {}).map(([key, value]) => (
                  <p key={key}><span className="font-semibold text-ink">{key}</span>: {value ? "true" : "false"}</p>
                ))}
                {(phase2Metrics.warnings ?? []).map((warning, index) => (
                  <p key={index} className="text-amber-700">{warning}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-white/50 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-md scrollbar-thin">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-200 backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2 text-right">Frequency</th>
                  <th className="px-3 py-2 text-right">Level</th>
                  <th className="px-3 py-2 text-left">Direction</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {phase2Edges.map((edge, index) => (
                  <tr key={`${edge.From}-${edge.To}-${index}`} className="border-t border-slate-100 odd:bg-white/70 even:bg-slate-50/80 hover:bg-amber-50/60">
                    <td className="px-3 py-3 font-medium text-ink">{edge.From}</td>
                    <td className="px-3 py-3 text-slate-700">{edge.To}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Weight ?? 0, 3)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Frequency ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(edge.Level ?? 0)}</td>
                    <td className="px-3 py-3 text-slate-700">{(edge as Record<string, unknown>).Direction as string}</td>
                    <td className="px-3 py-3 text-slate-600">{(edge as Record<string, unknown>).Reason as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : temporal ? (
        <WarningPanel>RAMEX-Forum Fase 2 requer outputs válidos da Fase 1 e relações de influência após filtragem.</WarningPanel>
      ) : null}

      <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-teal-50 p-6 shadow-2xl shadow-cyan-200/40 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Camada experimental mantida</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">RAMEX-Forum interpretativo legado</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Esta camada antiga continua disponível por compatibilidade. A Fase 1 formal acima é a transformação temporal com sinais, latência, smoothing e filtros; nenhuma delas substitui o RAMEX 2007 formal.
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
                <tr><td className="py-2 font-semibold">RAMEX 2007</td><td>Condensa a rede sequencial numa arborescência enraizada de peso máximo.</td></tr>
                <tr><td className="py-2 font-semibold">RAMEX 2015</td><td>Aplica Forward ou Back-and-Forward para obter tree/poly-tree consoante exista, ou não, nó inicial claro.</td></tr>
                <tr><td className="py-2 font-semibold">RAMEX-Forum temporal</td><td>Explora influência temporal com sinais, latência, pesos de influência e extração estrutural própria.</td></tr>
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

  function clampPosition(pos: { x: number; y: number }, s = scale) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 900;
    const h = rect?.height ?? 720;
    const maxX = Math.max(0, (w * s - w) / 2 + w * 0.18);
    const maxY = Math.max(0, (h * s - h) / 2 + h * 0.18);
    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y)),
    };
  }

  function updateScale(nextScale: number) {
    const s = Math.max(0.5, Math.min(4, nextScale));
    setScale(s);
    setPosition((current) => clampPosition(current, s));
  }

  function resetView() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsModalOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      setJobs(await getHistoryJobs());
    } catch (err) {
      setError(friendlyApiError(err));
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
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsDetailLoading(false);
      setLoadingDetailJobId(null);
    }
  }

  async function reuseResult(jobId: string) {
    setError("");
    try {
      const result = await getJobResult(jobId);
      if (!result) { setError("O job ainda não tem resultado completo para reutilizar."); return; }
      onReuse?.(result);
      setDetail(await getHistoryJobDetail(jobId));
    } catch (err) {
      setError(friendlyApiError(err));
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
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery = !q || job.job_id.toLowerCase().includes(q) || job.dataset_name.toLowerCase().includes(q);
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
        ["RAMEX 2015 — Forward", detail.files.forward_png],
        ["RAMEX 2015 — Back-and-Forward", detail.files.back_forward_formal_png],
        ["Poly-tree / validação", detail.files.polytree_png],
        ["RAMEX-Forum temporal", detail.files.forum_graph_png],
        ["RAMEX-Forum legado/inspirado", detail.files.forum_simplified_png],
      ] as Array<[string, string | null | undefined]>).filter((e): e is [string, string] => Boolean(e[1]))
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
            <option value="pure">RAMEX 2007 / 2015</option>
            <option value="forum">RAMEX-Forum temporal</option>
            <option value="both">Análise completa</option>
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
                <th className="px-4 py-3 text-left">Melhor abordagem RAMEX</th>
                <th className="px-4 py-3 text-right">Peso preservado</th>
                <th className="px-4 py-3 text-left">Forum temporal</th>
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
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-cyan-800">{formatNumber(row["Peso preservado (%)"], 2)}%</td>
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

function ValidationTable({ rows }: { rows: Ramex2007DatasetComparisonRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="A comparação RAMEX 2007 ainda não está disponível." />;
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white scrollbar-thin">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left">Dataset</th>
            <th className="px-3 py-2 text-right">Nós</th>
            <th className="px-3 py-2 text-right">Arestas</th>
            <th className="px-3 py-2 text-left">Raiz RAMEX 2007</th>
            <th className="px-3 py-2 text-right">Peso preservado RAMEX 2007</th>
            <th className="px-3 py-2 text-left">DAG</th>
            <th className="px-3 py-2 text-left">Arborescência</th>
            <th className="px-3 py-2 text-left">Observação</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {rows.map((row) => (
            <tr key={row.Dataset} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/65">
              <td className="px-3 py-3 font-semibold text-slate-800">{row.Dataset}</td>
              <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">{formatNumber(row.Nos)}</td>
              <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">{formatNumber(row.Arestas)}</td>
              <td className="px-3 py-3 font-medium text-slate-700">{row.Raiz}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">{formatNumber(row.PesoPreservado, 2)}%</td>
              <td className="px-3 py-3 text-slate-700">{row.DAG === undefined ? "-" : String(row.DAG)}</td>
              <td className="px-3 py-3 text-slate-700">{row.Arborescencia === undefined ? "-" : String(row.Arborescencia)}</td>
              <td className="max-w-xl px-3 py-3 text-slate-700">{row.Observacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationCharts({ rows }: { rows: Ramex2007DatasetComparisonRow[] }) {
  if (rows.length === 0) return null;

  const chartRows = rows.map((row) => ({
    dataset: row.Dataset.replace("Dataset ", "D"),
    peso: parseNumber(row.PesoPreservado),
  }));

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h3 className="text-sm font-semibold text-ink">Peso preservado RAMEX 2007 por dataset</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dataset" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="peso" name="Peso preservado (%)" fill="#315f72" />
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
    ["Grafo observado", "Transições reconstruídas diretamente do dataset"],
    ["RAMEX 2007 Rooted Branching", "Implementação formal Cavique 2007: Maximum Weight Rooted Branching"],
    ["RAMEX 2015 Forward Heuristic", "Tree quando existe nó inicial conhecido"],
    ["RAMEX 2015 Back-and-Forward", "Poly-tree quando não existe nó inicial claro"],
    ["Sankey", "Visualização complementar de fluxos; não substitui RAMEX"],
    ["Poly-tree completo", "Validação estrutural e visualização complementar"],
  ];

  const pipelineSteps = [
    "Dataset",
    "Sequências",
    "Pares",
    "Matriz de Adjacência",
    "Grafo",
    "Rooted Branching",
    "RAMEX 2015 — Forward",
    "RAMEX 2015 — Back-and-Forward",
    "Poly-tree formal",
    "Interpretação",
  ];

  const references = [
    "Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007, LNAI 4874, pp. 406–414.",
    "Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees. Advances in Intelligent Systems and Computing, 354, pp. 143–153.",
    "Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products. Expert Systems, 34:e12174.",
    "Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática. Revista de Ciência Elementar, 9(02):041.",
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold text-thesis">Base técnica da análise sequencial.</p>
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
          <h4 className="text-lg font-semibold text-ink">Implementações RAMEX alinhadas com a bibliografia</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>RAMEX 2007 — Maximum Weight Rooted Branching</li>
            <li>RAMEX 2015 — Forward Heuristic</li>
            <li>RAMEX 2015 — Back-and-Forward Poly-tree</li>
          </ul>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-panel">
          <h4 className="text-lg font-semibold text-ink">RAMEX-Forum temporal</h4>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            O RAMEX-Forum é mantido como abordagem complementar apenas quando existe análise de influência temporal, com sinais, latência, pesos de influência e estrutura própria.
          </p>
        </div>
      </div>


      <div className="rounded-lg border border-thesis/20 bg-thesis/5 p-5 shadow-panel">
        <p className="text-sm leading-7 text-slate-700">
          Esta aplicação implementa uma análise sequencial inspirada no RAMEX. A versão atual privilegia a
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
          RAMEX 2007 em estruturas densas, quase lineares e pequenas/completas.
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
    ["RAMEX 2015 — Forward", "Expansão a partir de nó inicial conhecido.", "ramex_forward.json"],
    ["RAMEX 2015 — Back-and-Forward", "Expansão pela melhor relação inicial quando não há raiz clara.", "ramex_back_forward.json"],
    ["Poly-tree formal", "Validação estrutural: DAG conectado e árvore não dirigida.", "validação RAMEX 2015"],
  ];

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-5 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-ink">Pipeline RAMEX bibliográfica</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A versão atual transforma dados em rede dirigida ponderada e separa RAMEX 2007, RAMEX 2015, RAMEX-Forum temporal e visualizações complementares como Sankey.
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
    await navigator.clipboard.writeText(reportBody).catch(() => {});
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl ring-1 ring-white/70 backdrop-blur-xl">
        <p className="text-sm font-semibold text-thesis">{datasetName}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">Relatório final RAMEX</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          O relatório final separa RAMEX 2007 formal, RAMEX 2015 Forward/Back-and-Forward, RAMEX-Forum temporal, visualizações complementares, limitações e trabalho futuro. As heurísticas locais antigas ficam identificadas apenas como exploração inicial.
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
          <MetricCard label="Estrutura de referência" value={pureRamexBest(pureData) ?? "Sem dados gerados"} />
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
    ["Dataset", "Entrada de sequências ou tabela entidade/tempo/sinal."],
    ["Transformação", "RAMEX 2007 cria rede de estados com SOURCE, SINK e frequências absolutas."],
    ["Grafo", "Grafo técnico completo e matriz preservam a evidência formal."],
    ["RAMEX 2007", "Rooted Branching condensa a rede numa arborescência de peso máximo."],
    ["RAMEX 2015", "Forward gera tree quando há nó inicial; Back-and-Forward gera poly-tree quando não há raiz clara."],
    ["Forum temporal", "RAMEX-Forum calcula influência temporal e extrai Forward Tree ou Back-and-Forward Poly-tree."],
    ["Conclusão", "Relatório final junta métricas, gráficos, Sankey, caminho dominante e limitações."],
  ];
  const validationChecklist = [
    ["dataset01", "RAMEX 2007/2015 completo + RAMEX-Forum temporal quando reprocessado"],
    ["dataset02", "Rooted Branching formal + validação comparativa"],
    ["dataset03", "Dataset pequeno com árvore completa e leitura integral"],
    ["testes_SCADA", "Teste externo recomendado: timestamp real e initial_node=Bomba_ON"],
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
        <MetricCard label="Melhor RAMEX 2007" value={bestPure ?? "Sem dados gerados"} />
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
          Nesta framework, RAMEX 2007, RAMEX 2015 e RAMEX-Forum temporal são apresentados como camadas diferentes. O RAMEX 2007 usa frequências absolutas e rooted branching; o RAMEX 2015 usa Forward/Back-and-Forward para tree/poly-tree; e o RAMEX-Forum usa influência temporal, latência, smoothing e heurísticas estruturais sobre a rede temporal.
        </p>
      </div>

      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 shadow-panel">
        <h4 className="text-lg font-semibold text-ink">Checklist de validação para defesa</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {validationChecklist.map(([name, goal]) => (
            <div key={name} className="rounded-lg border border-cyan-100 bg-white/80 px-3 py-2 text-sm">
              <span className="font-semibold text-ink">{name}</span>
              <p className="mt-1 text-slate-600">{goal}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onGoTo("upload")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Upload / Nova Análise
        </button>
        <button onClick={() => onGoTo("pure")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Ver RAMEX 2007 / 2015
        </button>
        <button onClick={() => onGoTo("forum")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-thesis shadow-panel">
          Ver RAMEX-Forum temporal
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
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [datasetType, setDatasetType] = useState<UploadDatasetType>("simple_sequences");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("pure");
  const [eventMode, setEventMode] = useState<EventMode>("simple");
  const [caseColumn, setCaseColumn] = useState("");
  const [timeColumn, setTimeColumn] = useState("");
  const [eventColumn, setEventColumn] = useState("");
  const [advancedEventColumns, setAdvancedEventColumns] = useState<string[]>([]);
  const [numericDiscretization, setNumericDiscretization] = useState<Record<string, NumericDiscretizationMode>>({});
  const [caseWindow, setCaseWindow] = useState<CaseWindowMode>("none");
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
  const [forumInitialNode, setForumInitialNode] = useState("");
  const [forumForwardTopK, setForumForwardTopK] = useState("1");
  const [forumMaxDepth, setForumMaxDepth] = useState("10");
  const [forumMinSmoothedWeight, setForumMinSmoothedWeight] = useState("");
  const [forumForceHeuristic, setForumForceHeuristic] = useState<"auto" | "forward" | "back_and_forward">("auto");
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [showTechnicalError, setShowTechnicalError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const canMapColumns = datasetType !== "simple_sequences";
  const advancedNumericColumns = useMemo(
    () => advancedEventColumns.filter((column) => isNumericPreviewColumn(previewRows, column)),
    [advancedEventColumns, previewRows],
  );
  const generatedEventPreview = useMemo(() => {
    if (!previewRows.length || eventMode !== "advanced") return [];
    return previewRows
      .slice(0, 10)
      .map((row) => buildAdvancedPreviewEvent(row, previewRows, advancedEventColumns, numericDiscretization))
      .filter(Boolean);
  }, [advancedEventColumns, eventMode, numericDiscretization, previewRows]);
  const generatedEventPreviewRows = useMemo(() => {
    if (!previewRows.length || eventMode !== "advanced") return [];
    return previewRows.slice(0, 10).map((row) => ({
      original: row,
      generatedEvent: buildAdvancedPreviewEvent(row, previewRows, advancedEventColumns, numericDiscretization),
      generatedCaseId: caseWindow === "none" ? String(row[caseColumn] ?? "") : `${caseWindow}: ${String(row[timeColumn] ?? "")}`,
      order: String(row[timeColumn] ?? ""),
    })).filter((row) => row.generatedEvent);
  }, [advancedEventColumns, caseColumn, caseWindow, eventMode, numericDiscretization, previewRows, timeColumn]);
  const uniquePreviewCount = useMemo(() => new Set(generatedEventPreview).size, [generatedEventPreview]);
  const structuralSelectedEventColumns = useMemo(
    () => advancedEventColumns.filter((column) => isStructuralEventColumn(column, caseColumn, timeColumn)),
    [advancedEventColumns, caseColumn, timeColumn],
  );
  const advancedRecommendation = useMemo(
    () => inferAdvancedEventColumns(columns, caseColumn, timeColumn, eventColumn),
    [caseColumn, columns, eventColumn, timeColumn],
  );

  async function handleUpload() {
    if (!file) { setError("Selecione um ficheiro antes de enviar."); return; }

    setError("");
    setResult(null);
    setIsUploading(true);

    try {
      const uploaded = await uploadDataset(file);
      setJobId(uploaded.job_id);
      setColumns(uploaded.columns);
      setPreviewRows(uploaded.preview_rows ?? []);
      if (uploaded.columns.length > 0) {
        const mapping = inferColumnMapping(uploaded.columns, datasetType);
        const advanced = inferAdvancedEventColumns(uploaded.columns, mapping.caseColumn, mapping.timeColumn, mapping.eventColumn);
        setCaseColumn(mapping.caseColumn);
        setTimeColumn(mapping.timeColumn);
        setEventColumn(mapping.eventColumn);
        setAdvancedEventColumns(advanced.selected);
        setNumericDiscretization(advanced.numericRules);
      }
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!jobId) { setError("Envie primeiro um ficheiro para criar um job."); return; }

    if (canMapColumns && eventMode === "simple" && (!caseColumn || !timeColumn || !eventColumn)) {
      setError("Complete o mapeamento de colunas antes de executar a análise.");
      return;
    }
    if (canMapColumns && eventMode === "advanced") {
      if (!timeColumn || (caseWindow === "none" && !caseColumn)) {
        setError("No modo avançado, escolha tempo/ordem e uma entidade/caso ou uma janela temporal.");
        return;
      }
      if (advancedEventColumns.length === 0) {
        setError("Selecione pelo menos uma coluna para construir o evento avançado.");
        return;
      }
      const missingNumericRules = advancedNumericColumns.filter((column) => !numericDiscretization[column]);
      if (missingNumericRules.length) {
        setError(`Colunas numéricas sem regra: ${missingNumericRules.join(", ")}. Escolha quantis, variação percentual ou ignorar.`);
        return;
      }
    }

    setError("");
    setResult(null);
    setJobState(null);
    setShowTechnicalError(false);

    try {
      const payload = {
        job_id: jobId,
        dataset_type: (canMapColumns && eventMode === "advanced") ? "event_table" : datasetType,
        analysis_type: analysisType,
        case_column: canMapColumns ? caseColumn : undefined,
        entity_column: canMapColumns ? caseColumn : undefined,
        time_column: canMapColumns ? timeColumn : undefined,
        event_column: canMapColumns && eventMode === "simple" ? eventColumn : undefined,
        event_mode: canMapColumns ? eventMode : "simple",
        event_columns: canMapColumns && eventMode === "advanced" ? advancedEventColumns : undefined,
        numeric_discretization: canMapColumns && eventMode === "advanced" ? numericDiscretization : undefined,
        case_window: canMapColumns && eventMode === "advanced" ? caseWindow : "none",
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
        forum_initial_node: forumInitialNode.trim() || null,
        forum_forward_top_k: parseDecimalInput(forumForwardTopK, 1),
        forum_max_depth: parseDecimalInput(forumMaxDepth, 10),
        forum_min_smoothed_weight: forumMinSmoothedWeight.trim() ? parseDecimalInput(forumMinSmoothedWeight, 0) : null,
        forum_force_heuristic: forumForceHeuristic,
      };
      console.log("RUN FULL PAYLOAD SENT", payload);
      const started = await startAnalyzeUploadedDataset(payload);
      setJobId(started.job_id);
      setIsAnalyzing(true);
    } catch (err) {
      setError(friendlyApiError(err));
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
      } catch (err) {
        if (canceled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Job não encontrado")) return;
        setError(friendlyApiError(err));
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
      eventConstruction: result.event_construction,
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
  const normalizedResult = result ? normalizeUploadResult(result) : undefined;
  const formalMetrics = result?.formal_polytree?.metrics;
  const uploadPureRows = result?.pure_ramex?.comparisonRows ?? [];
  const uploadBest = result?.pure_validation?.best_algorithm ?? pureRamexBest(result?.pure_ramex);
  const uploadStructuralType =
    result?.pure_validation?.structural_type ??
    pureRamexStructuralType(result ? uploadResultToValidationRow(result) : undefined, result?.pure_ramex);
  const uploadReportProblem = reportCompletenessError(result);
  const uploadReportData: ReportData | undefined = result && !uploadReportProblem
    ? {
        datasetName: result.filename || file?.name || result.job_id,
        datasetOrigin: "upload",
        analysisType: result.analysis_type ?? analysisType,
        datasetType,
        generatedAt: new Date().toLocaleString("pt-PT"),
        eventConstruction: result.event_construction ? {
          mode: result.event_construction.mode,
          caseColumn: result.event_construction.case_column,
          timeColumn: result.event_construction.time_column,
          caseWindow: result.event_construction.case_window,
          eventColumn: result.event_construction.event_column,
          eventColumns: result.event_construction.event_columns,
          ignoredColumns: result.event_construction.ignored_columns,
          numericDiscretization: result.event_construction.numeric_discretization,
          rules: result.event_construction.rules,
          generatedEventColumn: result.event_construction.generated_event_column,
          generatedCaseColumn: result.event_construction.generated_case_column,
          uniqueEvents: result.event_construction.unique_events,
          eventExamples: result.event_construction.event_examples,
          warnings: result.event_construction.warnings,
        } : {
          mode: eventMode,
          caseColumn,
          timeColumn,
          caseWindow,
          eventColumn,
          eventColumns: eventMode === "advanced" ? advancedEventColumns : [eventColumn].filter(Boolean),
          ignoredColumns: eventMode === "advanced" ? advancedEventColumns.filter((column) => numericDiscretization[column] === "ignore") : [],
          numericDiscretization,
          eventExamples: generatedEventPreview,
        },
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
        topTransitions: (normalizedResult?.observed.topTransitions ?? result.top_transitions).map(edgeToReport),
        allTransitions: normalizedResult?.observed.graphEdges.map(edgeToReport),
        transitionMatrix: result.transition_matrix,
        ramexEdges: (normalizedResult?.ramex2007.phase2.selectedEdges ?? result.ramex_edges).map((edge) => edgeToReport({
          From: String((edge as Record<string, unknown>).From ?? (edge as Record<string, unknown>).from ?? ""),
          To: String((edge as Record<string, unknown>).To ?? (edge as Record<string, unknown>).to ?? ""),
          Weight: readFirstNumber(edge as Record<string, unknown>, ["Weight", "weight"]),
          Level: readFirstNumber(edge as Record<string, unknown>, ["Level", "level"]),
        })),
        polytreeEdges: result.formal_polytree?.edges?.map(pureEdgeToReport),
        pureRamex: {
          bestAlgorithm: uploadBest,
          structuralType: uploadStructuralType,
          summary: result.pure_validation?.summary ?? pureRamexScientificSummary(undefined, result.pure_ramex),
          ramex2007Root: result.pure_ramex?.ramex2007?.root,
          ramex2007Edges: result.pure_ramex?.ramex2007?.edges?.map(pureEdgeToReport),
          ramex2007DominantPaths: result.pure_ramex?.ramex2007?.expansion?.dominant_paths?.map((path) => ({
            path: path.path,
            branchDepth: path.branch_depth,
            pathWeight: path.path_weight,
            bottleneckWeight: path.bottleneck_weight,
          })),
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
          executiveSummary: `${result.interpretation} A leitura separa camada observacional, RAMEX 2007 formal e RAMEX-Forum temporal quando executado.`,
          graphInterpretation: result.interpretation,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A camada experimental/histórica é apresentada como anexo e não substitui o RAMEX 2007 formal.",
          conclusion:
            "A análise mantém RAMEX 2007 formal e RAMEX-Forum temporal separados por semântica e artefactos.",
        },
        images: {
          graph: normalizedResult?.observed.graphImage,
          ramex: result.files.ramex_png ? `${API_BASE_URL}/api/file/${result.job_id}/${result.files.ramex_png}` : undefined,
          ramex2007: normalizedResult?.ramex2007.phase2.treeCompleteImage,
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
  const pureImageSrc = normalizedResult?.ramex2007.phase2.treeCompleteImage;
  const forumImageSrc = result && forumResult?.files?.graph_png
    ? `${API_BASE_URL}/api/ramex-forum/jobs/${result.job_id}/file/${forumResult.files.graph_png}`
    : undefined;
  const graphRelationRows: GraphRelationRow[] = (normalizedResult?.observed.graphEdges ?? result?.top_transitions ?? [])
    .slice(0, 24)
    .map((edge) => ({ from: edge.From, to: edge.To, weight: edge.Weight }));
  const pureRelationRows: GraphRelationRow[] = (normalizedResult?.ramex2007.phase2.selectedEdges ?? [])
    .map((edge) => edge as Record<string, unknown>)
    .map((edge) => ({
      from: String(edge.from ?? edge.From ?? ""),
      to: String(edge.to ?? edge.To ?? ""),
      weight: readFirstNumber(edge, ["weight", "Weight"]),
      mode: String(edge.direction ?? edge.Direction ?? ""),
    }));
  const forumRelationRows: GraphRelationRow[] = (normalizedResult?.forum.phase2?.selected_edges ?? normalizedResult?.forum.phase1?.influence_graph?.edges ?? [])
    .map((edge) => ({
      from: edge.From ?? "",
      to: edge.To ?? "",
      weight: edge.Weight,
      relativeWeight: edge.SmoothedWeight,
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
            {analysisType === "pure" ? "RAMEX 2007 / 2015" : analysisType === "forum" ? "Forum temporal" : "Análise completa"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Dataset" value={result?.filename || file?.name || "A Aguardar ficheiro"} note="Artefacto em análise" />
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
                  setPreviewRows([]);
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
                  // Sequências simples não suporta modo avançado — repor para simples
                  if (nextType === "simple_sequences") {
                    setEventMode("simple");
                  }
                  if (columns.length > 0) {
                    const mapping = inferColumnMapping(columns, nextType);
                    setCaseColumn(mapping.caseColumn);
                    setTimeColumn(mapping.timeColumn);
                    setEventColumn(mapping.eventColumn);
                    const advanced = inferAdvancedEventColumns(columns, mapping.caseColumn, mapping.timeColumn, mapping.eventColumn);
                    setAdvancedEventColumns(advanced.selected);
                    setNumericDiscretization(advanced.numericRules);
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
                <option value="pure">RAMEX 2007 / 2015</option>
                <option value="forum">RAMEX-Forum temporal</option>
                <option value="both">RAMEX 2007/2015 + RAMEX-Forum temporal</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                O RAMEX 2007 usa frequências absolutas e rooted branching. O RAMEX 2015 acrescenta Forward/Back-and-Forward para tree/poly-tree. O RAMEX-Forum usa influência temporal, latência, smoothing, filtros e extração estrutural própria.
              </p>
            </label>

            {analysisType !== "pure" ? (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                <h4 className="font-semibold text-ink">Controlos avançados RAMEX-Forum</h4>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Estes parâmetros aplicam-se apenas à Fase 2 sobre a rede temporal de influência. O modo auto escolhe Forward quando existe nó inicial conhecido ou inferível; caso contrário usa Back-and-Forward.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">initial_node</span>
                    <input
                      value={forumInitialNode}
                      onChange={(event) => setForumInitialNode(event.target.value)}
                      placeholder="opcional"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">force_heuristic</span>
                    <select
                      value={forumForceHeuristic}
                      onChange={(event) => setForumForceHeuristic(event.target.value as "auto" | "forward" | "back_and_forward")}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="auto">auto</option>
                      <option value="forward">forward</option>
                      <option value="back_and_forward">back_and_forward</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">forward_top_k</span>
                    <input
                      value={forumForwardTopK}
                      onChange={(event) => setForumForwardTopK(event.target.value)}
                      type="number"
                      min="1"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">max_depth</span>
                    <input
                      value={forumMaxDepth}
                      onChange={(event) => setForumMaxDepth(event.target.value)}
                      type="number"
                      min="1"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase text-slate-500">min_smoothed_weight</span>
                    <input
                      value={forumMinSmoothedWeight}
                      onChange={(event) => setForumMinSmoothedWeight(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="opcional"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {canMapColumns ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEventMode("simple")}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${eventMode === "simple" ? "bg-thesis text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                    >
                      Modo simples
                    </button>
                    <button
                      type="button"
                      disabled={!canMapColumns}
                      title={!canMapColumns ? "Modo avançado não disponível para Sequências simples" : undefined}
                      onClick={() => {
                        if (!canMapColumns) return;
                        setEventMode("advanced");
                        const inferred = inferAdvancedEventColumns(columns, caseColumn, timeColumn, eventColumn);
                        setAdvancedEventColumns(inferred.selected);
                        setNumericDiscretization((current) => ({ ...inferred.numericRules, ...current }));
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        !canMapColumns
                          ? "cursor-not-allowed border border-slate-200 bg-white text-slate-300"
                          : eventMode === "advanced"
                            ? "bg-thesis text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Modo avançado de eventos
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">
                    O RAMEX não analisa todas as variáveis tabulares diretamente. As variáveis selecionadas são
                    transformadas em eventos sequenciais discretos e depois são analisadas as transições entre eventos.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["Entidade/caso", caseColumn, setCaseColumn],
                    ["Tempo/ordem", timeColumn, setTimeColumn],
                    ["Evento/categoria", eventColumn, setEventColumn],
                  ].map(([label, value, setter]) => (
                    <label key={String(label)} className={`block ${eventMode === "advanced" && label === "Evento/categoria" ? "opacity-60" : ""}`}>
                      <span className="text-xs font-semibold uppercase text-slate-500">{String(label)}</span>
                      <select
                        value={String(value)}
                        onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                        disabled={eventMode === "advanced" && label === "Evento/categoria"}
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

                {eventMode === "advanced" ? (
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                    <h4 className="font-semibold text-ink">Construção avançada do evento</h4>
                    {advancedRecommendation.recommendation ? (
                      <p className="mt-2 text-xs leading-5 text-cyan-800">{advancedRecommendation.recommendation}</p>
                    ) : null}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase text-slate-500">Janela temporal para case_id</span>
                        <select
                          value={caseWindow}
                          onChange={(event) => setCaseWindow(event.target.value as CaseWindowMode)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="none">Usar Entidade/caso</option>
                          <option value="daily">Diária</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensal</option>
                          <option value="quarterly">Trimestral</option>
                        </select>
                      </label>
                      <div className="rounded-xl border border-cyan-100 bg-white/80 p-3 text-xs leading-5 text-slate-600">
                        Para datasets financeiros, uma janela mensal cria casos como W2024_01, permitindo analisar
                        relações entre vários ativos dentro da mesma janela temporal.
                      </div>
                    </div>

                    {structuralSelectedEventColumns.length ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        Esta coluna é usada para estruturar a sequência e normalmente não deve fazer parte do evento:
                        {" "}{structuralSelectedEventColumns.join(", ")}.
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {columns.map((column) => {
                        const selected = advancedEventColumns.includes(column);
                        const numeric = isNumericPreviewColumn(previewRows, column);
                        const structural = isStructuralEventColumn(column, caseColumn, timeColumn);
                        return (
                          <div key={column} className={`rounded-xl border bg-white p-3 ${structural && selected ? "border-amber-300" : "border-slate-200"}`}>
                            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  setAdvancedEventColumns((current) =>
                                    event.target.checked ? [...current, column] : current.filter((item) => item !== column),
                                  );
                                }}
                              />
                              {column}
                              {numeric ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">numérica</span> : null}
                              {structural ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">estrutural</span> : null}
                            </label>
                            {structural && selected ? (
                              <p className="mt-2 text-xs leading-5 text-amber-700">
                                Esta coluna é usada para estruturar a sequência e normalmente não deve fazer parte do evento.
                              </p>
                            ) : null}
                            {selected && numeric ? (
                              <select
                                value={numericDiscretization[column] ?? ""}
                                onChange={(event) => setNumericDiscretization((current) => ({
                                  ...current,
                                  [column]: event.target.value as NumericDiscretizationMode,
                                }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                              >
                                <option value="">Escolher discretização</option>
                                <option value="quantile">Quantis: LOW / MEDIUM / HIGH</option>
                                <option value="variation_pct">Variação %: STRONG_DOWN a STRONG_UP</option>
                                <option value="ignore">Ignorar coluna numérica</option>
                              </select>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Preview dos eventos gerados</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        Colunas usadas no evento: {advancedEventColumns.length ? advancedEventColumns.join(", ") : "nenhuma"}.
                        {" "}Eventos únicos no preview: {uniquePreviewCount}.
                        {" "}Exemplo final: {generatedEventPreview[0] ?? "sem exemplo"}.
                      </p>
                      {eventMode === "advanced" && advancedEventColumns.length > 0 && generatedEventPreview.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-amber-700">
                          As colunas selecionadas não produziram eventos no preview local. O upload pode avançar; se os valores
                          estiverem vazios ou as regras forem incompatíveis, o backend devolve erro específico.
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {generatedEventPreview.length ? generatedEventPreview.map((eventName, index) => (
                          <span key={`${eventName}-${index}`} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {eventName}
                          </span>
                        )) : <span className="text-sm text-slate-500">Sem preview disponível.</span>}
                      </div>
                      {uniquePreviewCount > 8 ? (
                        <p className="mt-2 text-xs text-amber-700">Número elevado de eventos únicos no preview. Considere discretizar ou reduzir colunas.</p>
                      ) : null}
                      {generatedEventPreviewRows.length ? (
                        <div className="mt-3 overflow-auto rounded-lg border border-slate-100">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                <th className="px-3 py-2">generated_event</th>
                                <th className="px-3 py-2">generated_case_id</th>
                                <th className="px-3 py-2">time/order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {generatedEventPreviewRows.slice(0, 5).map((row, index) => (
                                <tr key={`${row.generatedEvent}-${index}`} className="border-t border-slate-100">
                                  <td className="px-3 py-2 font-semibold text-ink">{row.generatedEvent}</td>
                                  <td className="px-3 py-2 text-slate-600">{row.generatedCaseId || "-"}</td>
                                  <td className="px-3 py-2 text-slate-600">{row.order || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
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
            <MetricCard label="Camada observacional" value={formatNumber(normalizedResult?.observed.totalWeight ?? 0)} note="peso total observado" />
          </div>

          <CoverageDiagnosticsPanel metrics={result.coverage_metrics} />
          {normalizedResult?.errors.length ? (
            <div className="space-y-2">
              {normalizedResult.errors.map((message) => <WarningPanel key={message}>{message}</WarningPanel>)}
            </div>
          ) : null}
          {normalizedResult?.warnings.length ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
              <p className="font-semibold">Avisos de consistência</p>
              <ul className="mt-2 list-disc pl-5">
                {normalizedResult.warnings.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <ReportButton onClick={handleDownloadUploadReport} />
            <ReportExportButton data={uploadReportData} disabled={!uploadReportData} />
          </div>
          {uploadReportProblem ? <WarningPanel>{uploadReportProblem}</WarningPanel> : null}

          {result.metrics.dense || result.graph_edges.length > 220 ? (
            <WarningPanel>
              Grafo denso: a visualização em rede pode ocultar ou sobrepor relações. Use Sankey ou filtros visuais para interpretar os fluxos principais.
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
              title="Camada observacional — grafo observado"
              subtitle="Rede dirigida ponderada construída a partir das transições observadas no dataset. O grafo observado representa as transições completas disponíveis para análise."
              imageSrc={graphImageSrc}
              nodes={normalizedResult?.observed.nodes}
              edges={normalizedResult?.observed.edges}
              mode="complete"
              legend="Grafo observado"
            >
              <GraphRelationsTable title="Transição" rows={graphRelationRows} mode="complete" />
            </GraphViewer>

            {result.analysis_type !== "forum" ? (
              <GraphViewer
                title="RAMEX 2007 formal — árvore técnica"
                subtitle={`Maximum Weight Rooted Branching sobre a rede formal RAMEX 2007. Não usa heurísticas históricas como fallback. Raiz: ${normalizedResult?.ramex2007.phase2.root ?? "indisponível"}.`}
                imageSrc={pureImageSrc}
                nodes={normalizedResult?.ramex2007.phase2.metrics?.selected_nodes}
                edges={normalizedResult?.ramex2007.phase2.metrics?.selected_edges}
                mode="pure"
                legend="RAMEX 2007"
              >
                <GraphRelationsTable
                  title="Aresta selecionada"
                  rows={pureRelationRows}
                  mode="pure"
                />
              </GraphViewer>
            ) : null}

            <SankeyPanel
              edges={normalizedResult?.observed.sankeyData ?? []}
              title="Sankey do grafo observado"
              description="Fluxos de transição construídos a partir das arestas disponíveis no resultado da análise."
            />

            {result.analysis_type === "both" || result.analysis_type === "forum" ? (
              <GraphViewer
                title="RAMEX-Forum temporal — Fase 2"
                subtitle="Estrutura de influência temporal extraída por Forward Tree ou Back-and-Forward Poly-tree sobre a rede da Fase 1."
                imageSrc={normalizedResult?.forum.phase2?.files?.phase2_structure_png ? forumFileUrl(result, normalizedResult.forum.phase2.files.phase2_structure_png) : forumImageSrc}
                nodes={normalizedResult?.forum.phase2?.metrics?.nodes_after}
                edges={normalizedResult?.forum.phase2?.metrics?.edges_after}
                mode="forum"
                legend="RAMEX-Forum temporal"
              >
                <GraphRelationsTable title="Influência selecionada" rows={forumRelationRows} mode="forum" />
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
  const [ramex2007ComparisonRows, setRamex2007ComparisonRows] = useState<Ramex2007DatasetComparisonRow[]>([]);
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
    const errs: string[] = [];

    async function loadData() {
      try {
        const validation = await loadCsv("validacao_comparativa.csv", validationMapper);
        if (mounted) setValidationRows(validation);
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Erro ao carregar validação comparativa.");
      }

      try {
        const rows = await Promise.all(
          (["01", "02", "03"] as DatasetId[]).map(async (id) => {
            const raw = await loadJson<PureRamexResult>(`ramex2007_dataset${id}.json`);
            return ramex2007DatasetComparisonRow(id, raw);
          }),
        );
        if (mounted) setRamex2007ComparisonRows(rows.filter(Boolean) as Ramex2007DatasetComparisonRow[]);
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Erro ao carregar comparação RAMEX 2007.");
      }

      try {
        const res = await fetch(dataPath("validacao_comparativa.txt"));
        if (res.ok && mounted) setExecutiveText(await res.text());
      } catch {
        errs.push("Não foi possível carregar o relatório TXT.");
      }

      if (mounted) setErrors(errs);
    }

    loadData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const errs: string[] = [];

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
        if (mounted) setMatrix(await loadMatrix(`matriz_adjacencia_dataset${datasetId}.csv`));
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Erro ao carregar matriz.");
      }

      try {
        if (mounted) setGraphEdges(await loadCsv(`grafo_edges_dataset${datasetId}.csv`, edgeMapper));
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Erro ao carregar grafo.");
      }

      try {
        if (mounted) setRamexEdges(await loadCsv(`ramex_dataset${datasetId}.csv`, edgeMapper));
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Erro ao carregar RAMEX.");
      }

      try {
        const poly = await loadJson<PolyTreeData>(`ramex_polytree_dataset${datasetId}.json`);
        if (mounted) {
          setPolytreeData(poly);
          setPolytreeViewStrategy(poly.strategy === "multiobjective" ? "multiobjective" : "top-k");
        }
      } catch {
        if (mounted) setPolytreeError("Poly-tree ainda não gerado para este dataset.");
      }

      try {
        if (mounted) setPolytreeRows(await loadCsv(`ramex_polytree_dataset${datasetId}.csv`, polytreeRowMapper));
      } catch {
        if (mounted) setPolytreeRows([]);
      }

      const pureMissing: string[] = [];
      let ramex2007: PureRamexResult | undefined;
      let forward: PureRamexResult | undefined;
      let backForward: PureRamexResult | undefined;
      let comparisonRows: PureRamexComparisonRow[] = [];

      try {
        const rawRamex2007 = await loadJson<PureRamexResult>(`ramex2007_dataset${datasetId}.json`);
        const normalized = normalizeRamex2007Result(rawRamex2007, {
          imageUrl: dataPath(`ramex2007_dataset${datasetId}.png`),
          csvUrl: dataPath(`ramex2007_dataset${datasetId}.csv`),
          jsonUrl: dataPath(`ramex2007_dataset${datasetId}.json`),
        });
        ramex2007 = {
          ...rawRamex2007,
          imageUrl: normalized?.imageUrl,
          csvUrl: normalized?.csvUrl,
          jsonUrl: normalized?.jsonUrl,
        };
      }
      catch { pureMissing.push(`ramex2007_dataset${datasetId}.json`); }

      try { forward = await loadJson<PureRamexResult>(`ramex_forward_dataset${datasetId}.json`); }
      catch { pureMissing.push(`ramex_forward_dataset${datasetId}.json`); }

      try { backForward = await loadJson<PureRamexResult>(`ramex_back_forward_dataset${datasetId}.json`); }
      catch { pureMissing.push(`ramex_back_forward_dataset${datasetId}.json`); }

      try { comparisonRows = await loadCsv(`validacao_ramex_puro_dataset${datasetId}.csv`, pureComparisonMapper); }
      catch { pureMissing.push(`validacao_ramex_puro_dataset${datasetId}.csv`); }

      const comparisonMarkdown = await loadOptionalText(`validacao_ramex_puro_dataset${datasetId}.md`);
      const multidatasetMarkdown = await loadOptionalText("validacao_ramex_multidataset.md");

      if (mounted) setPureRamexData({ ramex2007, forward, backForward, comparisonRows, comparisonMarkdown, multidatasetMarkdown, missing: pureMissing });

      try {
        const forum = await loadJson<RamexForumData>(`dataset${datasetId}/forum/ramex_forum_metrics.json`);
        if (mounted) setStaticForumData(forum);
      } catch {
        if (mounted) setStaticForumData(undefined);
      }

      if (mounted) setErrors(errs);
    }

    loadDatasetData();
    return () => { mounted = false; };
  }, [datasetId]);

  const selectedValidation = useMemo(
    () => validationRows.find((row) => datasetLabelToId(row.Dataset) === datasetId),
    [datasetId, validationRows],
  );

  const rootNode = useMemo(
    () => ramexEdges.find((e) => e.Level === 1)?.From ?? ramexEdges[0]?.From,
    [ramexEdges],
  );

  const denseGraph = selectedValidation
    ? selectedValidation.Arestas_Grafo > 220 || selectedValidation.Densidade_Aproximada > 0.15
    : graphEdges.length > 220;
  const staticTopTransitions = useMemo(
    () => [...graphEdges].sort((a, b) => b.Weight - a.Weight).slice(0, 10),
    [graphEdges],
  );

  const staticTransitionMatrix = undefined;

  function handleDownloadStaticReport() {
    const report = buildTechnicalReport({
      datasetName: datasets[datasetId].label,
      origin: "pré-carregado",
      datasetType: "dataset pré-carregado",
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

  const demoValidation = uploadedResult ? uploadResultToValidationRow(uploadedResult) : selectedValidation;

  const staticReportData: ReportData | undefined = selectedValidation
    ? {
        datasetName: datasets[datasetId].label,
        datasetOrigin: "preloaded",
        analysisType: "pure",
        datasetType: "dataset pré-carregado",
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
          ramex2007Root: pureRamexData?.ramex2007?.root,
          ramex2007Edges: pureRamexData?.ramex2007?.edges?.map(pureEdgeToReport),
          ramex2007DominantPaths: pureRamexData?.ramex2007?.expansion?.dominant_paths?.map((path) => ({
            path: path.path,
            branchDepth: path.branch_depth,
            pathWeight: path.path_weight,
            bottleneckWeight: path.bottleneck_weight,
          })),
          rows: pureRamexRowsForReport(pureRamexData),
        },
        interpretations: {
          executiveSummary: `${selectedValidation.Interpretacao} Inclui RAMEX 2007, RAMEX 2015 e validação Poly-tree.`,
          graphInterpretation: selectedValidation.Interpretacao,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A Poly-tree confirma aciclicidade e conectividade da saída RAMEX.",
          conclusion:
            "A análise usa RAMEX 2007, RAMEX 2015 e validação Poly-tree.",
        },
        images: {
          graph: dataPath(`grafo_dataset${datasetId}.png`),
          ramex: dataPath(`ramex_dataset${datasetId}.png`),
          ramex2007: dataPath(`ramex2007_dataset${datasetId}.png`),
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
          ramex2007Root: uploadedResult.pure_ramex?.ramex2007?.root,
          ramex2007Edges: uploadedResult.pure_ramex?.ramex2007?.edges?.map(pureEdgeToReport),
          ramex2007DominantPaths: uploadedResult.pure_ramex?.ramex2007?.expansion?.dominant_paths?.map((path) => ({
            path: path.path,
            branchDepth: path.branch_depth,
            pathWeight: path.path_weight,
            bottleneckWeight: path.bottleneck_weight,
          })),
          rows: pureRamexRowsForReport(uploadedResult.pure_ramex),
        },
        ramexForum: forumToReport(uploadedResult.ramex_forum ?? uploadedResult.forum, uploadedResult.job_id),
        interpretations: {
          executiveSummary: `${uploadedResult.interpretation} Inclui RAMEX 2007, RAMEX 2015 e validação Poly-tree.`,
          graphInterpretation: uploadedResult.interpretation,
          ramexInterpretation: "",
          polytreeInterpretation:
            "A Poly-tree confirma aciclicidade e conectividade da saída RAMEX.",
          conclusion:
            "A análise usa RAMEX 2007, RAMEX 2015 e validação Poly-tree.",
        },
        images: {
          graph: uploadedResult.files.graph_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.graph_png}`
            : undefined,
          ramex: uploadedResult.files.ramex_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.ramex_png}`
            : undefined,
          ramex2007: uploadedResult.files.ramex2007_png
            ? `${API_BASE_URL}/api/file/${uploadedResult.job_id}/${uploadedResult.files.ramex2007_png}`
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

  const modeBadge = viewId === "forum" ? "RAMEX-Forum temporal"
    : (viewId === "upload" && uploadedResult?.analysis_type === "both") ? "Análise completa"
    : "RAMEX 2007 / 2015";

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
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm leading-6 text-slate-600 shadow-panel">
                  O grafo observado representa as transições completas disponíveis para análise. Limitações indicadas neste ecrã são apenas visuais.
                </div>
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
                    alt={`RAMEX simplificado - heurística experimental do dataset ${datasetId}`}
                    className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain p-3 shadow-panel"
                  />
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                    <h3 className="text-lg font-semibold text-ink">RAMEX simplificado - heurística experimental</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Nó raiz destacado: <span className="font-semibold text-amberline">{rootNode ?? "indisponível"}</span>.
                      Esta fase histórica seleciona ligações dominantes por expansão greedy e não corresponde ao RAMEX 2007 formal. A cobertura é apresentada no Diagnóstico de Cobertura.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetricCard label="Nós no grafo" value={formatNumber(selectedValidation?.Nos_Grafo ?? 0)} />
                      <MetricCard label="Nós RAMEX" value={formatNumber(new Set(ramexEdges.flatMap((edge) => [edge.From, edge.To])).size)} />
                      <MetricCard label="Arestas no grafo" value={formatNumber(selectedValidation?.Arestas_Grafo ?? graphEdges.length)} />
                      <MetricCard label="Arestas RAMEX" value={formatNumber(ramexEdges.length)} />
                    </div>
                    <p className="mt-4 text-3xl font-semibold text-thesis">
                      {(selectedValidation?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%
                    </p>
                    <p className="text-sm text-slate-500">peso preservado face ao grafo da fase 06</p>
                  </div>
                </div>
              </section>
            ) : null}

            {viewId === "sankey" ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-slate-700 shadow-panel">
                  <p className="font-semibold uppercase tracking-[0.16em] text-amber-700">Visualização complementar</p>
                  <p className="mt-2">
                    O Sankey apresenta fluxos agregados entre eventos, produtos ou categorias. Ajuda a interpretar relações dominantes quando o grafo observado fica demasiado denso, mas não substitui o RAMEX 2007, o RAMEX 2015 nem o RAMEX-Forum temporal.
                  </p>
                </div>
                <SankeyPanel
                  edges={uploadedResult?.graph_edges ?? graphEdges}
                  title={uploadedResult ? "Sankey do grafo observado enviado" : `Sankey do ${datasets[datasetId].label}`}
                  description="Visualização complementar dos fluxos principais entre eventos. O limite escolhido é apenas visual e não altera os dados, os filtros nem o RAMEX."
                />
              </section>
            ) : null}

            {viewId === "polytree" ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-panel">
                  <h3 className="text-lg font-semibold text-ink">Leitura da Poly-tree</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    A estrutura RAMEX seleciona ligações dominantes e pode não cobrir todos os nós do grafo original. A cobertura é apresentada no Diagnóstico de Cobertura.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard label="Nós no grafo" value={formatNumber(uploadedResult?.metrics.nodes ?? selectedValidation?.Nos_Grafo ?? 0)} />
                    <MetricCard label="Nós na poly-tree" value={formatNumber(uploadedResult?.polytree?.metrics.polytree_nodes ?? polytreeData?.metrics.polytree_nodes ?? 0)} />
                    <MetricCard label="Arestas no grafo" value={formatNumber(uploadedResult?.metrics.edges ?? selectedValidation?.Arestas_Grafo ?? graphEdges.length)} />
                    <MetricCard label="Arestas na poly-tree" value={formatNumber(uploadedResult?.polytree?.metrics.polytree_edges ?? polytreeData?.metrics.polytree_edges ?? 0)} />
                    <MetricCard
                      label="Peso preservado"
                      value={`${(uploadedResult?.polytree?.metrics.preserved_weight_percent ?? polytreeData?.metrics.preserved_weight_percent ?? selectedValidation?.Percentagem_Peso_Preservado ?? 0).toFixed(2)}%`}
                    />
                  </div>
                </div>
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
                <PolyTreePanel
                  data={uploadedResult?.polytree ?? polytreeData}
                  rows={uploadedResult?.polytree_edges ?? polytreeRows}
                  error={polytreeError}
                />
              </section>
            ) : null}

            {viewId === "validation" ? (
              <section className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <ReportButton onClick={handleDownloadStaticReport} disabled={!selectedValidation} />
                  <ReportExportButton data={staticReportData} disabled={!staticReportData} />
                </div>
                <ValidationCharts rows={ramex2007ComparisonRows} />
                <ValidationTable rows={ramex2007ComparisonRows} />
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


