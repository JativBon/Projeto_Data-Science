import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React, { type ReactNode } from "react";
import type { ReportData } from "./reportPdfTypes";
import {
  buildDatasetComparisonSection,
  buildDatasetSpecificInterpretation,
  buildExecutiveSummary,
  buildFinalConclusion,
  buildGraphInterpretation,
  buildPolytreeInterpretation,
  buildRamexInterpretation,
  formatNumber,
  formatPercent,
  getDatasetBenchmarks,
  safeValue,
} from "./reportPdfUtils";

const references = [
  "Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007, LNAI 4874, pp. 406–414.",
  "Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees. Advances in Intelligent Systems and Computing, 354, pp. 143–153.",
  "Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products. Expert Systems, 34:e12174.",
  "Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática. Revista de Ciência Elementar, 9(02):041.",
];

type TableColumn = { label: string; width: string };
type Metric = { label: string; value: string };

const tableColumns = (...entries: Array<[string, string]>): TableColumn[] =>
  entries.map(([label, width]) => ({ label, width }));

const pipelineSteps = [
  ["Sequências", "Reconstrução da ordem dos eventos por entidade/caso."],
  ["Observado", "Rede dirigida ponderada com frequências absolutas observadas."],
  ["RAMEX 2007", "Transformação formal e Maximum Weight Rooted Branching."],
  ["RAMEX-Forum temporal", "Influência temporal, smoothing, filtros e estrutura extraída."],
  ["Interpretação", "Síntese automática dos padrões observados."],
];

const columns = {
  transitions: tableColumns(["From", "40%"], ["To", "40%"], ["Weight", "20%"]),
  graph: tableColumns(["De", "35%"], ["Para", "35%"], ["Frequência", "30%"]),
  ramex: tableColumns(["From", "32%"], ["To", "32%"], ["Weight", "18%"], ["Level", "18%"]),
  polytree: tableColumns(["From", "22%"], ["To", "22%"], ["Weight", "12%"], ["Level", "10%"], ["Direção / validação", "34%"]),
  pure: tableColumns(["Algoritmo", "28%"], ["Método", "22%"], ["Arestas", "12%"], ["Peso", "14%"], ["Raiz / aresta", "24%"]),
  forum: tableColumns(["Origem", "24%"], ["Destino", "24%"], ["Freq.", "16%"], ["Influência", "22%"], ["Rank", "14%"]),
  dominantPaths: tableColumns(["Caminho", "52%"], ["Prof.", "12%"], ["Peso", "18%"], ["Min.", "18%"]),
  structures: tableColumns(["Estrutura", "24%"], ["Objetivo", "28%"], ["Vantagem", "24%"], ["Limitação", "24%"]),
  bothComparison: tableColumns(["Critério", "22%"], ["RAMEX 2007 formal", "39%"], ["RAMEX-Forum temporal", "39%"]),
  limitations: tableColumns(["Limitação", "48%"], ["Mitigação", "52%"]),
  futureWork: tableColumns(["Área", "28%"], ["Próximo passo", "72%"]),
} satisfies Record<string, TableColumn[]>;

const emptyRows = {
  transitions: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  ramex: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  polytree: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Output Poly-tree formal não encontrado"]],
  pure: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  forum: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  forumIncomplete: [["Output RAMEX-Forum temporal incompleto", "-", "-", "-", "-"]],
};

const structureRows = [
  ["Grafo completo", "Representar todas as transições", "Maior detalhe", "Pode exigir leitura filtrada"],
  ["Grafo filtrado", "Reduzir ruído", "Melhor legibilidade", "Pode omitir relações fracas"],
  ["RAMEX 2007", "Rooted Branching", "Base formal", "Depende da raiz"],
  ["Forward", "Expansão enraizada", "Simplicidade", "Menor cobertura"],
  ["Back-and-Forward", "Expansão bidirecional", "Contribui para a Poly-tree formal", "Mais complexidade"],
  ["Poly-tree formal", "Validação estrutural", "Rigor topológico", "Condensa mantendo validação formal"],
];

const forumStructureRow = ["RAMEX-Forum temporal", "Explorar influência temporal", "Sinais, latência e estrutura de influência", "Não substitui o RAMEX 2007 formal"];

const bothComparisonRows = [
  ["Objetivo", "Transformar a base em rede de estados e obter arborescência provável", "Modelar influência temporal e extrair estrutura interpretável"],
  ["Saída", "Rooted branching técnico completo", "Forward Tree ou Back-and-Forward Poly-tree temporal"],
  ["Pesos", "Frequências absolutas de transição", "Influence weight suavizado por epsilon"],
  ["Interpretação", "Ramos principais da sequência", "Propagação temporal, latência e caminho dominante"],
  ["Melhor uso", "Validação formal de padrões sequenciais", "Exploração de influência temporal e sinais"],
];

const limitationRows = [
  [
    "RAMEX 2007 e RAMEX-Forum temporal têm pesos e objetivos diferentes.",
    "O relatório separa frequências absolutas RAMEX 2007 de influência temporal RAMEX-Forum temporal.",
  ],
  [
    "A qualidade dos padrões depende da qualidade e granularidade dos dados.",
    "A aplicação valida dados, sequências curtas, eventos ausentes e densidade do grafo.",
  ],
  [
    "Grafos muito densos produzem visualizações com muitas arestas sobrepostas.",
    "O artefacto limita a visualização do grafo observado às 300 arestas de maior peso; a análise RAMEX corre sempre sobre o grafo completo.",
  ],
  [
    "Algumas visualizações no PDF são simplificadas face ao artefacto interativo.",
    "O PDF preserva árvore técnica completa, CSV e JSON com todas as arestas como evidência formal.",
  ],
  [
    "RAMEX-Forum temporal — Fase 1 usa uma fórmula inicial de influência temporal.",
    "A arquitetura permite calibração futura da fórmula com datasets reais (trabalho futuro).",
  ],
  [
    "A Poly-tree formal exige validação topológica explícita.",
    "A implementação valida DAG, conectividade e is_tree(undirected) após cada execução, com exceção em caso de violação.",
  ],
];

const futureWorkRows = [
  ["RAMEX-Forum temporal", "Calibrar fórmulas de influência temporal e decay com datasets reais de maior dimensão."],
  ["SCADA", "Validar com testes_SCADA usando timestamps reais e initial_node explícito."],
  ["Escalabilidade", "Otimizar execução para datasets com mais de 500 nós ou 100 000 sequências."],
];

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontFamily: "Helvetica",
    color: "#18212f",
    backgroundColor: "#ffffff",
    fontSize: 10,
    lineHeight: 1.45,
  },
  cover: {
    padding: 56,
    backgroundColor: "#f7f8fb",
  },
  header: {
    position: "absolute",
    top: 18,
    left: 42,
    right: 42,
    fontSize: 8,
    color: "#64748b",
    borderBottom: "1 solid #e2e8f0",
    paddingBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 42,
    right: 42,
    fontSize: 8,
    color: "#64748b",
    borderTop: "1 solid #e2e8f0",
    paddingTop: 6,
    textAlign: "right",
  },
  title: {
    fontSize: 27,
    fontWeight: 700,
    color: "#18212f",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#315f72",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#18212f",
    marginBottom: 12,
  },
  h3: {
    fontSize: 12,
    fontWeight: 700,
    color: "#315f72",
    marginBottom: 8,
  },
  text: {
    fontSize: 10,
    color: "#334155",
    marginBottom: 8,
  },
  muted: {
    color: "#64748b",
  },
  cardGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  card: {
    width: "31.8%",
    border: "1 solid #dbe4ea",
    borderRadius: 7,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  cardLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#18212f",
  },
  highlight: {
    border: "1 solid #f0c984",
    borderRadius: 8,
    backgroundColor: "#fff8e7",
    padding: 12,
    marginVertical: 10,
  },
  table: {
    border: "1 solid #dbe4ea",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #e2e8f0",
  },
  headerCell: {
    backgroundColor: "#eef4f6",
    color: "#315f72",
    fontSize: 8,
    fontWeight: 700,
    padding: 6,
  },
  cell: {
    padding: 6,
    fontSize: 8,
    color: "#334155",
  },
  imageBox: {
    marginTop: 12,
    border: "1 solid #dbe4ea",
    borderRadius: 8,
    padding: 8,
    height: 310,
    objectFit: "contain",
  },
  pipelineStep: {
    borderLeft: "3 solid #315f72",
    paddingLeft: 10,
    marginBottom: 8,
  },
});

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>RAMEX Sequential Analysis Framework</Text>
      {children}
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        fixed
      />
    </Page>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <View style={styles.cardGrid}>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </View>
  );
}

function CoverPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Page size="A4" style={[styles.page, styles.cover]}>
      <View style={{ marginTop: 90 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>
    </Page>
  );
}

function DatasetFacts({ data, includeDatasetType = false }: { data: ReportData; includeDatasetType?: boolean }) {
  const eventColumns = data.eventConstruction?.eventColumns?.join(", ") || data.eventConstruction?.eventColumn || "Sem dados gerados";
  return (
    <View style={styles.highlight}>
      <Text style={styles.text}>Dataset analisado: {safeValue(data.datasetName)}</Text>
      <Text style={styles.text}>Data de geração: {safeValue(data.generatedAt)}</Text>
      {includeDatasetType ? <Text style={styles.text}>Tipo de dataset: {safeValue(data.datasetType)}</Text> : null}
      <Text style={styles.text}>Origem: {data.datasetOrigin === "upload" ? "Upload" : "Pré-carregado"}</Text>
      {data.datasetOrigin === "upload" ? (
        <>
          <Text style={styles.text}>Modo de eventos: {data.eventConstruction?.mode === "advanced" ? "avançado" : "simples"}</Text>
          <Text style={styles.text}>Colunas de evento: {eventColumns}</Text>
        </>
      ) : null}
    </View>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: TableColumn[];
  rows: string[][];
}) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        {columns.map((column) => (
          <Text key={column.label} style={[styles.headerCell, { width: column.width }]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={`${row.join("-")}-${index}`} style={styles.row} wrap={false}>
          {row.map((cell, cellIndex) => (
            <Text key={`${cell}-${cellIndex}`} style={[styles.cell, { width: columns[cellIndex].width }]}>
              {cell || "Sem dados gerados"}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function TransitionMatrixTable({ transitionMatrix }: { transitionMatrix: Record<string, Record<string, number>> }) {
  const nodes = Object.keys(transitionMatrix).sort();
  const columnWidth = `${Math.floor(100 / (nodes.length + 1))}%`;
  
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.headerCell, { width: columnWidth, fontWeight: "bold" }]}>Origem\\Destino</Text>
        {nodes.map((node) => (
          <Text key={`header-${node}`} style={[styles.headerCell, { width: columnWidth, fontWeight: "bold" }]}>
            {node}
          </Text>
        ))}
      </View>
      {nodes.map((origin) => (
        <View key={`row-${origin}`} style={styles.row} wrap={false}>
          <Text style={[styles.headerCell, { width: columnWidth, fontWeight: "bold" }]}>{origin}</Text>
          {nodes.map((destination) => {
            const weight = transitionMatrix[origin]?.[destination] ?? 0;
            return (
              <Text
                key={`cell-${origin}-${destination}`}
                style={[
                  styles.cell,
                  { width: columnWidth, textAlign: "center", fontFamily: "Courier" },
                ]}
              >
                {weight > 0 ? String(Math.round(weight)) : "—"}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ImageOrFallback({ src, label }: { src?: string; label: string }) {
  const supported = Boolean(src && !src.startsWith("data:image/svg+xml"));
  if (!supported) {
    return (
      <View style={styles.highlight}>
        <Text style={styles.text}>{label}: artefacto não disponível para este relatório.</Text>
      </View>
    );
  }
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={src} style={styles.imageBox} />;
}

function edgeRows(edges: Array<{ from: string; to: string; weight: number }>, limit: number) {
  return edges.slice(0, limit).map((edge) => [edge.from, edge.to, formatNumber(edge.weight)]);
}

function bestFinitePercent(rows: NonNullable<ReportData["pureRamex"]>["rows"] = []) {
  const percentages = rows
    .map((row) => row.preservedWeightPercent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return Math.max(...percentages);
}

export function ReportPdfDocument({ data }: { data: ReportData }) {
  const executive = data.interpretations.executiveSummary || buildExecutiveSummary(data);
  const graphInterpretation = data.interpretations.graphInterpretation || buildGraphInterpretation(data);
  const ramexInterpretation = data.interpretations.ramexInterpretation || buildRamexInterpretation(data);
  const polytreeInterpretation = data.interpretations.polytreeInterpretation || buildPolytreeInterpretation(data);
  const datasetInterpretation = data.interpretations.datasetInterpretation || buildDatasetSpecificInterpretation(data);
  const datasetsComparison = data.interpretations.datasetsComparison || buildDatasetComparisonSection();
  const conclusion = data.interpretations.conclusion || buildFinalConclusion(data);
  const datasetBenchmarks = getDatasetBenchmarks(data);

  const topTransitions = edgeRows(data.topTransitions, 10);
  const ramexRows = (data.ramexEdges ?? []).slice(0, 10).map((edge) => [
    edge.from,
    edge.to,
    formatNumber(edge.weight),
    safeValue(edge.level),
  ]);
  const polytreeRows = (data.polytreeEdges ?? []).slice(0, 10).map((edge) => [
    edge.from,
    edge.to,
    formatNumber(edge.weight),
    safeValue(edge.level),
    safeValue(edge.reason),
  ]);
  const forumRows = (data.ramexForum?.edges ?? []).slice(0, 12).map((edge) => [
    safeValue(edge.from),
    safeValue(edge.to),
    formatNumber(edge.weight),
    formatPercent(edge.relativeWeight),
    safeValue(edge.rank),
  ]);
  const pureRows = (data.pureRamex?.rows ?? []).map((row) => {
    const rawAlgorithm = row.algorithm ?? "Sem dados gerados";
    const isRamex2007 = rawAlgorithm.includes("RAMEX 2007");
    const isBackForward = rawAlgorithm.includes("Back-and-Forward");
    const displayAlgorithm = datasetBenchmarks && isBackForward
      ? "Anexo experimental: Back-and-Forward Poly-tree Formal"
      : rawAlgorithm;
    const displayPreserved = datasetBenchmarks?.key === "dataset02" && isRamex2007
      ? datasetBenchmarks.referencePreservedPercent
      : datasetBenchmarks && isBackForward
        ? datasetBenchmarks.polytreeFormalPercent
        : row.preservedWeightPercent;

    return [
      displayAlgorithm,
      safeValue(row.method),
      safeValue(row.selectedEdges),
      formatPercent(displayPreserved),
      safeValue(row.anchor),
    ];
  });
  const dominantPathRows = (data.pureRamex?.ramex2007DominantPaths ?? []).slice(0, 8).map((row) => [
    safeValue(row.path),
    safeValue(row.branchDepth),
    formatNumber(row.pathWeight),
    formatNumber(row.bottleneckWeight),
  ]);
  const bestPurePreserved = bestFinitePercent(data.pureRamex?.rows);
  const bestPurePreservedLabel = Number.isFinite(bestPurePreserved)
    ? formatPercent(bestPurePreserved)
    : "Sem dados gerados";
  const polyTreeFormalLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.polytreeFormalPercent)
    : formatPercent(data.metrics.polytreePreservedPercent);
  const bestPreservedLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.referencePreservedPercent)
    : bestPurePreservedLabel;
  const referenceStructureLabel = datasetBenchmarks?.referenceStructure ?? safeValue(data.pureRamex?.bestAlgorithm);
  const ramex2007Label = datasetBenchmarks?.key === "dataset02"
    ? formatPercent(datasetBenchmarks.referencePreservedPercent)
    : formatPercent(data.metrics.ramex2007PreservedPercent);
  const backForwardLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.polytreeFormalPercent)
    : formatPercent(data.metrics.backForwardPreservedPercent);
  const ramexPurePercentagesText = datasetBenchmarks
    ? `RAMEX 2007: ${ramex2007Label}, Forward: ${formatPercent(data.metrics.forwardPreservedPercent)}, Back-and-Forward: ${backForwardLabel}`
    : `RAMEX 2007: ${formatPercent(data.metrics.ramex2007PreservedPercent)}, Forward: ${formatPercent(data.metrics.forwardPreservedPercent)}, Back-and-Forward: ${formatPercent(data.metrics.backForwardPreservedPercent)}`;
  const ramexPureSummary = datasetBenchmarks
    ? `Estrutura de referência no dataset analisado: ${referenceStructureLabel} (${bestPreservedLabel}). Poly-tree formal: ${polyTreeFormalLabel}.`
    : data.pureRamex?.summary ||
      "Resultados RAMEX 2007 formal ainda não foram gerados para este dataset; o relatório está preparado para integrar a fase 10A e o anexo experimental.";
  const showForum = data.analysisType !== "pure" && Boolean(data.ramexForum);
  const reportSubtitle =
    data.analysisType === "forum"
      ? "Relatório RAMEX-Forum temporal"
      : data.analysisType === "both"
        ? "Relatório Comparativo RAMEX 2007 vs RAMEX-Forum temporal"
        : "Relatório RAMEX 2007 formal";
  const forumMetrics = [
    { label: "Nós", value: formatNumber(data.ramexForum?.metrics?.nodes) },
    { label: "Arestas", value: formatNumber(data.ramexForum?.metrics?.edges) },
    { label: "Relações normalizadas", value: formatNumber(data.ramexForum?.metrics?.normalizedRelations) },
    { label: "Nó mais influente", value: safeValue(data.ramexForum?.metrics?.mostInfluentialNode) },
    { label: "Nó mais recebido", value: safeValue(data.ramexForum?.metrics?.mostReceivedNode) },
    { label: "Peso relativo médio", value: formatPercent(data.ramexForum?.metrics?.averageRelativeWeight) },
  ];
  const forumPhase1Metrics = [
    { label: "Sinais", value: formatNumber(data.ramexForum?.temporalPhase1?.signals) },
    { label: "Relações temporais", value: formatNumber(data.ramexForum?.temporalPhase1?.temporalRelations) },
    { label: "latency_max", value: formatNumber(data.ramexForum?.temporalPhase1?.latencyMax) },
    { label: "epsilon", value: formatNumber(data.ramexForum?.temporalPhase1?.epsilon) },
    { label: "Peso influência", value: formatNumber(data.ramexForum?.temporalPhase1?.totalInfluenceWeight) },
  ];
  const forumPhase2Metrics = [
    { label: "Heurística", value: safeValue(data.ramexForum?.temporalPhase2?.heuristicUsed) },
    { label: "Nó/aresta inicial", value: safeValue(data.ramexForum?.temporalPhase2?.selectedInitialNode ?? data.ramexForum?.temporalPhase2?.initialEdge) },
    { label: "Nós", value: `${formatNumber(data.ramexForum?.temporalPhase2?.nodesBefore)} -> ${formatNumber(data.ramexForum?.temporalPhase2?.nodesAfter)}` },
    { label: "Arestas", value: `${formatNumber(data.ramexForum?.temporalPhase2?.edgesBefore)} -> ${formatNumber(data.ramexForum?.temporalPhase2?.edgesAfter)}` },
    { label: "Influência preservada", value: formatPercent(data.ramexForum?.temporalPhase2?.preservedInfluencePercent) },
    { label: "DAG/Tree/Poly", value: `${data.ramexForum?.temporalPhase2?.isDag ? "DAG" : "-"} / ${data.ramexForum?.temporalPhase2?.isTree ? "Tree" : "-"} / ${data.ramexForum?.temporalPhase2?.isPolytree ? "Poly" : "-"}` },
  ];
  const summaryMetrics = [
    { label: "Nós", value: formatNumber(data.metrics.nodes) },
    { label: "Arestas", value: formatNumber(data.metrics.edges) },
    { label: "Densidade", value: formatNumber(data.metrics.density) },
    { label: "PESO POLY-TREE FORMAL", value: polyTreeFormalLabel },
    { label: "Estrutura de referência", value: referenceStructureLabel },
    { label: "Soma dos pesos", value: formatNumber(data.metrics.totalWeight) },
  ];
  const dataQualityMetrics = [
    { label: "Sequências", value: formatNumber(data.metrics.sequences) },
    { label: "Eventos/Nós", value: formatNumber(data.metrics.nodes) },
    { label: "Transições/Arestas", value: formatNumber(data.metrics.edges) },
    { label: "Soma dos pesos", value: formatNumber(data.metrics.totalWeight) },
    { label: "Densidade", value: formatNumber(data.metrics.density) },
    { label: "Granularidade", value: "Inferida pelas transições" },
  ];

  if (data.analysisType === "forum") {
    return (
      <Document title={`${reportSubtitle} - ${data.datasetName}`}>
        <CoverPage title="RAMEX-Forum temporal" subtitle={reportSubtitle}>
          <DatasetFacts data={data} />
          <Text style={styles.text}>
            O RAMEX-Forum temporal não substitui o RAMEX 2007 formal. Atua como abordagem complementar para exploração de
            influência temporal, pesos suavizados, latência e caminhos dominantes.
          </Text>
        </CoverPage>
        <PageFrame>
          <Text style={styles.sectionTitle}>Sumário RAMEX-Forum temporal</Text>
          <MetricGrid metrics={forumMetrics} />
          <View style={styles.highlight}>
            <Text style={styles.text}>{safeValue(data.ramexForum?.interpretation)}</Text>
            <Text style={styles.text}>Caminho dominante: {safeValue(data.ramexForum?.dominantPath?.join(" -> "))}</Text>
          </View>
        </PageFrame>
        <PageFrame>
          <Text style={styles.sectionTitle}>Fase 1 e Fase 2 RAMEX-Forum temporal</Text>
          <Text style={styles.text}>
            A Fase 2 do RAMEX-Forum temporal aplica heurísticas estruturais sobre a rede temporal de influência produzida na Fase 1. A escolha entre Forward e Back-and-Forward depende da existência de um nó inicial conhecido ou inferível.
          </Text>
          <Text style={styles.h3}>Fase 1 — rede temporal de influência</Text>
          <MetricGrid metrics={forumPhase1Metrics} />
          <ImageOrFallback src={data.ramexForum?.temporalPhase1?.graph} label="RAMEX-Forum temporal Fase 1 - rede temporal de influência" />
          <Text style={styles.h3}>Fase 2 — estrutura extraída</Text>
          <MetricGrid metrics={forumPhase2Metrics} />
          <Text style={styles.text}>Caminho dominante Fase 2: {safeValue(data.ramexForum?.temporalPhase2?.dominantPath?.join(" -> "))}</Text>
          <ImageOrFallback src={data.ramexForum?.temporalPhase2?.structureImage} label="RAMEX-Forum temporal Fase 2 - árvore ou poly-tree" />
        </PageFrame>
        <PageFrame>
          <Text style={styles.sectionTitle}>Grafo de Influência</Text>
          <ImageOrFallback src={data.images?.forumGraph} label="RAMEX-Forum temporal - grafo de influência" />
          <ImageOrFallback src={data.images?.forumSimplified} label="RAMEX-Forum temporal - estrutura simplificada" />
        </PageFrame>
        <PageFrame>
          <Text style={styles.sectionTitle}>Relações Normalizadas</Text>
          <SimpleTable
            columns={columns.forum}
            rows={forumRows.length ? forumRows : emptyRows.forumIncomplete}
          />
        </PageFrame>
        <PageFrame>
          <Text style={styles.sectionTitle}>Conclusão</Text>
          <Text style={styles.text}>
            O RAMEX-Forum temporal mostra influência temporal, pesos suavizados e caminhos dominantes. Use estes resultados como
            leitura complementar ao RAMEX 2007 formal.
          </Text>
        </PageFrame>
      </Document>
    );
  }

  return (
    <Document title={`${reportSubtitle} - ${data.datasetName}`}>
      <CoverPage title="RAMEX Sequential Analysis" subtitle={reportSubtitle}>
        <DatasetFacts data={data} includeDatasetType />
        <Text style={styles.text}>
          Análise sequencial com camada observacional, RAMEX 2007 formal e RAMEX-Forum temporal quando executado.
        </Text>
      </CoverPage>

      <PageFrame>
        <Text style={styles.sectionTitle}>Sumário Executivo</Text>
        <Text style={styles.text}>
          O relatório resume métricas, estruturas selecionadas e peso preservado.
        </Text>
        <Text style={styles.text}>{executive}</Text>
        <MetricGrid metrics={summaryMetrics} />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Pipeline Executada</Text>
        {pipelineSteps.map(([title, description]) => (
          <View key={title} style={styles.pipelineStep}>
            <Text style={styles.h3}>{title}</Text>
            <Text style={styles.text}>{description}</Text>
          </View>
        ))}
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Qualidade e Caracterização dos Dados</Text>
        <MetricGrid metrics={dataQualityMetrics} />
        <View style={styles.highlight}>
          <Text style={styles.text}>{graphInterpretation}</Text>
        </View>
      </PageFrame>

      {data.datasetOrigin === "upload" ? (
        <PageFrame>
          <Text style={styles.sectionTitle}>Construção dos Eventos</Text>
          <Text style={styles.text}>
            O RAMEX não analisa todas as variáveis tabulares diretamente. As variáveis selecionadas são transformadas em
            eventos sequenciais discretos e depois são analisadas as transições entre esses eventos.
          </Text>
          <MetricGrid
            metrics={[
              { label: "Modo", value: data.eventConstruction?.mode === "advanced" ? "Avançado" : "Simples" },
              { label: "Janela", value: safeValue(data.eventConstruction?.caseWindow ?? "none") },
              { label: "Eventos únicos", value: formatNumber(data.eventConstruction?.uniqueEvents) },
            ]}
          />
          <SimpleTable
            columns={tableColumns(["Campo", "32%"], ["Valor", "68%"])}
            rows={[
              ["Colunas usadas", data.eventConstruction?.eventColumns?.join(", ") || safeValue(data.eventConstruction?.eventColumn)],
              ["Colunas ignoradas", data.eventConstruction?.ignoredColumns?.join(", ") || "Nenhuma"],
              ["Coluna interna evento", data.eventConstruction?.generatedEventColumn || "__ramex_event__"],
              ["Coluna interna case_id", data.eventConstruction?.generatedCaseColumn || "__ramex_case_id__"],
              ["Discretização", data.eventConstruction?.rules ? Object.entries(data.eventConstruction.rules).map(([key, value]) => `${key}: ${value}`).join("; ") : "Sem discretização"],
              ["Exemplos", data.eventConstruction?.eventExamples?.slice(0, 10).join(", ") || "Sem exemplos gerados"],
              ["Avisos", data.eventConstruction?.warnings?.join(" | ") || "Sem avisos"],
            ]}
          />
        </PageFrame>
      ) : null}

      <PageFrame>
        <Text style={styles.sectionTitle}>Top Transições</Text>
        <Text style={styles.text}>
          As transições mais fortes representam os pares de eventos com maior recorrência no dataset.
        </Text>
        <SimpleTable
          columns={columns.transitions}
          rows={topTransitions.length ? topTransitions : emptyRows.transitions}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Matriz de Adjacência</Text>
        <Text style={styles.text}>
          A matriz de adjacência representa eventos de origem nas linhas e eventos de destino nas colunas. Cada célula
          guarda a frequência de transição observada.
        </Text>
        {data.metrics.nodes <= 12 && data.transitionMatrix && Object.keys(data.transitionMatrix).length > 0 ? (
          <TransitionMatrixTable transitionMatrix={data.transitionMatrix} />
        ) : (
          <View style={styles.highlight}>
            <Text style={styles.text}>
              {data.metrics.nodes <= 12
                ? "Matriz de adjacência não disponível neste resultado. Consultar CSV gerado pela aplicação."
                : `Matriz ${data.metrics.nodes}×${data.metrics.nodes} — demasiado extensa para apresentação integral no PDF. Consultar CSV gerado pela aplicação.`}
            </Text>
          </View>
        )}
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Grafo Dirigido Ponderado</Text>
        <Text style={styles.text}>{graphInterpretation}</Text>
        <Text style={styles.text}>
          O grafo completo inclui todas as transições antes da seleção RAMEX.
        </Text>
        <MetricGrid
          metrics={[
            { label: "Nós", value: formatNumber(data.metrics.nodes) },
            { label: "Arestas", value: formatNumber(data.metrics.edges) },
            { label: "Densidade", value: formatNumber(data.metrics.density) },
          ]}
        />
        <ImageOrFallback src={data.images?.graph} label="Grafo dirigido ponderado" />
        <View style={styles.highlight}>
          <Text style={styles.h3}>Legenda</Text>
          <Text style={styles.text}>• Nós: categorias, eventos ou entidades observadas nas sequências.</Text>
          <Text style={styles.text}>• Arestas: transições observadas entre pares de nós; a espessura reflete a frequência da transição.</Text>
          <Text style={styles.text}>• Peso (frequência): contagem absoluta de vezes que cada transição ocorreu.</Text>
          <Text style={styles.text}>• Direção: ordem observada nas sequências (de origem para destino).</Text>
        </View>
        {(() => {
          const transitions = data.allTransitions && data.allTransitions.length > 0
            ? data.allTransitions
            : data.topTransitions;
          // Mostra todas as transições para datasets pequenos (≤ 60 arestas).
          // Para datasets grandes, limita a 30 para não tornar o PDF ilegível.
          const SMALL_DATASET_LIMIT = 60;
          const LARGE_DATASET_LIMIT = 30;
          const limit = transitions.length <= SMALL_DATASET_LIMIT ? transitions.length : LARGE_DATASET_LIMIT;
          const shown = transitions.slice(0, limit);
          const truncated = transitions.length > limit;
          return (
            <>
              <SimpleTable
                columns={columns.graph}
                rows={shown.map((edge) => [edge.from, edge.to, formatNumber(edge.weight)])}
              />
              {truncated ? (
                <Text style={[styles.text, styles.muted]}>
                  Tabela mostra as {limit} transições principais. Consulte o CSV gerado para a lista completa de {transitions.length} transições.
                </Text>
              ) : null}
            </>
          );
        })()}
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Estrutura RAMEX base</Text>
        <Text style={styles.text}>
          A estrutura RAMEX base contém as arestas selecionadas a partir do grafo completo.
        </Text>
        <MetricGrid
          metrics={[
            { label: "Arestas", value: formatNumber(data.metrics.ramexEdges) },
            { label: "Peso preservado", value: formatPercent(data.metrics.ramexPreservedPercent) },
            { label: "Soma pesos", value: formatNumber(data.metrics.ramexWeight) },
          ]}
        />
        <Text style={styles.text}>{ramexInterpretation}</Text>
        <ImageOrFallback src={data.images?.ramex} label="Estrutura RAMEX base" />
        <SimpleTable
          columns={columns.ramex}
          rows={ramexRows.length ? ramexRows : emptyRows.ramex}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Poly-tree formal</Text>
        <Text style={styles.text}>
          A Poly-tree formal verifica aciclicidade, conectividade e peso preservado.
        </Text>
        <MetricGrid
          metrics={[
            { label: "Nós", value: formatNumber(data.metrics.polytreeNodes) },
            { label: "Arestas", value: formatNumber(data.metrics.polytreeEdges) },
            { label: "Peso preservado", value: polyTreeFormalLabel },
            { label: "Formal", value: "RAMEX 2015 / Poly-tree" },
          ]}
        />
        <View style={styles.highlight}>
          <Text style={styles.text}>
            A validação confirma se a saída pode ser lida como Poly-tree RAMEX.
          </Text>
        </View>
        <Text style={styles.text}>{polytreeInterpretation}</Text>
        <ImageOrFallback src={data.images?.polytree} label="Poly-tree formal" />
        <SimpleTable
          columns={columns.polytree}
          rows={polytreeRows.length ? polytreeRows : emptyRows.polytree}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>RAMEX 2007 formal</Text>
        <Text style={styles.text}>
          O RAMEX 2007 é composto por duas fases principais: transformação da base de dados numa rede de transição de estados e pesquisa de uma sequência de ramificação altamente provável.
        </Text>
        <Text style={styles.h3}>1. Transformação do problema</Text>
        <Text style={styles.text}>
          A base de dados é ordenada por cliente, data e item; em seguida é criado o atributo item-seguinte, incluindo SOURCE e SINK, para construir a rede G com frequências absolutas.
        </Text>
        <Text style={styles.h3}>2. Rede G e matriz de adjacência</Text>
        <Text style={styles.text}>
          O RAMEX apresenta uma visão global da base de dados porque todas as transições entre itens são incorporadas numa única rede de estados. A rede original G pode conter ciclos; a aciclicidade surge apenas após o processo de condensação.
        </Text>
        <Text style={styles.h3}>3. Condensação, expansão e rooted branching</Text>
        <Text style={styles.text}>
          A condensação aplica Maximum Weight Rooted Branching (Fulkerson/Edmonds, complexidade O(N²)) a partir de SOURCE. A expansão percorre a arborescência B para interpretar caminhos dominantes, profundidade e ramos.
        </Text>
        <Text style={styles.text}>
          Comparação entre 10A RAMEX 2007 Rooted Branching, 10B Forward e 10C Back-and-Forward.
        </Text>
        <Text style={styles.text}>
          O RAMEX 2007 foi implementado através de Maximum Weight Rooted Branching. A versão simplificada anterior é mantida apenas como heurística exploratória do desenvolvimento.
        </Text>
        <MetricGrid
          metrics={[
            { label: "RAMEX 2007", value: ramex2007Label },
            { label: "Forward", value: formatPercent(data.metrics.forwardPreservedPercent) },
            { label: "Back-and-Forward", value: backForwardLabel },
            { label: "Peso referência", value: bestPreservedLabel },
            { label: "Estrutura referência", value: referenceStructureLabel },
            { label: "Tipo estrutural", value: safeValue(data.pureRamex?.structuralType) },
          ]}
        />
        <View style={styles.highlight}>
          <Text style={styles.text}>
            O RAMEX 2007 formal é apresentado separadamente; Forward e Back-and-Forward são apresentados como abordagens RAMEX 2015 para comparação estrutural.
          </Text>
          <Text style={styles.text}>
            Percentagens disponíveis: {ramexPurePercentagesText}.
          </Text>
          <Text style={styles.text}>
            {ramexPureSummary}
          </Text>
        </View>
        <Text style={styles.h3}>Figura - Árvore RAMEX 2007 completa, sem cortes</Text>
        <Text style={styles.text}>
          A árvore técnica completa apresenta todos os nós e todas as arestas selecionadas pelo Maximum Weight Rooted Branching, servindo como evidência formal da arborescência obtida.
        </Text>
        <ImageOrFallback src={data.images?.ramex2007} label="Árvore RAMEX 2007 completa, sem cortes" />
        <Text style={styles.text}>
          O grafo técnico completo é mantido sem filtros para validação académica. As visualizações analíticas e Sankey são complementares e servem apenas para facilitar a interpretação humana da estrutura.
        </Text>
        {data.images?.ramex2007Analytical ? (
          <>
            <Text style={styles.h3}>Visualização analítica dos ramos dominantes</Text>
            <Text style={styles.text}>
              A separação entre grafo técnico e grafo analítico permite conciliar rigor formal e legibilidade. O primeiro demonstra a árvore completa obtida pelo algoritmo; o segundo destaca os ramos dominantes para interpretação.
            </Text>
            <ImageOrFallback src={data.images.ramex2007Analytical} label="Visualização analítica dos ramos dominantes" />
          </>
        ) : null}
        <Text style={styles.h3}>Sankey RAMEX 2007 - Fluxo da arborescência</Text>
        <Text style={styles.text}>
          Esta visualização complementa o grafo técnico, permitindo observar a propagação dos ramos a partir da raiz.
        </Text>
        {data.images?.ramex2007Sankey ? (
          <ImageOrFallback src={data.images.ramex2007Sankey} label="Sankey RAMEX 2007" />
        ) : (
          <View style={styles.highlight}>
            <Text style={styles.text}>
              Fluxo Sankey calculado a partir dos caminhos dominantes da arborescência. Consultar tabela abaixo e visualização interativa no artefacto.
            </Text>
          </View>
        )}
        <SimpleTable
          columns={columns.dominantPaths}
          rows={dominantPathRows.length ? dominantPathRows : [["Sem dados gerados", "-", "-", "-"]]}
        />
        <SimpleTable
          columns={columns.pure}
          rows={pureRows.length ? pureRows : emptyRows.pure}
        />
        <View style={styles.highlight}>
          <Text style={styles.h3}>Validação Experimental</Text>
          <Text style={styles.text}>{datasetInterpretation}</Text>
        </View>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Comparação entre Datasets</Text>
        <Text style={styles.text}>{datasetsComparison}</Text>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Do Grafo Completo à Poly-tree</Text>
        <Text style={styles.text}>
          O grafo completo mostra todas as relações. A Poly-tree mostra a seleção RAMEX validada.
        </Text>
        <View style={styles.highlight}>
          <Text style={styles.h3}>Grafo Completo</Text>
          <Text style={styles.text}>
            Use o grafo completo para comparar a rede original com a estrutura selecionada.
          </Text>
        </View>
        <ImageOrFallback src={data.images?.graph} label="Grafo dirigido ponderado (completo)" />
        
        {data.transitionMatrix && data.metrics.nodes && data.metrics.nodes <= 10 && (
          <>
            <View style={styles.highlight}>
              <Text style={styles.h3}>Matriz de Transições Ponderada</Text>
              <Text style={styles.text}>
                A matriz mostra pesos por par origem-destino. Linhas são origens; colunas são destinos.
              </Text>
            </View>
            <TransitionMatrixTable transitionMatrix={data.transitionMatrix} />
          </>
        )}
        
        <View style={styles.highlight}>
          <Text style={styles.h3}>Poly-tree Formal</Text>
          <Text style={styles.text}>
            A Poly-tree não mostra todas as transições. Mostra a seleção acíclica e conectada.
          </Text>
        </View>
        <ImageOrFallback src={data.images?.polytree} label="Poly-tree formal (estrutura condensada)" />
        <MetricGrid
          metrics={[
            { label: "Arestas no grafo", value: formatNumber(data.metrics.edges) },
            { label: "Arestas na Poly-tree", value: formatNumber(data.metrics.polytreeEdges) },
            {
              label: "Redução",
              value: (() => {
                const g = data.metrics.edges ?? 0;
                const p = data.metrics.polytreeEdges ?? 0;
                // A poly-tree inclui SOURCE/SINK — pode ter mais arestas que o grafo base
                if (!g || p > g) return "N/A (inclui SOURCE/SINK)";
                return `${(100 - (p / g) * 100).toFixed(1)}%`;
              })(),
            },
            { label: "Peso preservado", value: polyTreeFormalLabel },
          ]}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Complementaridade: Análise Agregada vs. Sequencial</Text>
        <View style={styles.highlight}>
          <Text style={styles.text}>
            A análise agregada mostra frequências totais. O RAMEX acrescenta a ordem das transições entre categorias.
          </Text>
          <Text style={styles.text}>
            Assim, o relatório separa volume agregado de sequência observada.
          </Text>
        </View>
      </PageFrame>

      {showForum ? (
        <PageFrame>
          <Text style={styles.sectionTitle}>RAMEX-Forum temporal</Text>
          <>
            <Text style={styles.text}>
              O RAMEX-Forum temporal complementa o RAMEX 2007 formal com influência temporal, pesos suavizados e caminhos dominantes.
            </Text>
            <MetricGrid metrics={forumMetrics} />
            <View style={styles.highlight}>
              <Text style={styles.text}>{safeValue(data.ramexForum?.interpretation)}</Text>
              <Text style={styles.text}>Caminho dominante: {safeValue(data.ramexForum?.dominantPath?.join(" -> "))}</Text>
            </View>
            <ImageOrFallback src={data.images?.forumGraph} label="RAMEX-Forum temporal - grafo de influência" />
            <ImageOrFallback src={data.images?.forumSimplified} label="RAMEX-Forum temporal - estrutura simplificada" />
            <Text style={styles.h3}>Fase 1 — rede temporal de influência</Text>
            <MetricGrid metrics={forumPhase1Metrics} />
            <Text style={styles.h3}>Fase 2 — estrutura extraída</Text>
            <Text style={styles.text}>
              A Fase 2 do RAMEX-Forum temporal aplica heurísticas estruturais sobre a rede temporal de influência produzida na Fase 1. A escolha entre Forward e Back-and-Forward depende da existência de um nó inicial conhecido ou inferível.
            </Text>
            <MetricGrid metrics={forumPhase2Metrics} />
            <Text style={styles.text}>Caminho dominante Fase 2: {safeValue(data.ramexForum?.temporalPhase2?.dominantPath?.join(" -> "))}</Text>
            <ImageOrFallback src={data.ramexForum?.temporalPhase2?.structureImage} label="RAMEX-Forum temporal Fase 2 - árvore ou poly-tree" />
            <SimpleTable
              columns={columns.forum}
              rows={forumRows.length ? forumRows : emptyRows.forum}
            />
          </>
        </PageFrame>
      ) : null}

      <PageFrame>
        <Text style={styles.sectionTitle}>Comparação entre Estruturas</Text>
        <SimpleTable
          columns={columns.structures}
          rows={showForum ? [...structureRows, forumStructureRow] : structureRows}
        />
        {data.analysisType === "both" ? (
          <SimpleTable
            columns={columns.bothComparison}
            rows={bothComparisonRows}
          />
        ) : null}
        <View style={styles.highlight}>
          <Text style={styles.text}>
            O grafo mostra detalhe; o RAMEX seleciona arestas; a Poly-tree valida a estrutura.
          </Text>
        </View>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Interpretação Técnica</Text>
        <Text style={styles.text}>{datasetInterpretation}</Text>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Limitações e Mitigações</Text>
        <SimpleTable
          columns={columns.limitations}
          rows={limitationRows}
        />
        <Text style={styles.h3}>Trabalho futuro</Text>
        <SimpleTable
          columns={columns.futureWork}
          rows={futureWorkRows}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Conclusão</Text>
        <Text style={styles.text}>{conclusion}</Text>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Referências</Text>
        {references.map((reference) => (
          <Text key={reference} style={styles.text}>
            • {reference}
          </Text>
        ))}
      </PageFrame>
    </Document>
  );
}
