import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { ReportPdfDocument } from "../src/features/reports/ReportPdfDocument";
import type { ReportData } from "../src/features/reports/reportPdfTypes";

type PureRow = {
  Fase?: string;
  Algoritmo?: string;
  Metodo?: string;
  "Arestas selecionadas"?: number;
  "Peso preservado (%)"?: number;
  "Raiz ou aresta inicial"?: string;
  "Nos originais"?: number;
  "Arestas originais"?: number;
  "Soma pesos originais"?: number;
  "Soma pesos selecionados"?: number;
  "Nos selecionados"?: number;
};

const toNum = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

function buildReportData(datasetId: "01" | "02" | "03", rows: PureRow[]): ReportData {
  const byPhase = (fase: string) => rows.find((r) => r.Fase === fase) ?? {};
  const r10A = byPhase("10A");
  const r10B = byPhase("10B");
  const r10C = byPhase("10C");

  const nodes = toNum(r10A["Nos originais"]);
  const edges = toNum(r10A["Arestas originais"]);

  return {
    datasetName: `Dataset ${datasetId}`,
    datasetOrigin: "preloaded",
    datasetType: "dataset pré-carregado",
    generatedAt: new Date().toLocaleString("pt-PT"),
    metrics: {
      nodes,
      edges,
      density: nodes > 1 ? edges / (nodes * (nodes - 1)) : 0,
      totalWeight: toNum(r10A["Soma pesos originais"]),
      ramexEdges: toNum(r10B["Arestas selecionadas"]),
      ramexWeight: toNum(r10B["Soma pesos selecionados"]),
      ramexPreservedPercent: toNum(r10B["Peso preservado (%)"]),
      polytreeNodes: toNum(r10C["Nos selecionados"]),
      polytreeEdges: toNum(r10C["Arestas selecionadas"]),
      polytreeWeight: toNum(r10C["Soma pesos selecionados"]),
      polytreePreservedPercent: toNum(r10C["Peso preservado (%)"]),
      ramex2007PreservedPercent: toNum(r10A["Peso preservado (%)"]),
      forwardPreservedPercent: toNum(r10B["Peso preservado (%)"]),
      backForwardPreservedPercent: toNum(r10C["Peso preservado (%)"]),
    },
    topTransitions: [],
    ramexEdges: [],
    polytreeEdges: [],
    pureRamex: {
      bestAlgorithm: "",
      structuralType: "",
      summary: "",
      rows: rows.map((r) => ({
        algorithm: r.Algoritmo ?? "Sem dados gerados",
        method: r.Metodo,
        selectedEdges: toNum(r["Arestas selecionadas"]),
        preservedWeightPercent: toNum(r["Peso preservado (%)"]),
        anchor: r["Raiz ou aresta inicial"],
      })),
    },
    interpretations: {
      executiveSummary: "",
      graphInterpretation: "",
      ramexInterpretation: "",
      polytreeInterpretation: "",
      conclusion: "",
    },
    images: {},
  };
}

async function main(): Promise<void> {
  const baseDir = path.resolve(process.cwd(), "public", "data");
  const outDir = path.resolve(process.cwd(), "generated-reports");
  await mkdir(outDir, { recursive: true });

  for (const datasetId of ["01", "02", "03"] as const) {
    const { rows = [] } = await loadJson<{ rows: PureRow[] }>(
      path.join(baseDir, `validacao_ramex_puro_dataset${datasetId}.json`),
    );
    const reportData = buildReportData(datasetId, rows);
    const buffer = await pdf(React.createElement(ReportPdfDocument, { data: reportData }) as any).toBuffer();
    const outPath = path.join(outDir, `relatorio_ramex_dataset${datasetId}.pdf`);
    await writeFile(outPath, buffer);
    console.log(`PDF gerado: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Falha ao gerar PDFs:", err);
  process.exit(1);
});