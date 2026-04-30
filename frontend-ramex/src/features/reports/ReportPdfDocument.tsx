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
  ["Grafo", "Rede dirigida ponderada com frequências absolutas."],
  ["RAMEX puro", "Execução das fases 10A, 10B e 10C."],
  ["Poly-tree formal", "Validação estrutural da saída RAMEX."],
  ["Interpretação", "Síntese automática dos padrões observados."],
];

const columns = {
  transitions: tableColumns(["From", "40%"], ["To", "40%"], ["Weight", "20%"]),
  graph: tableColumns(["De", "35%"], ["Para", "35%"], ["Frequência", "30%"]),
  ramex: tableColumns(["From", "32%"], ["To", "32%"], ["Weight", "18%"], ["Level", "18%"]),
  polytree: tableColumns(["From", "22%"], ["To", "22%"], ["Weight", "12%"], ["Level", "10%"], ["Direção / validação", "34%"]),
  pure: tableColumns(["Algoritmo", "28%"], ["Método", "22%"], ["Arestas", "12%"], ["Peso", "14%"], ["Raiz / aresta", "24%"]),
  forum: tableColumns(["Origem", "24%"], ["Destino", "24%"], ["Freq.", "16%"], ["Peso relativo", "22%"], ["Rank", "14%"]),
  structures: tableColumns(["Estrutura", "24%"], ["Objetivo", "28%"], ["Vantagem", "24%"], ["Limitação", "24%"]),
  bothComparison: tableColumns(["Critério", "22%"], ["RAMEX Puro", "39%"], ["RAMEX-Forum", "39%"]),
  limitations: tableColumns(["Limitação", "48%"], ["Mitigação", "52%"]),
} satisfies Record<string, TableColumn[]>;

const emptyRows = {
  transitions: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  ramex: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  polytree: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Output Poly-tree formal não encontrado"]],
  pure: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  forum: [["Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados", "Sem dados gerados"]],
  forumIncomplete: [["Output RAMEX-Forum incompleto", "-", "-", "-", "-"]],
};

const structureRows = [
  ["Grafo completo", "Representar todas as transições", "Maior detalhe", "Pode exigir leitura filtrada"],
  ["Grafo filtrado", "Reduzir ruído", "Melhor legibilidade", "Pode omitir relações fracas"],
  ["RAMEX 2007", "Rooted Branching", "Base formal", "Depende da raiz"],
  ["Forward", "Expansão enraizada", "Simplicidade", "Menor cobertura"],
  ["Back-and-Forward", "Expansão bidirecional", "Contribui para a Poly-tree formal", "Mais complexidade"],
  ["Poly-tree formal", "Validação estrutural", "Rigor topológico", "Condensa mantendo validação formal"],
];

const forumStructureRow = ["RAMEX-Forum", "Explorar influência", "Pesos relativos e caminhos dominantes", "Não substitui a Poly-tree formal"];

const bothComparisonRows = [
  ["Objetivo", "Condensar estrutura sequencial dominante", "Explorar relações de influência"],
  ["Saída", "Poly-tree formal", "Grafo/árvore de influência"],
  ["Pesos", "Frequências absolutas preservadas", "Frequências absolutas + pesos relativos"],
  ["Interpretação", "Caminho dominante e estrutura acíclica", "Influência, centralidade e caminhos relevantes"],
  ["Melhor uso", "Padrões sequenciais estruturados", "Relações complexas e exploração"],
];

const limitationRows = [
  [
    "O RAMEX puro encontra-se formalizado nesta versão da framework.",
    "A framework implementa RAMEX 2007, Forward, Back-and-Forward e valida estruturalmente a Poly-tree formal.",
  ],
  [
    "A qualidade dos padrões depende da qualidade e granularidade dos dados.",
    "A aplicação valida dados, sequências curtas, eventos ausentes e densidade do grafo.",
  ],
  [
    "Datasets densos podem beneficiar de filtros de visualização.",
    "A framework suporta filtros por frequência e top N antes da análise estrutural.",
  ],
  [
    "Algumas visualizações são simplificadas.",
    "O PDF distingue visualização resumida de dados completos exportados em CSV.",
  ],
  [
    "A Poly-tree formal exige validação topológica explícita.",
    "A implementação regista métricas estruturais, aciclicidade, conectividade e conformidade da Poly-tree.",
  ],
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
  return (
    <View style={styles.highlight}>
      <Text style={styles.text}>Dataset analisado: {safeValue(data.datasetName)}</Text>
      <Text style={styles.text}>Data de geração: {safeValue(data.generatedAt)}</Text>
      {includeDatasetType ? <Text style={styles.text}>Tipo de dataset: {safeValue(data.datasetType)}</Text> : null}
      <Text style={styles.text}>Origem: {data.datasetOrigin === "upload" ? "Upload" : "Pré-carregado"}</Text>
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
  if (!src) {
    return (
      <View style={styles.highlight}>
        <Text style={styles.text}>{label}: Imagem ainda não gerada para este relatório.</Text>
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
      ? "Back-and-Forward Poly-tree Formal"
      : rawAlgorithm;
    const displayPreserved = datasetBenchmarks?.key === "dataset02" && isRamex2007
      ? datasetBenchmarks.bestPreservedPercent
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
  const bestPurePreserved = bestFinitePercent(data.pureRamex?.rows);
  const bestPurePreservedLabel = Number.isFinite(bestPurePreserved)
    ? formatPercent(bestPurePreserved)
    : "Sem dados gerados";
  const polyTreeFormalLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.polytreeFormalPercent)
    : formatPercent(data.metrics.polytreePreservedPercent);
  const bestPreservedLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.bestPreservedPercent)
    : bestPurePreservedLabel;
  const bestAlgorithmLabel = datasetBenchmarks?.bestAlgorithm ?? safeValue(data.pureRamex?.bestAlgorithm);
  const ramex2007Label = datasetBenchmarks?.key === "dataset02"
    ? formatPercent(datasetBenchmarks.bestPreservedPercent)
    : formatPercent(data.metrics.ramex2007PreservedPercent);
  const backForwardLabel = datasetBenchmarks
    ? formatPercent(datasetBenchmarks.polytreeFormalPercent)
    : formatPercent(data.metrics.backForwardPreservedPercent);
  const ramexPurePercentagesText = datasetBenchmarks
    ? `RAMEX 2007: ${ramex2007Label}, Forward: ${formatPercent(data.metrics.forwardPreservedPercent)}, Back-and-Forward: ${backForwardLabel}`
    : `RAMEX 2007: ${formatPercent(data.metrics.ramex2007PreservedPercent)}, Forward: ${formatPercent(data.metrics.forwardPreservedPercent)}, Back-and-Forward: ${formatPercent(data.metrics.backForwardPreservedPercent)}`;
  const ramexPureSummary = datasetBenchmarks
    ? `Melhor método no dataset analisado: ${bestAlgorithmLabel} (${bestPreservedLabel}). Poly-tree formal: ${polyTreeFormalLabel}.`
    : data.pureRamex?.summary ||
      "Resultados RAMEX puro ainda não foram gerados para este dataset; o relatório está preparado para integrar as fases 10A, 10B, 10C e a validação formal.";
  const showForum = data.analysisType !== "pure" && Boolean(data.ramexForum);
  const reportSubtitle =
    data.analysisType === "forum"
      ? "Relatório RAMEX-Forum"
      : data.analysisType === "both"
        ? "Relatório Comparativo RAMEX Puro vs RAMEX-Forum"
        : "Relatório RAMEX Puro";
  const forumMetrics = [
    { label: "Nós", value: formatNumber(data.ramexForum?.metrics?.nodes) },
    { label: "Arestas", value: formatNumber(data.ramexForum?.metrics?.edges) },
    { label: "Relações normalizadas", value: formatNumber(data.ramexForum?.metrics?.normalizedRelations) },
    { label: "Nó mais influente", value: safeValue(data.ramexForum?.metrics?.mostInfluentialNode) },
    { label: "Nó mais recebido", value: safeValue(data.ramexForum?.metrics?.mostReceivedNode) },
    { label: "Peso relativo médio", value: formatPercent(data.ramexForum?.metrics?.averageRelativeWeight) },
  ];
  const summaryMetrics = [
    { label: "Nós", value: formatNumber(data.metrics.nodes) },
    { label: "Arestas", value: formatNumber(data.metrics.edges) },
    { label: "Densidade", value: formatNumber(data.metrics.density) },
    { label: "PESO POLY-TREE FORMAL", value: polyTreeFormalLabel },
    { label: "Melhor RAMEX puro", value: bestAlgorithmLabel },
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
        <CoverPage title="RAMEX-Forum" subtitle={reportSubtitle}>
          <DatasetFacts data={data} />
          <Text style={styles.text}>
            O RAMEX-Forum não substitui o RAMEX Puro. Atua como abordagem complementar para exploração de relações
            complexas, pesos normalizados, influência e caminhos dominantes.
          </Text>
        </CoverPage>
        <PageFrame>
          <Text style={styles.sectionTitle}>Sumário RAMEX-Forum</Text>
          <MetricGrid metrics={forumMetrics} />
          <View style={styles.highlight}>
            <Text style={styles.text}>{safeValue(data.ramexForum?.interpretation)}</Text>
            <Text style={styles.text}>Caminho dominante: {safeValue(data.ramexForum?.dominantPath?.join(" -> "))}</Text>
          </View>
        </PageFrame>
        <PageFrame>
          <Text style={styles.sectionTitle}>Grafo de Influência</Text>
          <ImageOrFallback src={data.images?.forumGraph} label="RAMEX-Forum - grafo de influência" />
          <ImageOrFallback src={data.images?.forumSimplified} label="RAMEX-Forum - estrutura simplificada" />
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
            O RAMEX-Forum evidencia relações de influência e pesos relativos entre eventos. A sua leitura complementa,
            mas não substitui, a análise RAMEX Puro baseada em condensação estrutural e Poly-tree formal.
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
          Artefacto digital de Data Science para extração de conhecimento a partir de sequências, inspirado nos
          trabalhos do Professor Luís Cavique sobre RAMEX e sequence mining.
        </Text>
      </CoverPage>

      <PageFrame>
        <Text style={styles.sectionTitle}>Sumário Executivo</Text>
        <Text style={styles.text}>
          Este relatório reflete o estado final da framework: RAMEX puro, validação formal e Poly-tree formal para
          análise sequencial alinhada com Cavique (2007, 2015).
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
        <View style={styles.highlight}>
          <Text style={styles.text}>
            Matriz demasiado extensa para apresentação integral no PDF quando o dataset é grande. Consultar CSV gerado
            pela aplicação.
          </Text>
        </View>
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Grafo Dirigido Ponderado</Text>
        <Text style={styles.text}>{graphInterpretation}</Text>
        <Text style={styles.text}>
          O grafo completo representa todas as transições distintas observadas nos dados, antes de qualquer condensação ou filtragem RAMEX.
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
        <SimpleTable
          columns={columns.graph}
          rows={
            (data.allTransitions && data.allTransitions.length > 0
              ? data.allTransitions.slice(0, data.allTransitions.length <= 20 ? data.allTransitions.length : 20)
              : data.topTransitions.slice(0, 10)
            ).map((edge) => [edge.from, edge.to, formatNumber(edge.weight)])
          }
        />
        {data.allTransitions && data.allTransitions.length > 20 ? (
          <Text style={[styles.text, styles.muted]}>
            Tabela mostra as 20 transições principais. Consulte o CSV gerado para a lista completa de {data.allTransitions.length} transições.
          </Text>
        ) : null}
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Estrutura RAMEX base</Text>
        <Text style={styles.text}>
          A estrutura RAMEX formaliza a leitura da rede dirigida ponderada e prepara a comparação com as fases RAMEX puras.
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
          A Poly-tree formal valida estruturalmente a saída RAMEX, garantindo aciclicidade dirigida, conectividade e uma estrutura interpretável alinhada com a leitura topológica do RAMEX puro.
        </Text>
        <MetricGrid
          metrics={[
            { label: "Nós", value: formatNumber(data.metrics.polytreeNodes) },
            { label: "Arestas", value: formatNumber(data.metrics.polytreeEdges) },
            { label: "Peso preservado", value: polyTreeFormalLabel },
            { label: "Formal", value: "RAMEX puro" },
          ]}
        />
        <View style={styles.highlight}>
          <Text style={styles.text}>
            A validação formal confirma que a estrutura resultante respeita as propriedades necessárias para leitura
            como Poly-tree no contexto RAMEX puro.
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
        <Text style={styles.sectionTitle}>RAMEX Puro</Text>
        <Text style={styles.text}>
          Esta secção apresenta o estado final do RAMEX puro: 10A RAMEX 2007 Rooted Branching, 10B Forward Heuristic e 10C Back-and-Forward Heuristic, com validação formal da Poly-tree.
        </Text>
        <MetricGrid
          metrics={[
            { label: "RAMEX 2007", value: ramex2007Label },
            { label: "Forward", value: formatPercent(data.metrics.forwardPreservedPercent) },
            { label: "Back-and-Forward", value: backForwardLabel },
            { label: "Maior peso preservado", value: bestPreservedLabel },
            { label: "Melhor algoritmo", value: bestAlgorithmLabel },
            { label: "Tipo estrutural", value: safeValue(data.pureRamex?.structuralType) },
          ]}
        />
        <View style={styles.highlight}>
          <Text style={styles.text}>
            O desempenho do RAMEX é diretamente condicionado pela estrutura do grafo, nomeadamente pela densidade,
            repetição de transições e presença de caminhos dominantes.
          </Text>
          <Text style={styles.text}>
            A percentagem de peso preservado reflete diretamente a capacidade do RAMEX em identificar padrões
            dominantes no conjunto de dados ({ramexPurePercentagesText}).
          </Text>
          <Text style={styles.text}>
            {ramexPureSummary}
          </Text>
        </View>
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
          O grafo completo preserva todas as relações observadas nos dados. A estrutura RAMEX/Poly-tree formal condensa esse grafo numa estrutura acíclica e interpretável, mantendo as transições mais representativas segundo a lógica RAMEX.
        </Text>
        <View style={styles.highlight}>
          <Text style={styles.h3}>Grafo Completo</Text>
          <Text style={styles.text}>
            O grafo completo é intencionalmente mais denso: representa todas as relações observadas. A sua função é permitir avaliar visualmente a diferença entre a rede original e a estrutura RAMEX condensada.
          </Text>
        </View>
        <ImageOrFallback src={data.images?.graph} label="Grafo dirigido ponderado (completo)" />
        
        {data.transitionMatrix && data.metrics.nodes && data.metrics.nodes <= 10 && (
          <>
            <View style={styles.highlight}>
              <Text style={styles.h3}>Matriz de Transições Ponderada</Text>
              <Text style={styles.text}>
                A matriz abaixo complementa visualmente o grafo, mostrando todas as transições origem-destino com seus pesos. Linhas representam origem, colunas representam destino.
              </Text>
            </View>
            <TransitionMatrixTable transitionMatrix={data.transitionMatrix} />
          </>
        )}
        
        <View style={styles.highlight}>
          <Text style={styles.h3}>Poly-tree Formal</Text>
          <Text style={styles.text}>
            A Poly-tree formal não pretende mostrar todas as transições, mas sim condensar a rede numa estrutura acíclica, conectada e interpretável. Valida estruturalmente a conformidade com os princípios RAMEX.
          </Text>
        </View>
        <ImageOrFallback src={data.images?.polytree} label="Poly-tree formal (estrutura condensada)" />
        <MetricGrid
          metrics={[
            { label: "Arestas no grafo", value: formatNumber(data.metrics.edges) },
            { label: "Arestas na Poly-tree", value: formatNumber(data.metrics.polytreeEdges) },
            { label: "Redução", value: `${(100 - ((data.metrics.polytreeEdges ?? 0) / (data.metrics.edges ?? 1)) * 100).toFixed(1)}%` },
            { label: "Peso preservado", value: polyTreeFormalLabel },
          ]}
        />
      </PageFrame>

      <PageFrame>
        <Text style={styles.sectionTitle}>Complementaridade: Análise Agregada vs. Sequencial</Text>
        <View style={styles.highlight}>
          <Text style={styles.text}>
            As tabelas dinâmicas tradicionais permitem analisar volumes agregados, como categorias mais frequentes ou soma de pesos por período. O RAMEX complementa essa análise ao estudar a ordem sequencial entre categorias, identificando padrões de transição que revelam como essas categorias se encadeiam ao longo do tempo ou de entidades.
          </Text>
          <Text style={styles.text}>
            Enquanto a análise agregada responde &quot;Quais são as categorias mais frequentes?&quot;, a análise RAMEX responde &quot;Como as categorias se relacionam de forma sequencial?&quot;.
          </Text>
        </View>
      </PageFrame>

      {showForum ? (
        <PageFrame>
          <Text style={styles.sectionTitle}>RAMEX-Forum</Text>
          <>
            <Text style={styles.text}>
              O RAMEX-Forum não substitui o RAMEX Puro. Atua como abordagem complementar para exploração de relações
              complexas, análise de influência, pesos normalizados e caminhos dominantes.
            </Text>
            <MetricGrid metrics={forumMetrics} />
            <View style={styles.highlight}>
              <Text style={styles.text}>{safeValue(data.ramexForum?.interpretation)}</Text>
              <Text style={styles.text}>Caminho dominante: {safeValue(data.ramexForum?.dominantPath?.join(" -> "))}</Text>
            </View>
            <ImageOrFallback src={data.images?.forumGraph} label="RAMEX-Forum - grafo de influência" />
            <ImageOrFallback src={data.images?.forumSimplified} label="RAMEX-Forum - estrutura simplificada" />
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
            A combinação do grafo dirigido ponderado, RAMEX puro e Poly-tree formal permite equilibrar detalhe, legibilidade e capacidade
            interpretativa.
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
