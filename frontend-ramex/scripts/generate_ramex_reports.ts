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

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildReportData(datasetId: "01" | "02" | "03", rows: PureRow[]): ReportData {
  const row10A = rows.find((row) => row.Fase === "10A") ?? {};
  const row10B = rows.find((row) => row.Fase === "10B") ?? {};
  const row10C = rows.find((row) => row.Fase === "10C") ?? {};

  const nodes = numberOrZero(row10A["Nos originais"]);
  const edges = numberOrZero(row10A["Arestas originais"]);
  const totalWeight = numberOrZero(row10A["Soma pesos originais"]);
  const density = nodes > 1 ? edges / (nodes * (nodes - 1)) : 0;

  return {
    datasetName: `Dataset ${datasetId}`,
    datasetOrigin: "preloaded",
    datasetType: "dataset pré-carregado",
    generatedAt: new Date().toLocaleString("pt-PT"),
    metrics: {
      nodes,
      edges,
      density,
      totalWeight,
      ramexEdges: numberOrZero(row10B["Arestas selecionadas"]),
      ramexWeight: numberOrZero(row10B["Soma pesos selecionados"]),
      ramexPreservedPercent: numberOrZero(row10B["Peso preservado (%)"]),
      polytreeNodes: numberOrZero(row10C["Nos selecionados"]),
      polytreeEdges: numberOrZero(row10C["Arestas selecionadas"]),
      polytreeWeight: numberOrZero(row10C["Soma pesos selecionados"]),
      polytreePreservedPercent: numberOrZero(row10C["Peso preservado (%)"]),
      ramex2007PreservedPercent: numberOrZero(row10A["Peso preservado (%)"]),
      forwardPreservedPercent: numberOrZero(row10B["Peso preservado (%)"]),
      backForwardPreservedPercent: numberOrZero(row10C["Peso preservado (%)"]),
    },
    topTransitions: [],
    ramexEdges: [],
    polytreeEdges: [],
    pureRamex: {
      bestAlgorithm: "",
      structuralType: "",
      summary: "",
      rows: rows.map((row) => ({
        algorithm: row.Algoritmo ?? "Sem dados gerados",
        method: row.Metodo,
        selectedEdges: numberOrZero(row["Arestas selecionadas"]),
        preservedWeightPercent: numberOrZero(row["Peso preservado (%)"]),
        anchor: row["Raiz ou aresta inicial"],
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
    const validation = await loadJson<{ rows: PureRow[] }>(
      path.join(baseDir, `validacao_ramex_puro_dataset${datasetId}.json`),
    );

    const data = buildReportData(datasetId, validation.rows ?? []);
    const document = React.createElement(ReportPdfDocument, { data });
    const buffer = await pdf(document as any).toBuffer();
    const outPath = path.join(outDir, `relatorio_ramex_dataset${datasetId}.pdf`);
    await writeFile(outPath, buffer);
    console.log(`PDF gerado: ${outPath}`);
  }
}

main().catch((error) => {
  console.error("Falha ao gerar PDFs:", error);
  process.exit(1);
});
