"use client";

import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { useState } from "react";
import { ReportPdfDocument } from "./ReportPdfDocument";
import type { ReportData } from "./reportPdfTypes";
import { prepareReportImages, safeReportFilename } from "./reportPdfUtils";

export function ReportExportButton({
  data,
  disabled,
  label = "Exportar relatório (PDF)",
}: {
  data?: ReportData;
  disabled?: boolean;
  label?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const isDisabled = Boolean(disabled || !data || isLoading);

  async function handleExport() {
    if (!data) return;
    setIsLoading(true);
    setError("");

    try {
      const preparedData = await prepareReportImages(data);
      const blob = await pdf(<ReportPdfDocument data={preparedData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeReportFilename(data.datasetName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Erro ao gerar PDF RAMEX:", err);
      setError(`Não foi possível gerar o PDF: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleExport();
        }}
        disabled={isDisabled}
        className="inline-flex min-h-[2.5rem] min-w-[12rem] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        style={{
          backgroundColor: isDisabled ? "#fbbf24" : "#d97706",
          border: `1px solid ${isDisabled ? "#f59e0b" : "#b45309"}`,
          color: isDisabled ? "#78350f" : "#ffffff",
        }}
        title={disabled || !data ? "Execute primeiro a análise RAMEX." : undefined}
      >
        <Download className="h-4 w-4" />
        {isLoading ? "A gerar PDF..." : label}
      </button>
      {error ? <span className="text-xs text-amber-800">{error}</span> : null}
    </span>
  );
}
