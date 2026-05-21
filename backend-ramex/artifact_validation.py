from __future__ import annotations

import json
from pathlib import Path
from typing import Any


IMAGE_KEYS = {
    "graph_png",
    "ramex_png",
    "polytree_png",
    "ramex2007_png",
    "ramex2007_tree_complete_png",
    "ramex2007_tree_analytical_png",
    "ramex_forum_graph_png",
    "ramex_forum_simplified_png",
}


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"_read_error": str(exc)}


def _exists(job_dir: Path, relative: str | None) -> bool:
    return bool(relative) and (job_dir / relative).is_file()


def _check_file_map(job_dir: Path, files: dict[str, Any], warnings: list[str]) -> dict[str, bool]:
    checked: dict[str, bool] = {}
    for key, value in files.items():
        if not isinstance(value, str) or not value:
            continue
        if key.endswith("_csv") or key.endswith("_json") or key.endswith("_png") or key.endswith("_md") or key in IMAGE_KEYS:
            present = _exists(job_dir, value)
            checked[key] = present
            if not present:
                warnings.append(f"Artefacto referenciado mas inexistente: files.{key} -> {value}")
    return checked


def validate_job_artifacts(job_dir: Path, analysis_type: str | None = None) -> dict[str, Any]:
    status = _read_json(job_dir / "status.json")
    files = status.get("files") if isinstance(status.get("files"), dict) else {}
    warnings: list[str] = []
    errors: list[str] = []
    resolved_analysis_type = (analysis_type or status.get("analysis_type") or "pure").lower()

    if not status:
        errors.append("status.json não encontrado ou inválido.")

    observed_ok = bool(status.get("graph_edges")) or _exists(job_dir, files.get("graph_edges_csv") or files.get("graph_edges"))
    if not observed_ok:
        errors.append("Camada observacional ausente: graph_edges ou grafo_edges.csv não encontrados.")

    pure_required = resolved_analysis_type in {"pure", "both"}
    forum_required = resolved_analysis_type in {"forum", "both"}

    ramex2007_payload = (status.get("pure_ramex") or {}).get("ramex2007") if isinstance(status.get("pure_ramex"), dict) else None
    ramex2007_ok = bool(ramex2007_payload) or _exists(job_dir, files.get("ramex2007_json"))
    if pure_required and not ramex2007_ok:
        errors.append("RAMEX 2007 requerido, mas o JSON formal não está disponível.")
    if not pure_required and ramex2007_ok:
        warnings.append("RAMEX 2007 existe, mas analysis_type não o exige; manter como artefacto não principal.")

    forum_payload = status.get("ramex_forum") if isinstance(status.get("ramex_forum"), dict) else None
    phase1_ok = bool((forum_payload or {}).get("temporal_phase1"))
    phase2_ok = bool((forum_payload or {}).get("temporal_phase2"))
    forum_metrics_ok = _exists(job_dir, "ramex_forum/ramex_forum_metrics.json")
    forum_ok = bool(forum_payload) and phase1_ok and phase2_ok and forum_metrics_ok
    if forum_required and not forum_ok:
        errors.append("RAMEX-Forum requerido, mas Fase 1/Fase 2/metrics não estão completos.")
    if not forum_required and forum_payload:
        warnings.append("RAMEX-Forum existe, mas analysis_type não o exige; manter como artefacto não principal.")

    markdown_ok = bool((status.get("pure_ramex") or {}).get("comparisonMarkdown")) or any(job_dir.glob("*.md")) or any((job_dir / "ramex_forum").glob("*.md")) if (job_dir / "ramex_forum").exists() else any(job_dir.glob("*.md"))
    pdf_ok = False
    if not markdown_ok:
        warnings.append("Relatório Markdown ainda não materializado como artefacto principal.")

    checked_files = _check_file_map(job_dir, files, warnings)
    result = {
        "job_id": job_dir.name,
        "analysis_type": resolved_analysis_type,
        "observed": {"available": observed_ok},
        "ramex2007": {"required": pure_required, "available": ramex2007_ok},
        "forum": {"required": forum_required, "available": forum_ok, "phase1": phase1_ok, "phase2": phase2_ok},
        "markdown_report": {"available": bool(markdown_ok)},
        "pdf_report": {"available": pdf_ok, "note": "PDF é gerado no frontend sob pedido; esta validação apenas garante fallback seguro."},
        "referenced_files": checked_files,
        "warnings": warnings,
        "errors": errors,
        "ok": not errors,
    }
    (job_dir / "job_artifact_validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
