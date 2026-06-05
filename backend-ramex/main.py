from __future__ import annotations

import json
import re
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, NoReturn
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.responses import JSONResponse, Response  # type: ignore
from pydantic import BaseModel  # type: ignore

from artifact_validation import validate_job_artifacts
from ramex_pipeline import ALLOWED_EXTENSIONS, detect_columns, run_pipeline, safe_filename

BASE_DIR = Path(__file__).resolve().parent

_MEDIA_TYPES: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".graphml": "application/xml; charset=utf-8",
}


def _file_response(file_path: Path, filename: str | None = None) -> Response:
    """Lê o ficheiro para memória antes de responder.

    Evita o problema Windows onde FileResponse define Content-Length via
    stat() e depois envia mais bytes do que prometeu quando os metadados do
    filesystem ainda estão em cache de uma escrita recente.
    """
    content = file_path.read_bytes()
    media_type = _MEDIA_TYPES.get(file_path.suffix.lower(), "application/octet-stream")
    headers = {}
    if filename:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return Response(content=content, media_type=media_type, headers=headers)
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

INITIAL_JOB_PROGRESS = 5
RUNNING_STEP_PROGRESS = 15
NEW_STEP_PROGRESS = 20
REPEATED_STEP_PROGRESS = 40
FAILED_STEP_MIN_PROGRESS = 1
JOB_LOG_LIMIT = 100

POLYTREE_DEFAULT_TOP_K_PER_NODE = 2
POLYTREE_DEFAULT_MAX_DEPTH = 5
POLYTREE_DEFAULT_ALPHA = 0.35
POLYTREE_DEFAULT_BETA = 0.25
POLYTREE_DEFAULT_GAMMA = 0.15
POLYTREE_DEFAULT_DELTA = 0.15
POLYTREE_DEFAULT_EPSILON = 0.05
POLYTREE_DEFAULT_ZETA = 0.05
POLYTREE_DEFAULT_PRESERVE_WEIGHT_TARGET = 0.7
POLYTREE_DEFAULT_MAX_BRANCHING = 3
POLYTREE_DEFAULT_MIN_SCORE = 0.0

DEV_CORS_ORIGINS = [
    "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
    "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002",
]

app = FastAPI(title="RAMEX Sequential Analysis API")

# Pesos usados apenas para progresso visual do pipeline na UI.
PIPELINE_STEPS: list[dict[str, Any]] = [
    {"id": "upload",           "label": "Ficheiro recebido",                          "weight": 5},
    {"id": "parsing",          "label": "Leitura e parsing do dataset",               "weight": 15},
    {"id": "sequencias",       "label": "Reconstrução de sequências e item-seguinte",    "weight": 15},
    {"id": "pares",            "label": "Transformação RAMEX 2007 em rede G",            "weight": 10},
    {"id": "frequencias",      "label": "Cálculo de frequências absolutas",              "weight": 10},
    {"id": "matriz",           "label": "Construção da matriz de adjacência",            "weight": 10},
    {"id": "grafo",            "label": "Construção do grafo dirigido ponderado",        "weight": 10},
    {"id": "ramex2007",        "label": "Condensação RAMEX 2007 - Rooted Branching",     "weight": 8},
    {"id": "forward",          "label": "Execução heurística histórica Forward",         "weight": 6},
    {"id": "polytree_formal",  "label": "Execução heurística histórica Back-and-Forward","weight": 8},
    {"id": "forum",            "label": "Execução RAMEX-Forum temporal",                 "weight": 6},
    {"id": "validacao",        "label": "Anexo experimental de heurísticas históricas",   "weight": 2},
    {"id": "relatorio",        "label": "Geração de relatório técnico",                  "weight": 1},
]

STEP_LABELS = {step["id"]: step["label"] for step in PIPELINE_STEPS}

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    job_id: str
    dataset_type: str
    analysis_type: str = "pure"
    case_column: str | None = None
    entity_column: str | None = None
    time_column: str | None = None
    event_column: str | None = None
    event_mode: str = "simple"
    event_columns: list[str] | None = None
    numeric_discretization: dict[str, str] | None = None
    case_window: str = "none"
    min_frequency: float = 0.0
    top_n: int | None = None
    strategy: str | None = None
    polytree_strategy: str = "top-k"
    top_k_per_node: int = POLYTREE_DEFAULT_TOP_K_PER_NODE
    max_depth: int = POLYTREE_DEFAULT_MAX_DEPTH
    min_weight: float | None = None
    alpha: float = POLYTREE_DEFAULT_ALPHA
    beta: float = POLYTREE_DEFAULT_BETA
    gamma: float = POLYTREE_DEFAULT_GAMMA
    delta: float = POLYTREE_DEFAULT_DELTA
    epsilon: float = POLYTREE_DEFAULT_EPSILON
    zeta: float = POLYTREE_DEFAULT_ZETA
    preserve_weight_target: float = POLYTREE_DEFAULT_PRESERVE_WEIGHT_TARGET
    max_branching: int = POLYTREE_DEFAULT_MAX_BRANCHING
    min_score: float = POLYTREE_DEFAULT_MIN_SCORE
    forum_initial_node: str | None = None
    forum_forward_top_k: int = 1
    forum_max_depth: int = 10
    forum_min_smoothed_weight: float | None = None
    forum_force_heuristic: str = "auto"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def job_state_path(job_id: str) -> Path:
    return OUTPUT_DIR / job_id / "job_state.json"


def job_result_path(job_id: str) -> Path:
    return OUTPUT_DIR / job_id / "status.json"


def build_initial_job_state(job_id: str) -> dict[str, Any]:
    ts = now_iso()
    steps = [
        {
            "id": step["id"],
            "label": step["label"],
            "status": "completed" if step["id"] == "upload" else "pending",
            "progress": 100 if step["id"] == "upload" else 0,
            "started_at": ts if step["id"] == "upload" else None,
            "finished_at": ts if step["id"] == "upload" else None,
            "message": "Upload concluído" if step["id"] == "upload" else "",
        }
        for step in PIPELINE_STEPS
    ]
    return {
        "job_id": job_id,
        "status": "pending",
        "progress": INITIAL_JOB_PROGRESS,
        "current_step": "Ficheiro recebido",
        "steps": steps,
        "logs": [{"timestamp": ts, "message": "Ficheiro recebido"}],
        "error": None,
    }


def recompute_progress(state: dict[str, Any]) -> None:
    steps_by_id = {s["id"]: s for s in state["steps"]}
    total = sum(
        step["weight"] * float(steps_by_id.get(step["id"], {}).get("progress", 0)) / 100.0
        for step in PIPELINE_STEPS
    )
    state["progress"] = max(0, min(100, int(round(total))))


def update_step_status(
    state: dict[str, Any],
    step_id: str,
    status: str,
    message: str | None = None,
    progress: int | None = None,
) -> None:
    ts = now_iso()
    step = next((s for s in state["steps"] if s["id"] == step_id), None)
    if not step:
        return

    step["status"] = status
    if status == "running" and not step.get("started_at"):
        step["started_at"] = ts
    if status in {"completed", "failed"}:
        step["finished_at"] = ts

    if progress is not None:
        step["progress"] = max(0, min(100, int(progress)))
    elif status == "completed":
        step["progress"] = 100
    elif status == "failed":
        step["progress"] = max(FAILED_STEP_MIN_PROGRESS, int(step.get("progress", 0)))
    elif status == "running" and int(step.get("progress", 0)) == 0:
        step["progress"] = RUNNING_STEP_PROGRESS

    if message:
        step["message"] = message

    state["current_step"] = STEP_LABELS.get(step_id, step_id)
    recompute_progress(state)


def append_job_log(state: dict[str, Any], message: str) -> None:
    state.setdefault("logs", []).append({"timestamp": now_iso(), "message": message})
    state["logs"] = state["logs"][-JOB_LOG_LIMIT:]


def load_job_state(job_id: str) -> dict[str, Any]:
    path = job_state_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    return read_json(path)


def save_job_state(job_id: str, state: dict[str, Any]) -> None:
    write_json(job_state_path(job_id), state)


def run_job_pipeline(job_id: str, metadata: dict[str, Any], payload: AnalyzeRequest) -> dict[str, Any]:
    state = load_job_state(job_id)
    entity_column = payload.case_column or payload.entity_column
    print("RUN_JOB_PIPELINE CONFIG", {
        "job_id": job_id,
        "dataset_type": payload.dataset_type,
        "analysis_type": payload.analysis_type,
        "event_mode": payload.event_mode,
        "case_column": payload.case_column,
        "entity_column": payload.entity_column,
        "effective_case_column": entity_column,
        "time_column": payload.time_column,
        "event_column": payload.event_column,
        "event_columns": payload.event_columns,
        "numeric_discretization": payload.numeric_discretization,
        "case_window": payload.case_window,
    }, flush=True)

    skip_ids = (
        {"ramex2007", "forward", "polytree_formal", "validacao"} if payload.analysis_type == "forum"
        else {"forum"} if payload.analysis_type == "pure"
        else set()
    )
    for step in state.get("steps", []):
        if step.get("id") in skip_ids:
            step["status"] = "completed"
            step["progress"] = 100
            step["message"] = "Não aplicável ao tipo de análise selecionado"

    recompute_progress(state)
    state["status"] = "running"
    save_job_state(job_id, state)

    current_step = "upload"

    def progress_cb(step_id: str, message: str) -> None:
        nonlocal current_step
        local_state = load_job_state(job_id)
        if current_step != step_id:
            update_step_status(local_state, current_step, "completed", "Concluído")
            update_step_status(local_state, step_id, "running", message, progress=NEW_STEP_PROGRESS)
            append_job_log(local_state, message)
            current_step = step_id
        else:
            update_step_status(local_state, step_id, "running", message, progress=REPEATED_STEP_PROGRESS)
        save_job_state(job_id, local_state)

    def log_cb(message: str) -> None:
        local_state = load_job_state(job_id)
        append_job_log(local_state, message)
        save_job_state(job_id, local_state)

    try:
        results = run_pipeline(
            input_file=Path(metadata["path"]),
            output_dir=OUTPUT_DIR / job_id,
            dataset_type=payload.dataset_type,
            analysis_type=payload.analysis_type,
            case_column=entity_column,
            entity_column=payload.entity_column,
            time_column=payload.time_column,
            event_column=payload.event_column,
            event_mode=payload.event_mode,
            event_columns=payload.event_columns,
            numeric_discretization=payload.numeric_discretization,
            case_window=payload.case_window,
            min_frequency=payload.min_frequency,
            top_n=payload.top_n,
            polytree_strategy=payload.strategy or payload.polytree_strategy,
            top_k_per_node=payload.top_k_per_node,
            max_depth=payload.max_depth,
            min_weight=payload.min_weight,
            alpha=payload.alpha,
            beta=payload.beta,
            gamma=payload.gamma,
            delta=payload.delta,
            epsilon=payload.epsilon,
            zeta=payload.zeta,
            preserve_weight_target=payload.preserve_weight_target,
            max_branching=payload.max_branching,
            min_score=payload.min_score,
            forum_initial_node=payload.forum_initial_node,
            forum_forward_top_k=payload.forum_forward_top_k,
            forum_max_depth=payload.forum_max_depth,
            forum_min_smoothed_weight=payload.forum_min_smoothed_weight,
            forum_force_heuristic=payload.forum_force_heuristic,
            progress_cb=progress_cb,
            log_cb=log_cb,
        )
    except Exception as exc:
        local_state = load_job_state(job_id)
        step_label = STEP_LABELS.get(current_step, current_step)
        user_message = str(exc)
        if current_step == "ramex2007":
            user_message = (
                "Erro na execução RAMEX 2007. Verifique se o grafo possui arestas válidas "
                "e se existe subgrafo alcançável a partir da raiz."
            )
        update_step_status(local_state, current_step, "failed", user_message)
        local_state["status"] = "failed"
        local_state["error"] = {
            "title": "Erro na execução RAMEX 2007" if current_step == "ramex2007" else f"Erro na etapa {step_label}",
            "step": step_label,
            "message": user_message,
            "technical": str(exc),
        }
        append_job_log(local_state, f"Erro na etapa {step_label}: {exc}")
        save_job_state(job_id, local_state)
        raise

    local_state = load_job_state(job_id)
    update_step_status(local_state, current_step, "completed", "Concluído")
    local_state.update({"status": "completed", "progress": 100, "current_step": "Concluído", "error": None})
    append_job_log(local_state, "Pipeline RAMEX concluída com sucesso")
    save_job_state(job_id, local_state)

    results.update({
        "job_id": job_id,
        "filename": metadata["original_filename"],
        "status": "completed",
        "files": {**results.get("files", {}), "graph_edges": results.get("files", {}).get("graph_edges_csv", "grafo_edges.csv")},
    })
    write_json(job_result_path(job_id), results)
    validation = validate_job_artifacts(OUTPUT_DIR / job_id, payload.analysis_type)
    results["artifact_validation"] = validation
    write_json(job_result_path(job_id), results)
    return results


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise HTTPException(status_code=404, detail="Registo não encontrado.")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


JOB_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def safe_job_dir(job_id: str) -> Path:
    if not JOB_ID_PATTERN.fullmatch(job_id):
        raise HTTPException(status_code=400, detail="job_id inválido.")
    base = OUTPUT_DIR.resolve()
    job_dir = (OUTPUT_DIR / job_id).resolve()
    if base != job_dir and base not in job_dir.parents:
        raise HTTPException(status_code=400, detail="job_id inválido.")
    if not job_dir.is_dir():
        raise HTTPException(status_code=404, detail="Job não encontrado.")
    return job_dir


def safe_history_file_path(job_id: str, filename: str) -> Path:
    if not filename or filename.startswith(("/", "\\")) or ".." in Path(filename).parts:
        raise HTTPException(status_code=400, detail="Nome de ficheiro inválido.")
    job_dir = safe_job_dir(job_id)
    file_path = (job_dir / filename).resolve()
    if job_dir != file_path and job_dir not in file_path.parents:
        raise HTTPException(status_code=400, detail="Nome de ficheiro inválido.")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado.")
    return file_path


def read_json_if_exists(path: Path) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def first_existing_relative(job_dir: Path, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if (job_dir / candidate).is_file():
            return candidate
    return None


def first_matching_relative(job_dir: Path, pattern: str) -> str | None:
    matches = sorted(
        [path for path in job_dir.rglob(pattern) if path.is_file()],
        key=lambda path: (len(path.parts), path.name),
    )
    if not matches:
        return None
    return matches[0].relative_to(job_dir).as_posix()


def history_file_map(job_dir: Path) -> dict[str, str | None]:
    return {
        "graph": first_existing_relative(job_dir, ["grafo.png"]),
        "matrix": first_existing_relative(job_dir, ["matriz_adjacencia.csv"]),
        "ramex2007": first_matching_relative(job_dir, "ramex2007*.csv"),
        "forward": first_matching_relative(job_dir, "ramex_forward*.csv"),
        "back_forward_formal": first_matching_relative(job_dir, "ramex_back_forward_formal*.csv"),
        "forum_metrics": first_existing_relative(job_dir, ["ramex_forum/ramex_forum_metrics.json"]),
        "report_pdf": first_matching_relative(job_dir, "*.pdf"),
        "report_md": first_matching_relative(job_dir, "*.md"),
        "graph_png": first_existing_relative(job_dir, ["grafo.png"]),
        "ramex_png": first_existing_relative(job_dir, ["ramex_simplificado.png"]),
        "polytree_png": first_existing_relative(job_dir, ["ramex_polytree.png"]),
        "ramex2007_png": first_matching_relative(job_dir, "ramex2007*.png"),
        "forward_png": first_matching_relative(job_dir, "ramex_forward*.png"),
        "back_forward_formal_png": first_matching_relative(job_dir, "ramex_back_forward_formal*.png"),
        "forum_graph_png": first_existing_relative(job_dir, ["ramex_forum/ramex_forum_graph.png"]),
        "forum_simplified_png": first_existing_relative(job_dir, ["ramex_forum/ramex_forum_simplified.png"]),
    }


def infer_analysis_type(job_dir: Path, status: dict[str, Any]) -> str:
    declared = status.get("analysis_type")
    if declared in {"pure", "forum", "both"}:
        return declared
    has_pure = any(job_dir.glob("ramex2007*.json")) or any(job_dir.glob("validacao_ramex_puro*.json"))
    has_forum = (job_dir / "ramex_forum" / "ramex_forum_metrics.json").is_file()
    if has_pure and has_forum:
        return "both"
    if has_forum:
        return "forum"
    if has_pure:
        return "pure"
    return "unknown"


def infer_created_at(job_dir: Path, state: dict[str, Any]) -> str:
    for step in state.get("steps", []):
        if step.get("started_at"):
            return str(step["started_at"])
    return datetime.fromtimestamp(job_dir.stat().st_mtime, UTC).isoformat()


def infer_best_pure(validation: dict[str, Any]) -> tuple[str | None, float]:
    rows = validation.get("rows") if isinstance(validation.get("rows"), list) else []
    best_row = max(rows, key=lambda row: float(row.get("Peso preservado (%)") or 0), default={})
    best_algorithm = validation.get("best_algorithm") or best_row.get("Algoritmo")
    best_weight = float(best_row.get("Peso preservado (%)") or 0)
    return best_algorithm, best_weight


def build_history_job(job_dir: Path, detail: bool = False) -> dict[str, Any]:
    job_id = job_dir.name
    status = read_json_if_exists(job_dir / "status.json")
    state = read_json_if_exists(job_dir / "job_state.json")
    validation_path = next(iter(sorted(job_dir.glob("validacao_ramex_puro*.json"))), None)
    validation = read_json_if_exists(validation_path) if validation_path else {}
    forum = read_json_if_exists(job_dir / "ramex_forum" / "ramex_forum_metrics.json")

    metrics = status.get("metrics") if isinstance(status.get("metrics"), dict) else {}
    forum_metrics = forum.get("metrics") if isinstance(forum.get("metrics"), dict) else {}
    files = history_file_map(job_dir)
    best_algorithm, best_weight = infer_best_pure(validation)
    analysis_type = infer_analysis_type(job_dir, status)
    job_status = status.get("status") or state.get("status") or ("completed" if (job_dir / "status.json").is_file() else "unknown")

    payload: dict[str, Any] = {
        "job_id": job_id,
        "created_at": infer_created_at(job_dir, state),
        "dataset_name": status.get("filename") or status.get("dataset_name") or job_id,
        "analysis_type": analysis_type,
        "status": job_status if job_status in {"completed", "failed"} else job_status or "unknown",
        "has_pure": analysis_type in {"pure", "both"} or bool(validation),
        "has_forum": analysis_type in {"forum", "both"} or bool(forum),
        "files": files,
        "summary": {
            "nodes": metrics.get("nodes") or forum_metrics.get("nodes") or 0,
            "edges": metrics.get("edges") or forum_metrics.get("edges") or 0,
            "density": metrics.get("density") or forum_metrics.get("density") or 0,
            "best_algorithm": best_algorithm,
            "best_preserved_weight": best_weight,
            "most_influential_node": forum_metrics.get("most_influential_node"),
        },
    }

    if detail:
        available_files = [
            path.relative_to(job_dir).as_posix()
            for path in sorted(job_dir.rglob("*"))
            if path.is_file()
        ]
        payload.update({
            "metadata": {"state": state, "status": status},
            "pure_metrics": {
                "validation": validation,
                "ramex2007": read_json_if_exists(job_dir / (files.get("ramex2007_png") or "").replace(".png", ".json")) if files.get("ramex2007_png") else {},
                "forward": read_json_if_exists(job_dir / (files.get("forward_png") or "").replace(".png", ".json")) if files.get("forward_png") else {},
                "back_forward_formal": read_json_if_exists(job_dir / (files.get("back_forward_formal_png") or "").replace(".png", ".json")) if files.get("back_forward_formal_png") else {},
            },
            "forum_metrics": forum,
            "available_files": available_files,
            "links": {
                name: f"/api/ramex/history/{job_id}/file/{path}"
                for name, path in files.items()
                if path
            },
        })

    return payload


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ramex/history")
def get_ramex_history() -> dict[str, Any]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs = [
        build_history_job(job_dir)
        for job_dir in OUTPUT_DIR.iterdir()
        if job_dir.is_dir()
    ]
    jobs.sort(key=lambda job: str(job.get("created_at") or ""), reverse=True)
    return {"jobs": jobs}


@app.get("/api/ramex/history/{job_id}")
def get_ramex_history_detail(job_id: str) -> dict[str, Any]:
    return build_history_job(safe_job_dir(job_id), detail=True)


@app.get("/api/ramex/history/{job_id}/file/{filename:path}")
def get_ramex_history_file(job_id: str, filename: str) -> Response:
    file_path = safe_history_file_path(job_id, filename)
    return _file_response(file_path, filename=file_path.name)


async def _save_upload(file: UploadFile) -> tuple[str, Path, str]:
    orig_name = file.filename or "dataset"
    filename = safe_filename(orig_name)
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Extensão inválida. Use .txt, .csv ou .xlsx.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="O ficheiro está vazio.")
    job_id = uuid4().hex
    saved_path = UPLOAD_DIR / job_id / filename
    saved_path.parent.mkdir(parents=True, exist_ok=True)
    saved_path.write_bytes(content)
    return job_id, saved_path, orig_name


def _raise_pipeline_error(exc: Exception) -> NoReturn:
    is_value_err = isinstance(exc, ValueError)
    raise HTTPException(status_code=400 if is_value_err else 500, detail=str(exc) if is_value_err else f"Erro inesperado: {exc}")


def _preview_rows(path: Path, limit: int = 20) -> list[dict[str, Any]]:
    try:
        import pandas as pd  # type: ignore

        df = pd.read_csv(path, nrows=limit) if path.suffix.lower() == ".csv" else pd.read_excel(path, nrows=limit)
        df = df.where(pd.notna(df), None)
        return json.loads(df.to_json(orient="records", force_ascii=False, date_format="iso"))
    except Exception:
        return []


@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    job_id, saved_path, orig_name = await _save_upload(file)
    try:
        columns = detect_columns(saved_path)
        preview_rows = _preview_rows(saved_path) if saved_path.suffix.lower() in {".csv", ".xlsx"} else []
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível detetar colunas: {exc}")

    filename = saved_path.name
    write_json(UPLOAD_DIR / job_id / "metadata.json", {
        "job_id": job_id, "original_filename": orig_name,
        "filename": filename, "path": str(saved_path), "columns": columns, "preview_rows": preview_rows,
    })
    return {"job_id": job_id, "filename": filename, "columns": columns, "preview_rows": preview_rows, "message": "Ficheiro recebido com sucesso."}


@app.post("/api/analyze")
def analyze_dataset(
    payload: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    async_mode: bool = Query(False),
) -> dict[str, Any]:
    payload_dump = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    print("RUN-FULL RAW REQUEST", payload_dump, flush=True)
    meta_path = UPLOAD_DIR / payload.job_id / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Ficheiro do job não encontrado.")

    metadata = read_json(meta_path)
    save_job_state(payload.job_id, build_initial_job_state(payload.job_id))

    if async_mode:
        background_tasks.add_task(run_job_pipeline, payload.job_id, metadata, payload)
        return {"job_id": payload.job_id, "status": "pending"}

    try:
        return run_job_pipeline(payload.job_id, metadata, payload)
    except Exception as exc:
        _raise_pipeline_error(exc)


@app.post("/api/ramex/run-full")
async def run_full_ramex(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dataset_type: str = Form("simple_sequences"),
    case_column: str | None = Form(None),
    entity_column: str | None = Form(None),
    time_column: str | None = Form(None),
    event_column: str | None = Form(None),
    event_mode: str = Form("simple"),
    event_columns: str | None = Form(None),
    numeric_discretization: str | None = Form(None),
    case_window: str = Form("none"),
    remove_consecutive_duplicates: bool = Form(True),
    min_frequency: float = Form(0.0),
    top_n: int | None = Form(None),
    analysis_type: str = Form("pure"),
    async_mode: bool = Form(False),
    forum_initial_node: str | None = Form(None),
    forum_forward_top_k: int = Form(1),
    forum_max_depth: int = Form(10),
    forum_min_smoothed_weight: float | None = Form(None),
    forum_force_heuristic: str = Form("auto"),
) -> dict[str, Any]:
    """Executa a análise RAMEX num único pedido.

    Mantém os endpoints /api/upload e /api/analyze para compatibilidade, mas
    oferece uma entrada mais simples para a versão final da aplicação.
    """
    print("RUN-FULL RAW REQUEST", {
        "dataset_type": dataset_type,
        "analysis_type": analysis_type,
        "event_mode": event_mode,
        "case_column": case_column,
        "entity_column": entity_column,
        "time_column": time_column,
        "event_column": event_column,
        "event_columns": event_columns,
        "numeric_discretization": numeric_discretization,
        "case_window": case_window,
    }, flush=True)
    job_id, saved_path, orig_name = await _save_upload(file)
    write_json(UPLOAD_DIR / job_id / "metadata.json", {
        "job_id": job_id, "original_filename": orig_name,
        "filename": saved_path.name, "path": str(saved_path),
        "columns": detect_columns(saved_path),
        "remove_consecutive_duplicates": remove_consecutive_duplicates,
    })

    payload = AnalyzeRequest(
        job_id=job_id, dataset_type=dataset_type, analysis_type=analysis_type,
        case_column=case_column, entity_column=entity_column,
        time_column=time_column, event_column=event_column,
        event_mode=event_mode,
        event_columns=json.loads(event_columns) if event_columns else None,
        numeric_discretization=json.loads(numeric_discretization) if numeric_discretization else None,
        case_window=case_window,
        min_frequency=min_frequency, top_n=top_n, polytree_strategy="top-k",
        forum_initial_node=forum_initial_node or None,
        forum_forward_top_k=forum_forward_top_k,
        forum_max_depth=forum_max_depth,
        forum_min_smoothed_weight=forum_min_smoothed_weight,
        forum_force_heuristic=forum_force_heuristic,
    )
    metadata = read_json(UPLOAD_DIR / job_id / "metadata.json")
    save_job_state(job_id, build_initial_job_state(job_id))

    if async_mode:
        background_tasks.add_task(run_job_pipeline, job_id, metadata, payload)
        return {"job_id": job_id, "status": "pending"}

    try:
        return run_job_pipeline(job_id, metadata, payload)
    except Exception as exc:
        _raise_pipeline_error(exc)


@app.get("/api/ramex/jobs/{job_id}")
def get_job_status(job_id: str) -> dict[str, Any]:
    if (state_path := job_state_path(job_id)).exists():
        return read_json(state_path)

    # Tolerate short race windows where upload exists but async analysis
    # has not persisted the first job_state yet.
    if (UPLOAD_DIR / job_id / "metadata.json").exists():
        state = build_initial_job_state(job_id)
        save_job_state(job_id, state)
        return state

    if (result_path := job_result_path(job_id)).exists():
        result = read_json(result_path)
        return {
            "job_id": job_id,
            "status": result.get("status", "completed"),
            "progress": 100,
            "current_step": "Concluído",
            "steps": build_initial_job_state(job_id)["steps"],
            "logs": [{"timestamp": now_iso(), "message": "Resultado disponível"}],
            "error": None,
        }

    raise HTTPException(status_code=404, detail="Job não encontrado.")


@app.get("/api/ramex/jobs/{job_id}/result")
def get_job_result(job_id: str) -> Any:
    if (state_path := job_state_path(job_id)).exists():
        state = read_json(state_path)
        if state.get("status") != "completed":
            return JSONResponse(status_code=202, content={"job_id": job_id, "status": state.get("status")})

    if not (result_path := job_result_path(job_id)).exists():
        raise HTTPException(status_code=404, detail="Resultado do job ainda não está disponível.")
    return read_json(result_path)


@app.post("/api/ramex-forum/run")
async def run_ramex_forum_endpoint(
    file: UploadFile = File(...),
    dataset_type: str = Form("simple_sequences"),
    case_column: str | None = Form(None),
    entity_column: str | None = Form(None),
    time_column: str | None = Form(None),
    event_column: str | None = Form(None),
    event_mode: str = Form("simple"),
    event_columns: str | None = Form(None),
    numeric_discretization: str | None = Form(None),
    case_window: str = Form("none"),
    min_frequency: float = Form(0.0),
    top_n: int | None = Form(None),
    forum_initial_node: str | None = Form(None),
    forum_forward_top_k: int = Form(1),
    forum_max_depth: int = Form(10),
    forum_min_smoothed_weight: float | None = Form(None),
    forum_force_heuristic: str = Form("auto"),
) -> dict[str, Any]:
    return await run_full_ramex(
        background_tasks=BackgroundTasks(),
        file=file,
        dataset_type=dataset_type,
        case_column=case_column,
        entity_column=entity_column,
        time_column=time_column,
        event_column=event_column,
        event_mode=event_mode,
        event_columns=event_columns,
        numeric_discretization=numeric_discretization,
        case_window=case_window,
        min_frequency=min_frequency,
        top_n=top_n,
        forum_initial_node=forum_initial_node,
        forum_forward_top_k=forum_forward_top_k,
        forum_max_depth=forum_max_depth,
        forum_min_smoothed_weight=forum_min_smoothed_weight,
        forum_force_heuristic=forum_force_heuristic,
        analysis_type="forum",
        async_mode=False,
    )


@app.get("/api/ramex-forum/jobs/{job_id}")
def get_ramex_forum_job(job_id: str) -> dict[str, Any]:
    return get_job_status(job_id)


@app.get("/api/ramex-forum/jobs/{job_id}/result")
def get_ramex_forum_result(job_id: str) -> Any:
    result = read_json(job_result_path(job_id))
    return result.get("ramex_forum") or {"message": "Resultado RAMEX-Forum não disponível para este job."}


@app.get("/api/ramex-forum/jobs/{job_id}/file/{filename}")
def get_ramex_forum_file(job_id: str, filename: str) -> Response:
    file_path = OUTPUT_DIR / job_id / "ramex_forum" / safe_filename(filename)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Ficheiro RAMEX-Forum não encontrado.")
    return _file_response(file_path, filename=file_path.name)


@app.get("/api/results/{job_id}")
def get_results(job_id: str) -> dict[str, Any]:
    return read_json(OUTPUT_DIR / job_id / "status.json")


@app.get("/api/results/{job_id}/validate-artifacts")
def validate_artifacts(job_id: str) -> dict[str, Any]:
    result = read_json(job_result_path(job_id))
    return validate_job_artifacts(OUTPUT_DIR / job_id, result.get("analysis_type"))


@app.get("/api/file/{job_id}/{filename}")
def get_file(job_id: str, filename: str) -> Response:
    file_path = OUTPUT_DIR / job_id / safe_filename(filename)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Ficheiro não encontrado.")
    return _file_response(file_path, filename=file_path.name)
