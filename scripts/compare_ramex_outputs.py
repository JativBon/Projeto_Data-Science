from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from ramex_validation import (
        summarize_graph_metrics,
        validate_forward_tree,
        validate_observed_graph,
        validate_polytree,
        validate_rooted_branching,
    )
    import networkx as nx
except Exception:  # pragma: no cover - fallback for minimal environments
    summarize_graph_metrics = None
    validate_forward_tree = None
    validate_observed_graph = None
    validate_polytree = None
    validate_rooted_branching = None
    nx = None


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS_DIR = ROOT / "backend-ramex" / "outputs"
REPORTS_DIR = ROOT / "reports"
STATIC_JSON_DIR = ROOT / "scripts" / "data" / "json"

OUTPUT_CSV = REPORTS_DIR / "compare_ramex_methods.csv"
OUTPUT_JSON = REPORTS_DIR / "compare_ramex_methods.json"
OUTPUT_MD = REPORTS_DIR / "compare_ramex_methods.md"
NA = "Não disponível"


METHODS = [
    "Grafo observado completo",
    "Grafo observado filtrado",
    "RAMEX simplificado experimental",
    "RAMEX 2007 formal",
    "Forward Heuristic",
    "Back-and-Forward Poly-tree formal",
]

COLUMNS = [
    "dataset",
    "método",
    "tipo de estrutura",
    "nós",
    "arestas",
    "arestas esperadas",
    "total_weight",
    "preserved_weight_percentage",
    "is_dag",
    "is_valid_arborescence",
    "is_valid_polytree",
    "max_in_degree",
    "convergence_nodes",
    "tempo de execução",
    "observação",
]


def read_json(path: Path | None) -> dict[str, Any]:
    if not path or not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def read_csv_df(path: Path | None) -> pd.DataFrame:
    if not path or not path.is_file():
        return pd.DataFrame()
    try:
        return pd.read_csv(path, encoding="utf-8")
    except Exception:
        return pd.DataFrame()


def first_existing(base: Path, names: list[str]) -> Path | None:
    for name in names:
        path = base / name
        if path.is_file():
            return path
    return None


def first_glob(base: Path, patterns: list[str]) -> Path | None:
    for pattern in patterns:
        matches = sorted(base.glob(pattern), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
        if matches:
            return matches[0]
    return None


def number_or_na(value: Any) -> Any:
    if value is None or value == "":
        return NA
    return value


def bool_or_na(value: Any) -> Any:
    if value is None or value == "":
        return NA
    return bool(value)


def list_or_na(value: Any) -> str:
    if value is None:
        return NA
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) if value else ""
    return str(value)


def edge_weight(row: dict[str, Any]) -> float:
    for key in ("weight", "Weight", "value", "Frequency"):
        if key in row and pd.notna(row[key]):
            try:
                return float(row[key])
            except Exception:
                return 0.0
    return 0.0


def dataframe_to_graph(df: pd.DataFrame):
    if nx is None:
        return None
    graph = nx.DiGraph()
    if df.empty:
        return graph
    for raw in df.to_dict(orient="records"):
        source = str(raw.get("From") or raw.get("from") or raw.get("Source") or "").strip()
        target = str(raw.get("To") or raw.get("to") or raw.get("Target") or "").strip()
        weight = edge_weight(raw)
        if source and target and weight > 0:
            graph.add_edge(source, target, weight=weight)
    return graph


def edges_to_graph(edges: list[dict[str, Any]] | None):
    if nx is None:
        return None
    graph = nx.DiGraph()
    for raw in edges or []:
        source = str(raw.get("from") or raw.get("From") or raw.get("source") or "").strip()
        target = str(raw.get("to") or raw.get("To") or raw.get("target") or "").strip()
        weight = edge_weight(raw)
        if source and target and weight > 0:
            graph.add_edge(source, target, weight=weight)
    return graph


def metrics_from_df(df: pd.DataFrame, original_df: pd.DataFrame | None = None) -> dict[str, Any]:
    graph = dataframe_to_graph(df)
    original_graph = dataframe_to_graph(original_df) if original_df is not None and not original_df.empty else None
    if graph is not None and summarize_graph_metrics is not None:
        return summarize_graph_metrics(graph, original_graph)
    nodes = set()
    for _, row in df.iterrows():
        source = row.get("From", row.get("from", row.get("Source", "")))
        target = row.get("To", row.get("to", row.get("Target", "")))
        if pd.notna(source) and str(source).strip():
            nodes.add(str(source))
        if pd.notna(target) and str(target).strip():
            nodes.add(str(target))
    total = sum(edge_weight(row) for row in df.to_dict(orient="records"))
    return {"nodes": len(nodes), "edges": len(df), "total_weight": total}


def duration_seconds(job_state: dict[str, Any], step_id: str) -> Any:
    for step in job_state.get("steps", []):
        if step.get("id") != step_id:
            continue
        started = step.get("started_at")
        finished = step.get("finished_at")
        if not started or not finished:
            return NA
        try:
            start = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
            end = datetime.fromisoformat(str(finished).replace("Z", "+00:00"))
            return round((end - start).total_seconds(), 3)
        except Exception:
            return NA
    return NA


def dataset_label(job_dir: Path, status: dict[str, Any]) -> str:
    for key in ("dataset_name", "filename", "source_file", "input_file"):
        value = status.get(key)
        if value:
            return str(value)
    metadata = status.get("metadata") if isinstance(status.get("metadata"), dict) else {}
    for key in ("dataset_name", "filename", "source_file", "input_file"):
        value = metadata.get(key)
        if value:
            return str(value)
    return job_dir.name


def base_row(dataset: str, method: str, structure_type: str, observation: str) -> dict[str, Any]:
    return {
        "dataset": dataset,
        "método": method,
        "tipo de estrutura": structure_type,
        "nós": NA,
        "arestas": NA,
        "arestas esperadas": NA,
        "total_weight": NA,
        "preserved_weight_percentage": NA,
        "is_dag": NA,
        "is_valid_arborescence": NA,
        "is_valid_polytree": NA,
        "max_in_degree": NA,
        "convergence_nodes": NA,
        "tempo de execução": NA,
        "observação": observation,
    }


def row_from_metrics(dataset: str, method: str, structure_type: str, metrics: dict[str, Any], observation: str) -> dict[str, Any]:
    nodes = metrics.get("nodes", metrics.get("selected_nodes", metrics.get("original_nodes")))
    edges = metrics.get("edges", metrics.get("selected_edges", metrics.get("original_edges")))
    return {
        "dataset": dataset,
        "método": method,
        "tipo de estrutura": structure_type,
        "nós": number_or_na(nodes),
        "arestas": number_or_na(edges),
        "arestas esperadas": number_or_na(metrics.get("expected_edges", metrics.get("expected_max_edges"))),
        "total_weight": number_or_na(metrics.get("total_weight", metrics.get("total_selected_weight", metrics.get("selected_weight_sum", metrics.get("original_weight_sum"))))),
        "preserved_weight_percentage": number_or_na(metrics.get("preserved_weight_percentage", metrics.get("preserved_weight_percent", metrics.get("preserved_percentage")))),
        "is_dag": bool_or_na(metrics.get("is_dag", metrics.get("is_acyclic"))),
        "is_valid_arborescence": bool_or_na(metrics.get("is_valid_arborescence", metrics.get("is_arborescence", metrics.get("is_valid_rooted_branching")))),
        "is_valid_polytree": bool_or_na(metrics.get("is_valid_polytree", metrics.get("is_polytree"))),
        "max_in_degree": number_or_na(metrics.get("max_in_degree", metrics.get("max_indegree_except_root", metrics.get("max_non_root_in_degree")))),
        "convergence_nodes": list_or_na(metrics.get("convergence_nodes")),
        "tempo de execução": number_or_na(metrics.get("execution_time_seconds")),
        "observação": observation,
    }


def observed_row(dataset: str, status: dict[str, Any], job_dir: Path, filtered: bool = False) -> dict[str, Any]:
    key = "filtered_graph" if filtered else "observed_graph"
    method = "Grafo observado filtrado" if filtered else "Grafo observado completo"
    payload = status.get(key) if isinstance(status.get(key), dict) else {}
    csv_path = first_existing(job_dir, ["grafo_edges.csv" if filtered else "pares_frequencias.csv"])
    df = read_csv_df(csv_path)

    validation = payload.get("validation") if isinstance(payload.get("validation"), dict) else {}
    if not validation:
        validation = metrics_from_df(df)
        graph = dataframe_to_graph(df)
        if graph is not None and validate_observed_graph is not None:
            validation = validate_observed_graph(graph)

    observation = "Rede observada completa, não é estrutura RAMEX final."
    nodes = validation.get("nodes", payload.get("nodes"))
    edges = validation.get("edges", payload.get("edge_count"))
    if isinstance(nodes, (int, float)) and isinstance(edges, (int, float)) and edges <= max(nodes - 1, 0):
        observation = "Rede observada classificada como diagnóstico."
    row = row_from_metrics(dataset, method, "Rede dirigida ponderada observada", validation, observation)
    if payload:
        row["nós"] = number_or_na(payload.get("nodes", row["nós"]))
        row["arestas"] = number_or_na(payload.get("edge_count", row["arestas"]))
        row["total_weight"] = number_or_na(payload.get("total_weight", row["total_weight"]))
    return row


def simplified_row(dataset: str, status: dict[str, Any], job_dir: Path) -> dict[str, Any]:
    payload = status.get("simplified_ramex") if isinstance(status.get("simplified_ramex"), dict) else {}
    csv_path = first_existing(job_dir, ["ramex_simplificado.csv"])
    df = read_csv_df(csv_path)
    original_df = read_csv_df(first_existing(job_dir, ["grafo_edges.csv"]))
    metrics = metrics_from_df(df, original_df)
    if status.get("metrics"):
        metrics = {**metrics, **{
            "preserved_weight_percentage": status.get("metrics", {}).get("preserved_percentage"),
        }}
    observation = "Baseline experimental; não deve ser apresentado como RAMEX formal principal."
    return row_from_metrics(dataset, "RAMEX simplificado experimental", "Baseline heurístico experimental", metrics, observation if not payload.get("warning") else f"{observation} {payload.get('warning')}")


def method_json(job_dir: Path, canonical_name: str, glob_patterns: list[str]) -> dict[str, Any]:
    canonical = first_existing(job_dir, [canonical_name])
    if canonical:
        return read_json(canonical)
    return read_json(first_glob(job_dir, glob_patterns))


def ramex2007_row(dataset: str, status: dict[str, Any], job_dir: Path, job_state: dict[str, Any]) -> dict[str, Any]:
    payload = method_json(job_dir, "ramex2007_tree.json", ["ramex2007_*.json"])
    validation = read_json(first_existing(job_dir, ["ramex2007_metrics.json"]))
    if not validation:
        validation = payload.get("validation") if isinstance(payload.get("validation"), dict) else {}
    if not validation and payload.get("edges") and validate_rooted_branching is not None:
        graph = edges_to_graph(payload.get("edges"))
        original = dataframe_to_graph(read_csv_df(first_existing(job_dir, ["grafo_edges.csv", "ramex2007_graph_edges.csv"])))
        if graph is not None:
            validation = validate_rooted_branching(graph, payload.get("root"), original)
    metrics = {**payload.get("metrics", {}), **validation}
    valid = bool(metrics.get("is_valid_arborescence") or metrics.get("is_valid_rooted_branching") or metrics.get("is_arborescence"))
    observation = "Arborescência validada formalmente." if valid else "Não deve ser apresentado como resultado final."
    row = row_from_metrics(dataset, "RAMEX 2007 formal", "Arborescência dirigida / rooted branching", metrics, observation)
    row["tempo de execução"] = duration_seconds(job_state, "ramex2007")
    return row


def forward_row(dataset: str, job_dir: Path, job_state: dict[str, Any]) -> dict[str, Any]:
    payload = method_json(job_dir, "forward_tree.json", ["ramex_forward_*.json", "forward_*.json"])
    validation = read_json(first_existing(job_dir, ["forward_metrics.json"]))
    if not validation:
        validation = payload.get("validation") if isinstance(payload.get("validation"), dict) else {}
    if not validation and payload.get("edges") and validate_forward_tree is not None:
        graph = edges_to_graph(payload.get("edges"))
        original = dataframe_to_graph(read_csv_df(first_existing(job_dir, ["grafo_edges.csv"])))
        if graph is not None:
            validation = validate_forward_tree(graph, payload.get("root"), original)
    metrics = {**payload.get("metrics", {}), **validation}
    valid = bool(metrics.get("is_valid_forward_tree", metrics.get("is_dag", metrics.get("is_acyclic"))))
    observation = "Heurística com raiz conhecida/inferida validada para expansão." if valid else "Não deve ser apresentado como resultado final."
    row = row_from_metrics(dataset, "Forward Heuristic", "Heurística dirigida com raiz", metrics, observation)
    row["tempo de execução"] = duration_seconds(job_state, "forward")
    return row


def polytree_row(dataset: str, job_dir: Path, job_state: dict[str, Any]) -> dict[str, Any]:
    payload = method_json(job_dir, "back_forward_polytree_formal.json", ["ramex_back_forward_formal_*.json", "*back_forward*.json"])
    validation = read_json(first_existing(job_dir, ["back_forward_polytree_formal_metrics.json"]))
    if not validation:
        validation = payload.get("validation") if isinstance(payload.get("validation"), dict) else {}
    if not validation and payload.get("edges") and validate_polytree is not None:
        graph = edges_to_graph(payload.get("edges"))
        original = dataframe_to_graph(read_csv_df(first_existing(job_dir, ["grafo_edges.csv"])))
        if graph is not None:
            validation = validate_polytree(graph, original)
    metrics = {**payload.get("metrics", {}), **validation}
    valid = bool(metrics.get("is_valid_polytree") or metrics.get("is_polytree"))
    observation = "Poly-tree formal validada." if valid else "Não deve ser apresentado como resultado final."
    row = row_from_metrics(dataset, "Back-and-Forward Poly-tree formal", "Poly-tree formal", metrics, observation)
    row["tempo de execução"] = duration_seconds(job_state, "polytree_formal")
    return row


def unavailable_rows(dataset: str, existing_methods: set[str]) -> list[dict[str, Any]]:
    return [
        base_row(dataset, method, NA, "Não disponível: ficheiro não encontrado.")
        for method in METHODS
        if method not in existing_methods
    ]


def collect_job_rows(job_dir: Path) -> list[dict[str, Any]]:
    status = read_json(job_dir / "status.json")
    job_state = read_json(job_dir / "job_state.json")
    dataset = dataset_label(job_dir, status)
    rows: list[dict[str, Any]] = []

    rows.append(observed_row(dataset, status, job_dir, filtered=False))
    rows.append(observed_row(dataset, status, job_dir, filtered=True))
    rows.append(simplified_row(dataset, status, job_dir))
    rows.append(ramex2007_row(dataset, status, job_dir, job_state))
    rows.append(forward_row(dataset, job_dir, job_state))
    rows.append(polytree_row(dataset, job_dir, job_state))
    return rows


def collect_static_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(STATIC_JSON_DIR.glob("ramex2007_dataset*.json")):
        payload = read_json(path)
        dataset = path.stem.replace("ramex2007_", "")
        metrics = {**payload.get("metrics", {}), **(payload.get("validation") if isinstance(payload.get("validation"), dict) else {})}
        valid = bool(metrics.get("is_valid_arborescence") or metrics.get("is_arborescence") or payload.get("is_arborescence"))
        observation = "Arborescência validada formalmente." if valid else "Não deve ser apresentado como resultado final."
        row = row_from_metrics(dataset, "RAMEX 2007 formal", "Arborescência dirigida / rooted branching", metrics, observation)
        rows.append(row)
        rows.extend(unavailable_rows(dataset, {"RAMEX 2007 formal"}))
    return rows


def collect_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if OUTPUTS_DIR.is_dir():
        latest_by_dataset: dict[str, Path] = {}
        for job_dir in sorted((p for p in OUTPUTS_DIR.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime):
            if (job_dir / "status.json").is_file() or any(job_dir.glob("ramex*.json")):
                status = read_json(job_dir / "status.json")
                label = dataset_label(job_dir, status)
                previous = latest_by_dataset.get(label)
                if previous is None or job_dir.stat().st_mtime >= previous.stat().st_mtime:
                    latest_by_dataset[label] = job_dir
        for job_dir in sorted(latest_by_dataset.values(), key=lambda p: dataset_label(p, read_json(p / "status.json"))):
            rows.extend(collect_job_rows(job_dir))
    rows.extend(collect_static_rows())
    return rows


def format_markdown_value(value: Any) -> str:
    if value is None or value == "":
        return ""
    return str(value).replace("|", "\\|")


def write_markdown(rows: list[dict[str, Any]], output_path: Path) -> None:
    lines = [
        "# Comparação Final dos Métodos RAMEX",
        "",
        "Tabela automática gerada a partir dos artefactos disponíveis. Valores em falta são assinalados como “Não disponível”.",
        "",
        "| Dataset | Método | Tipo de estrutura | Nós | Arestas | Arestas esperadas | Peso total | Peso preservado (%) | DAG | Arborescência válida | Poly-tree válida | Max in-degree | Nós de convergência | Tempo (s) | Observação |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | ---: | --- | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            "| "
            + " | ".join(format_markdown_value(row[column]) for column in COLUMNS)
            + " |"
        )
    lines.extend([
        "",
        "## Observações automáticas",
        "",
        "- O grafo observado completo é tratado como rede diagnóstica e não como estrutura RAMEX final.",
        "- O RAMEX 2007 só deve ser apresentado como resultado final quando a arborescência estiver validada.",
        "- A Back-and-Forward Poly-tree formal só deve ser apresentada como resultado final quando for DAG e o grafo não dirigido for árvore.",
        "- Sankeys finais devem usar apenas arestas seleccionadas pelas estruturas RAMEX.",
    ])
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_outputs(rows: list[dict[str, Any]]) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    normalized = [{column: row.get(column, NA) for column in COLUMNS} for row in rows]
    pd.DataFrame(normalized, columns=COLUMNS).to_csv(OUTPUT_CSV, index=False, encoding="utf-8")
    OUTPUT_JSON.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(normalized, OUTPUT_MD)


def print_summary(rows: list[dict[str, Any]]) -> None:
    datasets = sorted({str(row["dataset"]) for row in rows})
    valid_arbo = sum(1 for row in rows if row["is_valid_arborescence"] is True)
    valid_poly = sum(1 for row in rows if row["is_valid_polytree"] is True)
    unavailable = sum(1 for row in rows if row["nós"] == NA and row["arestas"] == NA)
    print("Comparação final RAMEX gerada")
    print(f"Datasets/jobs analisados: {len(datasets)}")
    print(f"Linhas exportadas: {len(rows)}")
    print(f"Arborescências válidas: {valid_arbo}")
    print(f"Poly-trees válidas: {valid_poly}")
    print(f"Métodos sem ficheiro disponível: {unavailable}")
    print("Ficheiros exportados:")
    print(f"- {OUTPUT_CSV}")
    print(f"- {OUTPUT_JSON}")
    print(f"- {OUTPUT_MD}")


def main() -> None:
    rows = collect_rows()
    if not rows:
        rows = unavailable_rows("Não disponível", set())
    write_outputs(rows)
    print_summary(rows)


if __name__ == "__main__":
    main()
