from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from collections import Counter, deque
from itertools import groupby
from pathlib import Path
from typing import Any, Callable

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib  # type: ignore
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # type: ignore
import networkx as nx  # type: ignore
import pandas as pd  # type: ignore

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from forum_temporal_pipeline import run_forum_temporal_phase1, run_forum_temporal_phase2
from ramex_forum_pipeline import run_ramex_forum
from ramex_validation import validate_forward_tree, validate_observed_graph, validate_polytree, validate_rooted_branching

ALLOWED_EXTENSIONS = {".txt", ".csv", ".xlsx"}

ProgressCallback = Callable[[str, str], None]
LogCallback = Callable[[str], None]


ARTIFACT_SEMANTICS: dict[str, dict[str, str]] = {
    "observed_graph": {
        "label": "Grafo observado completo",
        "description": "Rede original de transições",
        "warning": "Rede completa extraída dos dados; pode ser densa e conter ciclos.",
        "structural_note": "Pode conter ciclos, múltiplas entradas e elevada densidade",
    },
    "filtered_graph": {
        "label": "Grafo observado filtrado",
        "description": "Visualização exploratória",
        "warning": "Não representa a saída final RAMEX",
        "structural_note": "Subconjunto visual da rede original após filtros de legibilidade",
    },
    "simplified_ramex": {
        "label": "RAMEX simplificado experimental",
        "description": "Baseline heurístico",
        "warning": "Não corresponde ao RAMEX 2007 formal",
        "structural_note": "Heurística histórica/gulosa mantida apenas para comparação",
    },
    "ramex2007": {
        "label": "RAMEX 2007 formal",
        "description": "Maximum Weight Rooted Branching",
        "interpretation": "Estrutura condensada obtida por rooted branching.",
        "structural_note": "Arborescência dirigida extraída da rede ponderada",
    },
    "forward": {
        "label": "Forward Heuristic",
        "description": "Heurística com raiz conhecida",
        "structural_note": "Expansão dirigida a partir de um nó inicial definido ou inferido",
    },
    "back_forward": {
        "label": "Back-and-Forward Poly-tree",
        "description": "Heurística para ausência de raiz clara",
        "structural_note": "Expansão em ambos os sentidos a partir de uma relação dominante",
    },
    "polytree_formal": {
        "label": "Poly-tree formal validada",
        "description": "DAG cujo grafo não dirigido é uma árvore",
        "interpretation": "Estrutura acíclica com forma de poly-tree.",
        "structural_note": "Validação exige DAG e árvore no grafo não dirigido",
    },
    "sankey": {
        "label": "Sankey RAMEX final",
        "description": "Fluxo visual das arestas selecionadas pela estrutura RAMEX",
        "warning": "O Sankey final deve usar apenas arestas da estrutura RAMEX selecionada.",
        "structural_note": "Sankey observado é apenas diagnóstico complementar",
    },
}


def artifact_meta(key: str) -> dict[str, str]:
    return dict(ARTIFACT_SEMANTICS[key])


def safe_filename(filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", Path(filename).name) or "dataset"


def read_table(file_path: Path, nrows: int | None = None) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(file_path, nrows=nrows)
    if ext == ".xlsx":
        return pd.read_excel(file_path, nrows=nrows)
    raise ValueError("Este tipo de dataset requer ficheiro CSV ou XLSX.")


def detect_columns(file_path: Path) -> list[str]:
    if file_path.suffix.lower() not in {".csv", ".xlsx"}:
        return []
    return list(read_table(file_path, nrows=0).columns)


def as_str(value: Any) -> str:
    return "" if value is None else str(value)


def as_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_text_value(value: Any) -> str | None:
    try:
        if bool(pd.isna(value)):
            return None
    except Exception:
        pass
    if value is None:
        return None
    text = as_str(value).strip()
    return None if text.lower() in {"", "nan", "nat"} else text


def load_simple_sequences(file_path: Path) -> list[list[str]]:
    """
    Carrega sequências simples de um ficheiro TXT ou CSV.

    Formatos suportados:
    1. Uma sequência por linha (itens separados por vírgula ou espaço):
          a c d e h
          a b d e g
    2. Com coluna de contagem (a última coluna numérica ou cabeçalho count/n/#count):
          sequence,count
          acdeh,455
          abdeg,191
       ou sem cabeçalho:
          a c d e h,455
          a b d e g,191
    """
    if file_path.suffix.lower() not in {".txt", ".csv"}:
        raise ValueError("Sequências simples devem usar ficheiro TXT ou CSV.")

    raw_lines = [ln.strip() for ln in file_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if not raw_lines:
        raise ValueError("Ficheiro vazio.")

    # Detectar se existe cabeçalho com coluna de contagem
    COUNT_HEADERS = {"count", "n", "#count", "freq", "frequency", "weight", "repetitions", "contagem"}
    SEQ_HEADERS   = {"sequence", "seq", "sequencia", "sequência", "event_stream", "events"}

    header_line = raw_lines[0].lower()
    has_count_header = any(h in header_line for h in COUNT_HEADERS)
    has_seq_header   = any(h in header_line for h in SEQ_HEADERS)

    if has_count_header or has_seq_header:
        data_lines = raw_lines[1:]  # saltar cabeçalho
    else:
        data_lines = raw_lines

    sequences: list[list[str]] = []

    for line in data_lines:
        # Tentar separar por vírgula primeiro
        parts = [p.strip() for p in line.split(",")]

        # Detectar se o último token é um número inteiro (contagem)
        count = 1
        if len(parts) >= 2:
            try:
                count = int(parts[-1])
                seq_part = ",".join(parts[:-1]).strip()
            except ValueError:
                seq_part = line
        else:
            seq_part = line

        # Expandir os itens da sequência (por vírgula, tab ou espaço)
        if "," in seq_part:
            items = [t.strip() for t in seq_part.split(",") if t.strip()]
        else:
            items = [t.strip() for t in seq_part.split() if t.strip()]

        # Se a sequência é uma palavra contínua sem separadores (ex: "acdeh"), expandir em caracteres
        if len(items) == 1 and len(items[0]) > 1:
            items = list(items[0])

        if len(items) >= 2:
            for _ in range(max(1, count)):
                sequences.append(items)

    if not sequences:
        raise ValueError("Não foram encontradas sequências válidas com tamanho mínimo 2.")
    return sequences


def sanitize_event_part(value: Any) -> str | None:
    text = normalize_text_value(value)
    if text is None:
        return None
    text = re.sub(r"\s+", "_", text.strip())
    text = re.sub(r"[^0-9A-Za-zÀ-ÿ._-]+", "_", text)
    return text.strip("_").upper() or None


def load_event_table_sequences(file_path: Path, case_col: str, time_col: str, event_col: str) -> list[list[str]]:
    df = read_table(file_path)
    if missing := [c for c in [case_col, time_col, event_col] if c not in df.columns]:
        raise ValueError(f"Colunas obrigatórias ausentes: {missing}")

    df = df[[case_col, time_col, event_col]].copy()
    df[event_col] = df[event_col].apply(normalize_text_value)
    df[case_col] = df[case_col].apply(normalize_text_value)
    df = df.dropna(subset=[case_col, event_col])  # type: ignore[call-overload]

    if df.empty:
        raise ValueError("Não existem eventos válidos após limpeza.")

    is_date = pd.api.types.is_datetime64_any_dtype(df[time_col]) or any(
        t in time_col.lower() for t in ["date", "data", "time", "tempo"]
    )
    df["_order"] = (
        pd.to_datetime(df[time_col], errors="coerce")
        if is_date
        else pd.to_numeric(df[time_col], errors="coerce")
    )

    if df["_order"].notna().mean() < 0.8:
        raise ValueError(f"A coluna '{time_col}' contém demasiados valores inválidos para o formato esperado.")

    df = df.dropna(subset=["_order"]).sort_values(by=[case_col, "_order", event_col], kind="stable")

    sequences = [
        [str(e) for e in seq if normalize_text_value(e)]
        for seq in df.groupby(case_col, sort=False)[event_col].apply(list)
    ]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("Não foram geradas sequências com tamanho mínimo 2.")
    return valid


def discretize_quantile(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    try:
        buckets = pd.qcut(numeric, q=3, labels=["LOW", "MEDIUM", "HIGH"], duplicates="drop")
        return buckets.astype("object").where(numeric.notna(), None)
    except ValueError:
        return numeric.apply(lambda value: "MEDIUM" if pd.notna(value) else None)


def discretize_variation_pct(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")

    def label(value: float) -> str | None:
        if pd.isna(value):
            return None
        if value < -2:
            return "STRONG_DOWN"
        if value < -0.5:
            return "DOWN"
        if value <= 0.5:
            return "STABLE"
        if value <= 2:
            return "UP"
        return "STRONG_UP"

    return numeric.apply(label)


def temporal_window_id(value: Any, window: str) -> str | None:
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return None
    if window == "daily":
        return f"W{timestamp.year}_{timestamp.month:02d}_{timestamp.day:02d}"
    if window == "weekly":
        iso = timestamp.isocalendar()
        return f"W{iso.year}_{iso.week:02d}"
    if window == "monthly":
        return f"W{timestamp.year}_{timestamp.month:02d}"
    if window == "quarterly":
        quarter = ((timestamp.month - 1) // 3) + 1
        return f"W{timestamp.year}_Q{quarter}"
    return None


def load_advanced_event_sequences(
    file_path: Path,
    case_col: str | None,
    time_col: str,
    event_columns: list[str],
    numeric_discretization: dict[str, str] | None = None,
    case_window: str | None = None,
) -> tuple[list[list[str]], dict[str, Any]]:
    df = read_table(file_path)
    numeric_discretization = numeric_discretization or {}
    case_window = (case_window or "none").lower()
    if case_window == "use_entity":
        case_window = "none"
    if case_window not in {"none", "daily", "weekly", "monthly", "quarterly"}:
        raise ValueError("Janela temporal inválida. Use none, daily, weekly, monthly ou quarterly.")

    if not event_columns:
        raise ValueError("Modo avançado requer pelo menos uma coluna para construir o evento.")
    if not time_col or time_col not in df.columns:
        raise ValueError(f"Modo avançado requer uma coluna de tempo existente. Recebido: {time_col or 'não definido'}.")
    if case_window == "none" and (not case_col or case_col not in df.columns):
        raise ValueError(f"Modo avançado requer uma coluna de entidade/caso existente quando case_window=none/use_entity. Recebido: {case_col or 'não definido'}.")
    missing_event_columns = [column for column in event_columns if column not in df.columns]
    if missing_event_columns:
        raise ValueError(f"Colunas selecionadas para evento inexistentes: {missing_event_columns}")

    working = df.copy()
    warnings: list[str] = []
    ignored_columns: list[str] = []
    rules: dict[str, str] = {}
    generated_parts: dict[str, pd.Series] = {}
    structural_columns = {str(time_col).strip().lower()}
    if case_window == "none" and case_col:
        structural_columns.add(str(case_col).strip().lower())
    selected_structural = [column for column in event_columns if str(column).strip().lower() in structural_columns]
    non_structural = [column for column in event_columns if str(column).strip().lower() not in structural_columns]
    if selected_structural:
        warnings.append(
            "Esta coluna é usada para estruturar a sequência e normalmente não deve fazer parte do evento: "
            + ", ".join(selected_structural)
        )
    if selected_structural and not non_structural:
        warnings.append("As colunas selecionadas para o evento são apenas estruturais; recomenda-se usar colunas como asset e signal.")

    for column in event_columns:
        is_numeric = pd.api.types.is_numeric_dtype(working[column]) or pd.to_numeric(working[column], errors="coerce").notna().mean() >= 0.8
        mode = (numeric_discretization.get(column) or "").lower()
        if is_numeric:
            if mode in {"ignore", "ignored"}:
                ignored_columns.append(column)
                rules[column] = "ignored_numeric"
                continue
            if mode in {"variation_pct", "threshold", "thresholds"}:
                generated_parts[column] = discretize_variation_pct(working[column]).map(lambda value: value if value else "UNKNOWN")
                rules[column] = "variation_pct_thresholds"
            elif mode in {"quantile", "quantiles"}:
                generated_parts[column] = discretize_quantile(working[column]).map(lambda value: f"{column}_{value}" if value else "UNKNOWN")
                rules[column] = "quantiles_low_medium_high"
            else:
                warnings.append(f"A coluna numérica '{column}' foi selecionada sem discretização; foi ignorada.")
                ignored_columns.append(column)
                rules[column] = "ignored_numeric_without_discretization"
        else:
            generated_parts[column] = working[column].map(lambda value: sanitize_event_part(value) or "UNKNOWN")
            rules[column] = "categorical_value"

    if not generated_parts:
        raise ValueError("A construção avançada não gerou componentes de evento. Selecione colunas categóricas ou discretize colunas numéricas.")

    def build_event(index: int) -> str | None:
        parts = [series.iloc[index] for series in generated_parts.values()]
        valid_parts = [str(part) for part in parts if normalize_text_value(part)]
        return "_".join(valid_parts) if valid_parts else None

    working["__ramex_event__"] = [build_event(index) for index in range(len(working))]
    working = working.dropna(subset=["__ramex_event__"])  # type: ignore[call-overload]
    working["__ramex_event__"] = working["__ramex_event__"].map(sanitize_event_part)
    working = working.dropna(subset=["__ramex_event__"])  # type: ignore[call-overload]
    if working.empty:
        raise ValueError("As colunas selecionadas existem, mas não produziram eventos válidos. Verifique valores nulos ou regras de discretização.")

    if case_window == "none":
        working["__ramex_case_id__"] = working[case_col or ""].map(normalize_text_value)
    else:
        working["__ramex_case_id__"] = working[time_col].map(lambda value: temporal_window_id(value, case_window))
    working = working.dropna(subset=["__ramex_case_id__"])  # type: ignore[call-overload]

    is_date = pd.api.types.is_datetime64_any_dtype(working[time_col]) or any(
        token in time_col.lower() for token in ["date", "data", "time", "tempo", "timestamp"]
    )
    working["_order"] = pd.to_datetime(working[time_col], errors="coerce") if is_date else pd.to_numeric(working[time_col], errors="coerce")
    if working["_order"].notna().mean() < 0.8:
        raise ValueError(f"A coluna '{time_col}' contém demasiados valores inválidos para ordenação.")

    print("ADVANCED EVENT CONSTRUCTION RESULT", {
        "generated_event_column": "__ramex_event__",
        "generated_case_column": "__ramex_case_id__",
        "sample_events": working["__ramex_event__"].head(10).tolist(),
        "sample_cases": working["__ramex_case_id__"].head(10).tolist(),
        "unique_events": int(working["__ramex_event__"].nunique()),
    }, flush=True)

    working = working.dropna(subset=["_order"]).sort_values(by=["__ramex_case_id__", "_order", "__ramex_event__"], kind="stable")
    sequences = [
        [str(event) for event in seq if normalize_text_value(event)]
        for seq in working.groupby("__ramex_case_id__", sort=False)["__ramex_event__"].apply(list)
    ]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("O modo avançado não gerou sequências com tamanho mínimo 2.")

    unique_events = int(working["__ramex_event__"].nunique())
    if unique_events > 500 or unique_events > max(50, int(len(working) * 0.5)):
        warnings.append("Número elevado de eventos únicos. Considere discretizar ou reduzir colunas.")

    metadata = {
        "mode": "advanced",
        "case_column": case_col if case_window == "none" else None,
        "time_column": time_col,
        "case_window": case_window,
        "event_columns": event_columns,
        "generated_event_column": "__ramex_event__",
        "generated_case_column": "__ramex_case_id__",
        "structural_event_columns": selected_structural,
        "ignored_columns": ignored_columns,
        "numeric_discretization": numeric_discretization,
        "rules": rules,
        "unique_events": unique_events,
        "event_examples": working["__ramex_event__"].dropna().astype(str).head(10).tolist(),
        "preview_rows": working[[*event_columns, "__ramex_case_id__", "_order", "__ramex_event__"]]
            .head(20)
            .rename(columns={"__ramex_case_id__": "generated_case_id", "_order": "time_order", "__ramex_event__": "generated_event"})
            .astype(str)
            .to_dict(orient="records"),
        "warnings": warnings,
        "explanation": (
            "O RAMEX não analisa todas as variáveis tabulares diretamente; transforma variáveis selecionadas "
            "em eventos sequenciais discretos e analisa as transições entre esses eventos."
        ),
    }
    return valid, metadata


def normalize_dataset(
    file_path: Path,
    ds_type: str,
    case_col: str | None,
    time_col: str | None,
    event_col: str | None,
    event_mode: str = "simple",
    event_columns: list[str] | None = None,
    numeric_discretization: dict[str, str] | None = None,
    case_window: str | None = None,
) -> tuple[list[list[str]], dict[str, Any]]:
    if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Extensão inválida. Use .txt, .csv ou .xlsx.")
    if file_path.stat().st_size == 0:
        raise ValueError("O ficheiro está vazio.")

    metadata: dict[str, Any] = {"mode": "simple", "event_column": event_col, "event_columns": [event_col] if event_col else []}
    raw_event_mode = str(event_mode or "simple").strip().lower().replace("-", "_")
    is_advanced_event_mode = raw_event_mode in {"advanced", "advanced_events", "advanced_events_mode"}
    event_mode = "advanced" if is_advanced_event_mode else raw_event_mode
    if event_mode not in {"simple", "advanced"}:
        raise ValueError("Modo de eventos inválido. Use simple ou advanced.")

    if is_advanced_event_mode:
        df_columns = []
        try:
            df_columns = list(read_table(file_path, nrows=0).columns)
        except Exception:
            pass
        print("UPLOAD CONFIG BEFORE PARSE", {
            "dataset_type": ds_type,
            "event_mode": event_mode,
            "case_column": case_col,
            "entity_column": case_col,
            "time_column": time_col,
            "event_column": event_col,
            "event_columns": event_columns,
            "case_window": case_window,
            "df_columns": df_columns,
        }, flush=True)

    if is_advanced_event_mode:
        if time_col is None:
            raise ValueError("Mapeamento de tempo incompleto para modo avançado.")
        sequences, metadata = load_advanced_event_sequences(
            file_path, case_col, time_col, event_columns or [], numeric_discretization, case_window
        )
    elif ds_type == "simple_sequences":
        sequences = load_simple_sequences(file_path)
    elif ds_type == "event_table":
        if case_col is None or time_col is None or event_col is None:
            df_columns = []
            try:
                df_columns = list(read_table(file_path, nrows=0).columns)
            except Exception:
                pass
            print("EVENT_TABLE_MAPPING_ERROR_CONTEXT", {
                "dataset_type": ds_type,
                "event_mode": event_mode,
                "is_advanced_event_mode": is_advanced_event_mode,
                "case_column": case_col,
                "entity_column": case_col,
                "time_column": time_col,
                "order_column": time_col,
                "event_column": event_col,
                "event_columns": event_columns,
                "case_window": case_window,
                "df_columns": df_columns,
            }, flush=True)
            raise ValueError("Mapeamento de colunas incompleto para tabela de eventos.")
        sequences = load_event_table_sequences(file_path, case_col, time_col, event_col)
    elif ds_type == "customer_excel":
        sequences = load_event_table_sequences(
            file_path,
            case_col or "Customer ID",
            time_col or "Order Date",
            event_col or "Category",
        )
        metadata = {"mode": "simple", "event_column": event_col or "Category", "event_columns": [event_col or "Category"]}
    else:
        raise ValueError("Tipo de dataset desconhecido.")

    sequences = [[k for k, _ in groupby(seq)] for seq in sequences]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("Todas as sequências foram descartadas por terem tamanho inferior a 2.")
    metadata["sequence_count"] = len(valid)
    metadata["sample_sequences"] = valid[:3]
    return valid, metadata


def build_pair_frequencies(sequences: list[list[str]]) -> pd.DataFrame:
    pairs = [(a, b) for seq in sequences for a, b in zip(seq, seq[1:])]
    df = pd.DataFrame([{"From": u, "To": v, "Weight": w} for (u, v), w in Counter(pairs).items()])
    return df.sort_values(by="Weight", ascending=False, kind="stable").reset_index(drop=True)


SOURCE_NODE = "SOURCE"
SINK_NODE = "SINK"


def build_ramex2007_ordered_events(sequences: list[list[str]]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for sequence_index, sequence in enumerate(sequences, start=1):
        customer = f"C{sequence_index:05d}"
        for position, item in enumerate(sequence, start=1):
            rows.append({
                "customer": customer,
                "timestamp": position,
                "item": str(item),
                "sequence_position": position,
            })
    return pd.DataFrame(rows, columns=["customer", "timestamp", "item", "sequence_position"])


def build_forum_temporal_events(sequences: list[list[str]]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for sequence_index, sequence in enumerate(sequences, start=1):
        entity = f"E{sequence_index:05d}"
        for position, signal in enumerate(sequence, start=1):
            rows.append({
                "entity": entity,
                "timestamp": position,
                "signal": str(signal),
            })
    return pd.DataFrame(rows, columns=["entity", "timestamp", "signal"])


def build_ramex2007_sequences(ordered_df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for customer, group in ordered_df.groupby("customer", sort=False):
        items = [str(item) for item in group["item"].tolist()]
        timestamps = group["timestamp"].tolist()
        for index, item in enumerate(items):
            rows.append({
                "customer": str(customer),
                "timestamp": timestamps[index],
                "item": item,
                "next_item": items[index + 1] if index + 1 < len(items) else SINK_NODE,
                "sequence_position": index + 1,
            })
    return pd.DataFrame(rows, columns=["customer", "timestamp", "item", "next_item", "sequence_position"])


def build_ramex2007_graph_edges(sequences: list[list[str]]) -> pd.DataFrame:
    transitions: list[tuple[str, str, str]] = []
    for sequence in sequences:
        if not sequence:
            continue
        items = [str(item) for item in sequence]
        transitions.append((SOURCE_NODE, items[0], "source_transition"))
        transitions.extend((source, target, "normal_transition") for source, target in zip(items, items[1:]))
        transitions.append((items[-1], SINK_NODE, "sink_transition"))

    counter = Counter(transitions)
    rows = [
        {"From": source, "To": target, "Weight": weight, "TransitionType": transition_type}
        for (source, target, transition_type), weight in counter.items()
    ]
    return pd.DataFrame(rows, columns=["From", "To", "Weight", "TransitionType"]).sort_values(
        by=["TransitionType", "Weight", "From", "To"],
        ascending=[True, False, True, True],
        kind="stable",
    ).reset_index(drop=True)


def draw_adjacency_heatmap(matrix_df: pd.DataFrame, output_png: Path) -> None:
    if matrix_df.empty:
        return
    limit = min(60, matrix_df.shape[0], matrix_df.shape[1])
    view = matrix_df.iloc[:limit, :limit]
    fig_size = max(8, min(18, limit * 0.34))
    fig, ax = plt.subplots(figsize=(fig_size, fig_size), dpi=140)
    image = ax.imshow(view.values, cmap="YlGnBu", aspect="auto")
    ax.set_title("RAMEX 2007 - Matriz de Adjacencia", fontsize=12, fontweight="bold")
    ax.set_xlabel("Destino")
    ax.set_ylabel("Origem")
    ax.set_xticks(range(limit))
    ax.set_yticks(range(limit))
    ax.set_xticklabels([str(col) for col in view.columns], rotation=90, fontsize=6)
    ax.set_yticklabels([str(idx) for idx in view.index], fontsize=6)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04, label="Frequencia absoluta")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()


def build_adjacency_matrix(edges_df: pd.DataFrame) -> pd.DataFrame:
    nodes = sorted(set(edges_df["From"]) | set(edges_df["To"]))
    matrix = pd.DataFrame(0, index=nodes, columns=nodes, dtype=int)
    for row in edges_df.to_dict(orient="records"):
        matrix.at[as_str(row.get("From")), as_str(row.get("To"))] = as_int(row.get("Weight"))
    return matrix


def filter_edges(edges_df: pd.DataFrame, min_freq: float | None, top_n: int | None) -> pd.DataFrame:
    df = edges_df.copy()
    if min_freq and min_freq > 0:
        df = df[df["Weight"] >= min_freq]
    df = df.sort_values(by="Weight", ascending=False, kind="stable")  # type: ignore[call-overload]
    if top_n and top_n > 0:
        df = df.head(top_n)
    return df.reset_index(drop=True)  # type: ignore[return-value]


def build_graph(edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    graph.add_weighted_edges_from(edges_df[["From", "To", "Weight"]].itertuples(index=False))
    return graph


def calculate_centrality(graph: nx.DiGraph) -> dict[str, float]:
    try:
        cent = nx.pagerank(graph, weight="weight")
    except Exception:
        cent = nx.degree_centrality(graph)

    if not cent:
        return {str(n): 0.0 for n in graph.nodes}
    max_c = max(cent.values()) or 1.0
    return {str(n): float(v) / max_c for n, v in cent.items()}


def choose_root(graph: nx.DiGraph, centrality: dict[str, float] | None = None) -> str:
    for node in graph.nodes:
        if str(node).upper() == "START":
            return str(node)

    cent = centrality or {}
    cands = [
        (str(n), sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), cent.get(str(n), 0.0), graph.out_degree(n))
        for n in graph.nodes
    ]
    return min(cands, key=lambda x: (-x[1], -x[2], -x[3], x[0]))[0]


def build_ramex_simplified(graph: nx.DiGraph) -> tuple[nx.DiGraph, pd.DataFrame, str]:
    if not graph.edges:
        raise ValueError("Não existem arestas para construir RAMEX simplificado.")

    root = choose_root(graph)
    tree = nx.DiGraph()
    tree.add_node(root)
    visited, levels, selected = {root}, {root: 0}, []

    while True:
        cands = [(u, v, d["weight"]) for u in visited for _, v, d in graph.out_edges(u, data=True) if v not in visited]
        if not cands:
            break

        u, v, w = min(cands, key=lambda e: (-e[2], str(e[0]), str(e[1])))
        tree.add_edge(u, v, weight=w)

        if not nx.is_directed_acyclic_graph(tree):
            tree.remove_edge(u, v)
            visited.add(v)
            continue

        visited.add(v)
        levels[v] = levels[u] + 1
        selected.append({"From": u, "To": v, "Weight": w, "Level": levels[v]})

    if not selected:
        raise ValueError("Não foi possível selecionar arestas para a estrutura RAMEX.")
    return tree, pd.DataFrame(selected), root


def build_ramex_polytree(
    graph: nx.DiGraph, root: str, top_k: int = 2, max_depth: int = 5, min_weight: float | None = None
) -> tuple[nx.DiGraph, pd.DataFrame]:
    queue, selected, seen = deque([(root, 0, [root])]), [], set()

    while queue:
        curr, lvl, path = queue.popleft()
        if lvl >= max_depth:
            continue

        out_edges = [
            (str(curr), str(v), d["weight"])
            for _, v, d in graph.out_edges(curr, data=True)
            if v not in path and (min_weight is None or d["weight"] >= min_weight)
        ]
        out_edges.sort(key=lambda e: (-e[2], e[1]))

        for u, v, w in out_edges[:top_k]:
            parent_path = " -> ".join(path)
            if (u, v, parent_path) in seen:
                continue
            seen.add((u, v, parent_path))
            selected.append({
                "From": u, "To": v, "Weight": w, "Level": lvl + 1,
                "ParentPath": parent_path, "Strategy": "top-k",
                "Score": "", "Reason": "Selecionada via top-K de peso na origem",
            })
            queue.append((v, lvl + 1, path + [v]))

    if not selected:
        raise ValueError("Não foi possível selecionar arestas para a Poly-tree.")

    df = pd.DataFrame(selected)
    tree = nx.DiGraph()
    for r in df.itertuples(index=False):
        if tree.has_edge(r.From, r.To):
            tree[r.From][r.To]["weight"] = max(tree[r.From][r.To]["weight"], r.Weight)
            tree[r.From][r.To]["occurrences"] += 1
        else:
            tree.add_edge(r.From, r.To, weight=r.Weight, occurrences=1)

    return tree, df


def explain_multiobjective(nw: float, tp: float, cg: float, tc: float, rp: float) -> str:
    if nw >= 0.7 and tp >= 0.5:
        return "alto peso e elevada probabilidade local"
    if cg >= 0.05:
        return "boa cobertura global"
    if tc >= 0.65:
        return "destino central no grafo"
    if rp > 0 and nw >= 0.35:
        return "penalizada por redundância, mas mantida por peso elevado"
    return "selecionada por equilíbrio entre peso, cobertura e centralidade"


def build_ramex_polytree_multiobjective(graph: nx.DiGraph, root: str, **kw) -> tuple[nx.DiGraph, pd.DataFrame]:
    orig_sum = sum(d["weight"] for _, _, d in graph.edges(data=True))
    if orig_sum <= 0:
        raise ValueError("O grafo não contém peso suficiente para construir a Poly-tree.")

    max_w = max((d["weight"] for _, _, d in graph.edges(data=True)), default=1.0) or 1.0
    out_w = {str(n): sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)) for n in graph.nodes}
    cent = calculate_centrality(graph)

    frontier, selected, seen = [(root, [root])], [], set()
    rep_nodes, sel_from = {root: 1}, {}
    pres_sum = 0.0

    for lvl in range(kw["max_depth"]):
        if not frontier or pres_sum / orig_sum >= kw["preserve_weight_target"]:
            break

        cands = []
        for curr, path in frontier:
            for _, tgt, d in graph.out_edges(curr, data=True):
                u, v, w = str(curr), str(tgt), float(d["weight"])
                if (kw["min_weight"] and w < kw["min_weight"]) or v in path or sel_from.get(u, 0) >= kw["max_branching"]:
                    continue

                nw = w / max_w
                tp = w / out_w.get(u, w) if out_w.get(u, 0) else 0
                cg = w / orig_sum if (u, v) not in seen else 0.0
                tc = cent.get(v, 0.0)
                rp = rep_nodes.get(v, 0) / max(1, len(selected))
                cp = min(1.0, ((lvl + 1) / max(1, kw["max_depth"])) + (sel_from.get(u, 0) / max(1, kw["max_branching"])))

                score = kw["alpha"]*nw + kw["beta"]*tp + kw["gamma"]*cg + kw["delta"]*tc - kw["epsilon"]*rp - kw["zeta"]*cp
                if score >= kw["min_score"]:
                    cands.append({
                        "source": u, "target": v, "weight": w, "score": score,
                        "parent_path": " -> ".join(path), "path": path + [v],
                        "reason": explain_multiobjective(nw, tp, cg, tc, rp),
                    })

        cands.sort(key=lambda x: (-x["score"], -x["weight"], x["target"]))
        next_frontier, sel_lvl = [], 0

        for c in cands:
            if sel_lvl >= kw["max_branching"]:
                break
            if sel_from.get(c["source"], 0) >= kw["max_branching"]:
                continue

            selected.append({
                "From": c["source"], "To": c["target"], "Weight": c["weight"],
                "Level": lvl + 1, "ParentPath": c["parent_path"],
                "Strategy": "multiobjective", "Score": round(c["score"], 6), "Reason": c["reason"],
            })
            sel_lvl += 1
            sel_from[c["source"]] = sel_from.get(c["source"], 0) + 1
            if (c["source"], c["target"]) not in seen:
                seen.add((c["source"], c["target"]))
                pres_sum += c["weight"]
            rep_nodes[c["target"]] = rep_nodes.get(c["target"], 0) + 1
            next_frontier.append((c["target"], c["path"]))
            if pres_sum / orig_sum >= kw["preserve_weight_target"]:
                break

        frontier = next_frontier

    if not selected:
        raise ValueError("Não foi possível selecionar arestas multiobjetivo.")

    df = pd.DataFrame(selected)
    numeric_scores: pd.Series = pd.to_numeric(df["Score"], errors="coerce")  # type: ignore[assignment]
    if df.empty or bool(numeric_scores.isna().any()):
        raise ValueError("Estratégia multiobjetivo falhou: scores inválidos.")

    tree = nx.DiGraph()
    for r in df.itertuples(index=False):
        if tree.has_edge(r.From, r.To):
            tree[r.From][r.To]["weight"] = max(tree[r.From][r.To]["weight"], r.Weight)
            tree[r.From][r.To]["occurrences"] += 1
        else:
            tree.add_edge(r.From, r.To, weight=r.Weight, occurrences=1)

    return tree, df


_DRAW_EDGE_LIMIT = 300  # acima deste valor usa path rápido (LineCollection)
_DRAW_LABEL_LIMIT = 80  # acima deste valor omite labels nas arestas

# ---------------------------------------------------------------------------
# Helpers de layout
# ---------------------------------------------------------------------------

def _graphviz_layout_safe(g: nx.DiGraph, prog: str, fallback_prog: str | None = None) -> dict:
    """Tenta graphviz; se falhar usa spring_layout."""
    for p in ([prog] + ([fallback_prog] if fallback_prog else [])):
        try:
            return nx.nx_agraph.graphviz_layout(g, prog=p)
        except Exception:
            pass
    return nx.spring_layout(g, seed=42, k=2.5, iterations=60)


def _scale_node_sizes(g: nx.DiGraph, base: int, scale: int) -> list[int]:
    """Tamanho de nó proporcional ao grau total (in+out), com mínimo garantido."""
    degrees = dict(g.degree())
    max_deg = max(degrees.values(), default=1) or 1
    return [base + int(scale * degrees[n] / max_deg) for n in g.nodes]


# ---------------------------------------------------------------------------
# draw_graph — ponto de entrada principal
# ---------------------------------------------------------------------------

def draw_graph(graph: nx.DiGraph, output_png: Path, root: str | None = None) -> None:
    if not graph.edges:
        return

    from matplotlib.patches import FancyArrowPatch  # type: ignore
    from matplotlib.patheffects import withStroke  # type: ignore

    n = graph.number_of_nodes()
    is_small = n <= 12
    all_edges = list(graph.edges(data=True))
    is_dense = len(all_edges) > _DRAW_EDGE_LIMIT

    # ---- filtrar arestas para visualização ----
    if is_dense:
        all_edges_sorted = sorted(all_edges, key=lambda e: float(e[2].get("weight", 0)), reverse=True)
        draw_edges = all_edges_sorted[:_DRAW_EDGE_LIMIT]
        draw_graph_view = nx.DiGraph()
        draw_graph_view.add_nodes_from(graph.nodes)
        for u, v, d in draw_edges:
            draw_graph_view.add_edge(u, v, **d)
    else:
        draw_graph_view = graph
        draw_edges = all_edges

    # ---- layout ----
    if is_small:
        pos = nx.circular_layout(draw_graph_view, scale=2.0)
        figsize = (18, 16)
        dpi = 300
        base_node = 3200
        scale_node = 2400
        font_sz = 13
    elif is_dense:
        # Grafo completo/denso: sfdp (força-dirigido esparso) — melhor que spring para muitos nós
        pos = _graphviz_layout_safe(draw_graph_view, "sfdp", "fdp")
        figsize = (26, 22)
        dpi = 180
        base_node = 220
        scale_node = 600
        font_sz = 7
    elif root:
        # Árvore / arborescência: layout hierárquico com dot
        pos = _graphviz_layout_safe(draw_graph_view, "dot")
        figsize = (30, 24)
        dpi = 200
        base_node = 800
        scale_node = 2000
        font_sz = 10
    else:
        # DAG sem root explícita: neato ou spring
        pos = _graphviz_layout_safe(draw_graph_view, "neato")
        figsize = (24, 20)
        dpi = 200
        base_node = 800
        scale_node = 2000
        font_sz = 10

    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    max_w = max((float(d.get("weight", 1)) for _, _, d in draw_edges), default=1) or 1

    # ---- arestas ----
    if is_dense:
        edge_list_pairs = [(u, v) for u, v, _ in draw_edges]
        widths = [0.4 + 2.8 * (float(d.get("weight", 1)) / max_w) for _, _, d in draw_edges]
        nx.draw_networkx_edges(
            draw_graph_view, pos,
            edgelist=edge_list_pairs,
            width=widths,
            edge_color="#315f72",
            alpha=0.45,
            arrows=True,
            arrowstyle="-|>",
            arrowsize=8,
            ax=ax,
        )
    else:
        curve_radius = 0.35 if is_small else 0.15
        bidirectional: set[tuple[str, str]] = set()
        for u, v, _ in draw_edges:
            if graph.has_edge(v, u) and (v, u) not in bidirectional and (u, v) not in bidirectional:
                bidirectional.add((u, v))

        for u, v, data in draw_edges:
            x1, y1 = pos[u]
            x2, y2 = pos[v]
            weight = float(data.get("weight", 1))
            width = 0.8 + (4.5 if is_small else 3.8) * (weight / max_w)
            if (u, v) in bidirectional:
                cs = f"arc3,rad={curve_radius}"
            elif (v, u) in bidirectional:
                cs = f"arc3,rad={-curve_radius}"
            else:
                cs = "arc3,rad=0"
            ax.add_patch(FancyArrowPatch(
                (x1, y1), (x2, y2),
                connectionstyle=cs,
                arrowstyle="-|>",
                mutation_scale=28 if is_small else 18,
                linewidth=width,
                color="#315f72",
                alpha=0.80,
                zorder=1,
            ))

    # ---- nós ----
    node_sizes = _scale_node_sizes(draw_graph_view, base_node, scale_node)
    colors = ["#f9cb9c" if root and node == root else "#dceef5" for node in draw_graph_view.nodes]
    nx.draw_networkx_nodes(
        draw_graph_view, pos,
        node_size=node_sizes,
        node_color=colors,
        edgecolors="#315f72",
        linewidths=2.5 if is_small else 1.8,
        ax=ax,
    )
    nx.draw_networkx_labels(
        draw_graph_view, pos,
        font_size=font_sz,
        font_weight="bold",
        font_color="#0f172a",
        ax=ax,
    )

    # ---- labels nas arestas ----
    show_labels = len(draw_edges) <= _DRAW_LABEL_LIMIT
    if show_labels:
        edge_labels = {
            (u, v): int(w) if float(w).is_integer() else round(w, 2)
            for u, v, d in draw_edges
            for w in [float(d.get("weight", 1))]
        }
        if is_small:
            for (u, v), label in edge_labels.items():
                x = (pos[u][0] + pos[v][0]) / 2
                y = (pos[u][1] + pos[v][1]) / 2
                text = ax.text(
                    x, y, str(label), fontsize=10, ha="center", va="center",
                    fontweight="bold", color="#315f72",
                    bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor="none", alpha=0.88),
                )
                text.set_path_effects([withStroke(linewidth=2, foreground="white")])  # type: ignore[arg-type]
        else:
            nx.draw_networkx_edge_labels(
                draw_graph_view, pos, edge_labels=edge_labels,
                font_size=max(7, font_sz - 2), ax=ax,
                bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor="none", alpha=0.75),
            )

    output_name = output_png.name.lower()
    if "ramex_simplificado" in output_name:
        title = "RAMEX simplificado experimental - baseline heuristico"
    elif "ramex_polytree" in output_name:
        title = "Poly-tree experimental - visualizacao exploratoria"
    elif "grafo" in output_name:
        title = "Grafo observado completo - rede original de transicoes"
    else:
        title = "Visualizacao da rede RAMEX"
    if is_dense:
        title = f"{title}\nTop {len(draw_edges)} de {len(all_edges)} arestas para legibilidade"
    ax.set_title(title, fontsize=12 if not is_dense else 10, color="#0f172a", pad=8)
    ax.margins(0.18 if is_small else 0.12)
    ax.axis("off")
    plt.tight_layout(pad=2.5 if is_small else 1.5)
    plt.savefig(output_png, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close()


def matrix_to_json(df: pd.DataFrame, limit: int = 40) -> dict[str, Any]:
    lim = df.iloc[:limit, :limit]
    return {
        "columns": [""] + [str(c) for c in lim.columns],
        "rows": [{"": str(i), **{str(c): int(v) for c, v in row.items()}} for i, row in lim.iterrows()],
        "total_rows": df.shape[0],
        "total_columns": df.shape[1],
        "is_truncated": df.shape[0] > limit or df.shape[1] > limit,
    }


def edges_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    return [{str(k): v for k, v in rec.items()} for rec in records]


def graph_weight_sum(graph: nx.DiGraph) -> float:
    return float(sum(float(d.get("weight", 0.0) or 0.0) for _, _, d in graph.edges(data=True)))


def dataframe_to_digraph(df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    if df is None or df.empty:
        return graph
    for row in df.to_dict(orient="records"):
        source = str(row.get("From") or row.get("from") or "").strip()
        target = str(row.get("To") or row.get("to") or "").strip()
        try:
            weight = float(row.get("Weight", row.get("weight", 0)) or 0)
        except (TypeError, ValueError):
            weight = 0.0
        if source and target and weight > 0:
            graph.add_edge(source, target, weight=weight)
    return graph


def edge_records_to_digraph(records: list[dict[str, Any]] | None) -> nx.DiGraph:
    graph = nx.DiGraph()
    for row in records or []:
        source = str(row.get("from") or row.get("From") or "").strip()
        target = str(row.get("to") or row.get("To") or "").strip()
        try:
            weight = float(row.get("weight", row.get("Weight", 0)) or 0)
        except (TypeError, ValueError):
            weight = 0.0
        if source and target and weight > 0:
            graph.add_edge(source, target, weight=weight)
    return graph


def calculate_coverage_metrics(
    original_graph: nx.DiGraph,
    filtered_graph: nx.DiGraph,
    ramex_graph: nx.DiGraph,
) -> dict[str, Any]:
    original_nodes_set = {str(n) for n in original_graph.nodes}
    filtered_nodes_set = {str(n) for n in filtered_graph.nodes}
    ramex_nodes_set = {str(n) for n in ramex_graph.nodes}
    uncovered_nodes = sorted(original_nodes_set - ramex_nodes_set)

    original_nodes = len(original_nodes_set)
    filtered_nodes = len(filtered_nodes_set)
    ramex_nodes = len(ramex_nodes_set)
    original_edges = original_graph.number_of_edges()
    filtered_edges = filtered_graph.number_of_edges()
    ramex_edges = ramex_graph.number_of_edges()
    original_weight = graph_weight_sum(original_graph)
    filtered_weight = graph_weight_sum(filtered_graph)
    ramex_weight = graph_weight_sum(ramex_graph)
    node_coverage_percent = (ramex_nodes / original_nodes * 100) if original_nodes else 0.0
    preserved_weight_percent = (ramex_weight / original_weight * 100) if original_weight else 0.0
    disconnected_components_count = (
        nx.number_weakly_connected_components(original_graph) if original_graph.number_of_nodes() else 0
    )

    warning_messages: list[str] = []
    removed_nodes_count = original_nodes - filtered_nodes
    removed_edges_count = original_edges - filtered_edges
    removed_weight = original_weight - filtered_weight

    if removed_nodes_count > 0:
        warning_messages.append(
            f"{removed_nodes_count} nó(s) existem no grafo completo mas não aparecem no grafo filtrado atual."
        )
    if removed_edges_count > 0:
        warning_messages.append(
            f"{removed_edges_count} aresta(s) foram removidas por filtros antes da construção do grafo atual."
        )
    if uncovered_nodes:
        warning_messages.append(
            f"{len(uncovered_nodes)} nó(s) do grafo completo não aparecem na estrutura RAMEX atual."
        )
    if filtered_nodes < original_nodes:
        warning_messages.append("O grafo filtrado tem menos nós do que o grafo completo.")
    if disconnected_components_count > 1:
        warning_messages.append(
            f"O grafo completo tem {disconnected_components_count} componentes fracamente conexas."
        )
    # Nota: preserved_weight_percent refere-se à heurística greedy experimental (RAMEX base),
    # não ao RAMEX 2007 formal. Condensação abaixo de 20% é esperada em grafos densos —
    # o RAMEX 2007 formal reporta o seu próprio peso preservado separadamente.

    return {
        "original_nodes": original_nodes,
        "original_edges": original_edges,
        "filtered_nodes": filtered_nodes,
        "filtered_edges": filtered_edges,
        "ramex_nodes": ramex_nodes,
        "ramex_edges": ramex_edges,
        "uncovered_nodes": uncovered_nodes,
        "uncovered_nodes_count": len(uncovered_nodes),
        "node_coverage_percent": node_coverage_percent,
        "original_weight": original_weight,
        "filtered_weight": filtered_weight,
        "ramex_weight": ramex_weight,
        "preserved_weight_percent": preserved_weight_percent,
        "removed_by_filter_edges": removed_edges_count,
        "removed_by_filter_weight": removed_weight,
        "disconnected_components_count": disconnected_components_count,
        "warning_messages": warning_messages,
        "methodological_note": (
            "node_coverage_percent e preserved_weight_percent são métricas auxiliares do projeto "
            "para avaliar a condensação estrutural. Não estão definidas nos artigos RAMEX originais."
        ),
    }


def calculate_metrics(g_orig: nx.DiGraph, g_poly: nx.DiGraph, df_poly: pd.DataFrame) -> dict[str, Any]:
    w_orig = sum(d["weight"] for _, _, d in g_orig.edges(data=True))
    w_poly = sum(d["weight"] for _, _, d in g_poly.edges(data=True))
    branching = df_poly.groupby("From")["To"].count() if not df_poly.empty else pd.Series(dtype=float)

    return {
        "original_nodes": g_orig.number_of_nodes(),
        "original_edges": g_orig.number_of_edges(),
        "polytree_nodes": g_poly.number_of_nodes(),
        "polytree_edges": len(df_poly),
        "original_weight_sum": w_orig,
        "polytree_weight_sum": w_poly,
        "preserved_weight_percent": (w_poly / w_orig * 100) if w_orig > 0 else 0,
        "max_depth": int(df_poly["Level"].max()) if not df_poly.empty else 0,
        "average_branching": float(branching.mean()) if not branching.empty else 0.0,
        "repeated_nodes": int(df_poly["To"].duplicated().sum()) if "To" in df_poly else 0,
        "density_before": nx.density(g_orig) if g_orig.number_of_nodes() > 1 else 0,
        "density_after": nx.density(g_poly) if g_poly.number_of_nodes() > 1 else 0,
        "edge_reduction_percent": (1 - g_poly.number_of_edges() / max(1, g_orig.number_of_edges())) * 100,
        "coverage_by_level": {str(l): float(g["Weight"].sum()) for l, g in df_poly.groupby("Level")} if not df_poly.empty else {},
    }


def polytree_to_json(g_orig: nx.DiGraph, g_poly: nx.DiGraph, df_poly: pd.DataFrame, root: str, strat: str, params: dict) -> dict:
    metrics = calculate_metrics(g_orig, g_poly, df_poly)
    levels = {root: 0}
    for row in df_poly.sort_values("Level", kind="stable").to_dict(orient="records"):
        src, dst = as_str(row.get("From")), as_str(row.get("To"))
        level = max(as_int(row.get("Level")), 0)
        prev_level = max(level - 1, 0)
        levels[src] = min(levels.get(src, prev_level), prev_level)
        levels[dst] = min(levels.get(dst, level), level)

    return {
        "artifact_type": "simplified_polytree_experimental",
        "metadata": artifact_meta("simplified_ramex"),
        "interpretation": "Poly-tree exploratória gerada como baseline heurístico; não representa o RAMEX 2007 formal.",
        "root": root,
        "strategy": strat,
        "metrics": metrics | {"strategy": strat},
        "parameters": params,
        "nodes": [{"id": n, "level": l} for n, l in sorted(levels.items(), key=lambda x: (x[1], x[0]))],
        "edges": edges_to_records(df_poly),
        "scoring_formula": "score = alpha*nw + beta*tp + gamma*cg + delta*tc - epsilon*rp - zeta*cp" if strat == "multiobjective" else "top-k",
    }


def interpret(metrics: dict) -> str:
    nodes, edges, dens, pres = metrics["nodes"], metrics["edges"], metrics["density"], metrics["preserved_percentage"]
    total_w = metrics["total_weight"]
    avg_w = total_w / edges if edges else 0

    # Dataset sem repetição de pares (ex: Dataset 02 — todos com frequência 1)
    if edges > 0 and abs(total_w - edges) < 0.01:
        headline = (
            "Dataset sem repetição de pares — cada transição ocorre exatamente uma vez. "
            "O RAMEX produz uma arborescência válida, mas os padrões globais têm valor analítico limitado "
            "porque não existe recorrência suficiente para distinguir transições dominantes."
        )
    elif nodes <= 10 and avg_w >= 5:
        headline = "O dataset apresenta padrões sequenciais fortes e recorrentes."
    elif nodes >= 100 and dens >= 0.2:
        headline = "Grafo denso, requer filtragem para melhorar a leitura."
    elif nodes >= 50 and avg_w <= 1.5:
        headline = "Transições muito únicas, limitando a extração global."
    else:
        headline = "O dataset apresenta estrutura intermédia."

    return " ".join([
        headline,
        "O desempenho do RAMEX é diretamente condicionado pela estrutura do grafo, nomeadamente pela densidade, repetição de transições e presença de caminhos dominantes.",
        f"A percentagem de peso preservado reflete diretamente a capacidade do RAMEX em identificar padrões dominantes no conjunto de dados ({pres:.2f}%).",
    ])


def script_path(name: str) -> Path:
    return Path(__file__).resolve().parents[1] / "scripts" / name


def run_python_script(args: list[str], log_cb: LogCallback | None = None, step_name: str | None = None) -> None:
    command = [sys.executable, *args]
    repo_root = Path(__file__).resolve().parents[1]
    if log_cb:
        log_cb(f"Comando executado ({step_name or Path(args[0]).name}): {' '.join(command)}")
    result = subprocess.run(
        command,
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "erro sem detalhe"
        raise ValueError(
            f"Falha ao executar {step_name or Path(args[0]).name}. "
            f"Comando: {' '.join(command)}. Detalhe: {detail}"
        )


def choose_max_out_weight_root(edges_df: pd.DataFrame) -> str:
    """
    Escolhe a raiz para o Forward heurístico.
    Prioridade:
      1. Nós com in-degree 0 no grafo observado (início natural das sequências),
         desempatados por maior peso de saída.
      2. Se nenhum nó tiver in-degree 0, usa o nó com maior peso de saída total.
    """
    if edges_df.empty:
        raise ValueError("Não foi possível escolher raiz por peso de saída.")
    out_weight = edges_df.groupby("From")["Weight"].sum()
    all_nodes = set(edges_df["From"].astype(str)) | set(edges_df["To"].astype(str))
    nodes_with_incoming = set(edges_df["To"].astype(str))
    zero_indegree = sorted(all_nodes - nodes_with_incoming)
    if zero_indegree:
        # Entre os nós sem entradas, escolher o de maior peso de saída
        best = max(zero_indegree, key=lambda n: float(out_weight.get(n, 0)))
        return str(best)
    # Fallback: maior peso de saída global
    return str(out_weight.sort_values(ascending=False).index[0])


def pure_anchor(payload: dict[str, Any]) -> str:
    if root := payload.get("root"):
        return str(root)
    initial = payload.get("initial_edge") or {}
    if initial:
        return f"{initial.get('from')} -> {initial.get('to')}"
    return "Sem dados gerados"


def pure_validation_rows(ramex2007: dict[str, Any], forward: dict[str, Any], back_forward: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for label, payload in [
        ("RAMEX 2007 formal", ramex2007),
        ("Forward Heuristic", forward),
        ("Back-and-Forward Poly-tree", back_forward),
    ]:
        m = payload.get("metrics", {})
        rows.append({
            "Algoritmo": label,
            "Metodo": payload.get("method", payload.get("algorithm")),
            "Nos selecionados": m.get("selected_nodes"),
            "Arestas selecionadas": m.get("selected_edges"),
            "Soma pesos selecionados": m.get("selected_weight_sum"),
            "Peso preservado (%)": m.get("preserved_weight_percent"),
            "Aciclico": m.get("is_acyclic") if "is_acyclic" in m else m.get("is_dag"),
            "Conectado": m.get("is_connected"),
            "Raiz ou aresta inicial": pure_anchor(payload),
        })
    return rows


def structural_type(nodes: int, density: float, ramex2007_preserved: float) -> str:
    if nodes <= 10 and density >= 0.7:
        return "grafo pequeno e completo"
    if density >= 0.7:
        return "grafo denso"
    if density <= 0.05 and ramex2007_preserved >= 80:
        return "grafo quase linear"
    return "grafo sequencial intermédio"


def run_pure_ramex_outputs(
    output_dir: Path,
    job_id: str,
    graph_edges_csv: Path,           # CSV para 10A (grafo G com SOURCE/SINK)
    graph_edges_df: pd.DataFrame,    # DataFrame do grafo G (com SOURCE/SINK)
    metrics: dict[str, Any],
    progress_cb: ProgressCallback | None = None,
    log_cb: LogCallback | None = None,
    clean_graph_edges_csv: Path | None = None,    # CSV para 10B/10C (grafo observado sem SOURCE/SINK)
    clean_graph_edges_df: pd.DataFrame | None = None,  # DataFrame sem SOURCE/SINK
) -> dict[str, Any]:
    output_dir = output_dir.resolve()
    graph_edges_csv = graph_edges_csv.resolve()
    # 10B e 10C devem usar o grafo observado puro (sem SOURCE/SINK) — RAMEX 2015
    # Se não for fornecido, derivar do grafo G excluindo os nós virtuais
    _virtual = {SOURCE_NODE, SINK_NODE}
    if clean_graph_edges_csv is not None and clean_graph_edges_csv.exists():
        heuristic_csv = clean_graph_edges_csv.resolve()
        heuristic_df = clean_graph_edges_df if clean_graph_edges_df is not None else pd.read_csv(heuristic_csv)
    else:
        # Fallback: filtrar SOURCE/SINK do próprio grafo G
        heuristic_df = graph_edges_df[
            ~graph_edges_df["From"].astype(str).isin(_virtual) &
            ~graph_edges_df["To"].astype(str).isin(_virtual)
        ].copy()
        _heuristic_tmp = output_dir / f"heuristic_graph_edges_{job_id}.csv"
        heuristic_df.to_csv(_heuristic_tmp, index=False)
        heuristic_csv = _heuristic_tmp
    files = {
        "ramex2007_csv": f"ramex2007_{job_id}.csv",
        "ramex2007_json": f"ramex2007_{job_id}.json",
        "ramex2007_png": f"ramex2007_{job_id}.png",
        "ramex2007_edges_csv": "ramex2007_edges.csv",
        "ramex2007_nodes_csv": "ramex2007_nodes.csv",
        "ramex2007_tree_json": "ramex2007_tree.json",
        "ramex2007_metrics_json": "ramex2007_metrics.json",
        "ramex2007_tree_png": "ramex2007_tree.png",
        "ramex2007_expanded_paths_csv": f"ramex2007_expanded_paths_{job_id}.csv",
        "forward_csv": f"ramex_forward_{job_id}.csv",
        "forward_json": f"ramex_forward_{job_id}.json",
        "forward_png": f"ramex_forward_{job_id}.png",
        "forward_metrics_json": "forward_metrics.json",
        "back_forward_formal_csv": f"ramex_back_forward_formal_{job_id}.csv",
        "back_forward_formal_json": f"ramex_back_forward_formal_{job_id}.json",
        "back_forward_formal_png": f"ramex_back_forward_formal_{job_id}.png",
        "back_forward_polytree_formal_edges_csv": "back_forward_polytree_formal_edges.csv",
        "back_forward_polytree_formal_json": "back_forward_polytree_formal.json",
        "back_forward_polytree_formal_metrics_json": "back_forward_polytree_formal_metrics.json",
        "back_forward_polytree_formal_hierarchical_png": "back_forward_polytree_formal_hierarchical.png",
        "back_forward_polytree_formal_neato_optional_png": "back_forward_polytree_formal_neato_optional.png",
        "validation_pure_csv": f"validacao_ramex_puro_{job_id}.csv",
        "validation_pure_json": f"validacao_ramex_puro_{job_id}.json",
        "validation_pure_md": f"validacao_ramex_puro_{job_id}.md",
    }

    if progress_cb:
        progress_cb("ramex2007", "Execução RAMEX 2007 - Maximum Weight Rooted Branching")
    if log_cb:
        log_cb(f"RAMEX 2007 input_edges_csv: {graph_edges_csv}")
        log_cb(f"RAMEX 2007 output_csv: {output_dir / files['ramex2007_csv']}")
        log_cb(f"RAMEX 2007 output_png: {output_dir / files['ramex2007_png']}")
        log_cb(f"RAMEX 2007 output_json: {output_dir / files['ramex2007_json']}")
    run_python_script([
        str(script_path("10A_ramex_2007_rooted_branching.py")),
        str(graph_edges_csv), str(output_dir / files["ramex2007_csv"]),
        str(output_dir / files["ramex2007_png"]),
        "--root", SOURCE_NODE, "--input-type", "edges",
        "--output-json", str(output_dir / files["ramex2007_json"]),
        "--output-expanded-paths", str(output_dir / files["ramex2007_expanded_paths_csv"]),
    ], log_cb=log_cb, step_name="RAMEX 2007 Rooted Branching")
    ramex2007 = json.loads((output_dir / files["ramex2007_json"]).read_text(encoding="utf-8"))
    ramex2007_tree = edge_records_to_digraph(ramex2007.get("edges"))
    if ramex2007_tree.number_of_edges():
        ramex2007_validation = validate_rooted_branching(ramex2007_tree, ramex2007.get("root") or SOURCE_NODE, dataframe_to_digraph(graph_edges_df))
        ramex2007["validation"] = ramex2007_validation
        ramex2007["metrics"] = {**ramex2007.get("metrics", {}), **{
            "is_dag": ramex2007_validation["is_dag"],
            "is_arborescence": ramex2007_validation["is_valid_rooted_branching"],
            "is_valid_arborescence": ramex2007_validation["is_valid_rooted_branching"],
            "all_reachable_from_root": ramex2007_validation["all_reachable_from_root"],
            "expected_edges": ramex2007_validation["expected_edges"],
            "max_in_degree": ramex2007_validation["max_in_degree"],
            "max_non_root_in_degree": ramex2007_validation["max_non_root_in_degree"],
            "preserved_weight_percent": ramex2007_validation["preserved_weight_percentage"],
        }}
        (output_dir / files["ramex2007_metrics_json"]).write_text(json.dumps(ramex2007_validation, ensure_ascii=False, indent=2), encoding="utf-8")
    ramex2007_valid = bool(ramex2007.get("is_valid_arborescence") or (ramex2007.get("validation") or {}).get("is_valid_arborescence"))
    ramex2007["artifact_type"] = "ramex2007_formal" if ramex2007_valid else "ramex2007_invalid_structure"
    ramex2007["metadata"] = artifact_meta("ramex2007") if ramex2007_valid else {
        "label": "Estrutura RAMEX 2007 inválida — requer revisão.",
        "description": "Maximum Weight Rooted Branching sem validação estrutural final",
        "warning": "Não apresentar como RAMEX 2007 final até corrigir a estrutura.",
    }
    ramex2007["interpretation"] = (
        artifact_meta("ramex2007")["interpretation"]
        if ramex2007_valid
        else "Estrutura RAMEX 2007 inválida — requer revisão."
    )
    if log_cb and (selected_edges := ramex2007.get("metrics", {}).get("selected_edges")) is not None:
        log_cb(f"RAMEX 2007 concluído: {selected_edges} arestas selecionadas")

    # Determinar root para Forward no grafo LIMPO (sem SOURCE/SINK)
    # A root do RAMEX 2007 é SOURCE — não válida para o grafo limpo.
    # Usar o nó com maior peso de saída no grafo observado.
    clean_nodes = set(heuristic_df["From"].astype(str)) | set(heuristic_df["To"].astype(str))
    root_10a_real = str(ramex2007.get("root", ""))
    if root_10a_real and root_10a_real not in _virtual and root_10a_real in clean_nodes:
        # Raiz real (não SOURCE/SINK) herdada do RAMEX 2007
        forward_root, root_method = root_10a_real, "from_10A_real_root"
    else:
        # Escolher nó com maior peso de saída no grafo observado
        forward_root, root_method = choose_max_out_weight_root(heuristic_df), "max_out_weight_clean_graph"

    if log_cb:
        log_cb(f"Forward/Back-and-Forward usam grafo limpo: {len(clean_nodes)} nós, {len(heuristic_df)} arestas (sem SOURCE/SINK)")
        log_cb(f"Forward root: {forward_root} ({root_method})")

    if progress_cb:
        progress_cb("forward", "Execução Forward Heuristic sobre o grafo observado")
    run_python_script([
        str(script_path("10B_ramex_forward_heuristic.py")),
        str(heuristic_csv), str(output_dir / files["forward_csv"]),
        str(output_dir / files["forward_png"]),
        "--root", forward_root, "--output-json", str(output_dir / files["forward_json"]),
    ], log_cb=log_cb, step_name="RAMEX Forward")
    forward = json.loads((output_dir / files["forward_json"]).read_text(encoding="utf-8"))
    forward_tree = edge_records_to_digraph(forward.get("edges"))
    if forward_tree.number_of_edges():
        forward_validation = validate_forward_tree(forward_tree, forward.get("root") or forward_root, dataframe_to_digraph(heuristic_df))
        forward["validation"] = forward_validation
        forward["metrics"] = {**forward.get("metrics", {}), **{
            "is_dag": forward_validation["is_dag"],
            "is_acyclic": forward_validation["is_dag"],
            "is_valid_forward_tree": forward_validation["is_valid_forward_tree"],
            "all_reachable_from_root": forward_validation["all_reachable_from_root"],
            "expected_max_edges": forward_validation["expected_max_edges"],
            "max_in_degree": forward_validation["max_in_degree"],
            "max_out_degree": forward_validation["max_out_degree"],
            "preserved_weight_percent": forward_validation["preserved_weight_percentage"],
        }}
        (output_dir / files["forward_metrics_json"]).write_text(json.dumps(forward_validation, ensure_ascii=False, indent=2), encoding="utf-8")
    forward["artifact_type"] = "forward_heuristic"
    forward["metadata"] = artifact_meta("forward")
    forward["interpretation"] = "Heurística RAMEX 2015 aplicada a partir de uma raiz conhecida ou inferida."
    forward["root_selection_method"] = root_method
    (output_dir / files["forward_json"]).write_text(json.dumps(forward, ensure_ascii=False, indent=2), encoding="utf-8")

    if progress_cb:
        progress_cb("polytree_formal", "Execução Back-and-Forward Poly-tree formal sobre o grafo observado")
    run_python_script([
        str(script_path("10C_ramex_back_forward_polytree_formal.py")),
        str(heuristic_csv), str(output_dir / files["back_forward_formal_csv"]),
        str(output_dir / files["back_forward_formal_png"]),
        "--output-json", str(output_dir / files["back_forward_formal_json"]),
    ], log_cb=log_cb, step_name="Back-and-Forward Poly-tree Formal")
    back_forward = json.loads((output_dir / files["back_forward_formal_json"]).read_text(encoding="utf-8"))
    back_forward_tree = edge_records_to_digraph(back_forward.get("edges"))
    if back_forward_tree.number_of_edges():
        back_forward_validation = validate_polytree(back_forward_tree, dataframe_to_digraph(heuristic_df))
        back_forward["validation"] = back_forward_validation
        back_forward["metrics"] = {**back_forward.get("metrics", {}), **{
            "is_dag": back_forward_validation["is_dag"],
            "is_acyclic": back_forward_validation["is_dag"],
            "is_polytree": back_forward_validation["is_valid_polytree"],
            "is_tree_undirected": back_forward_validation["undirected_is_tree"],
            "undirected_is_tree": back_forward_validation["undirected_is_tree"],
            "expected_edges": back_forward_validation["expected_edges"],
            "max_in_degree": back_forward_validation["max_in_degree"],
            "convergence_nodes": back_forward_validation["convergence_nodes"],
            "preserved_weight_percent": back_forward_validation["preserved_weight_percentage"],
        }}
    polytree_valid = bool(back_forward.get("metrics", {}).get("is_polytree") or (back_forward.get("validation") or {}).get("is_valid_polytree"))
    back_forward["artifact_type"] = "polytree_formal" if polytree_valid else "polytree_formal_invalid"
    back_forward["metadata"] = artifact_meta("polytree_formal") if polytree_valid else {
        "label": "Estrutura Back-and-Forward inválida — requer revisão.",
        "description": "Heurística Back-and-Forward sem validação formal de poly-tree",
        "warning": "Não apresentar como poly-tree formal até corrigir a estrutura.",
    }
    back_forward["back_forward_metadata"] = artifact_meta("back_forward")
    back_forward["interpretation"] = (
        artifact_meta("polytree_formal")["interpretation"]
        if polytree_valid
        else "Estrutura Back-and-Forward inválida — requer revisão."
    )
    (output_dir / files["back_forward_formal_json"]).write_text(json.dumps(back_forward, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / files["back_forward_polytree_formal_json"]).write_text(json.dumps(back_forward, ensure_ascii=False, indent=2), encoding="utf-8")
    if isinstance(back_forward.get("validation"), dict):
        (output_dir / files["back_forward_polytree_formal_metrics_json"]).write_text(
            json.dumps(back_forward["validation"], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if not (output_dir / files["back_forward_polytree_formal_neato_optional_png"]).is_file():
        files.pop("back_forward_polytree_formal_neato_optional_png", None)

    if progress_cb:
        progress_cb("validacao", "Anexo experimental de heurísticas históricas")
    rows = pure_validation_rows(ramex2007, forward, back_forward)
    best = max(rows, key=lambda row: row.get("Peso preservado (%)") or 0)
    stype = structural_type(metrics["nodes"], metrics["density"], ramex2007.get("metrics", {}).get("preserved_weight_percent", 0))
    summary = (
        "O RAMEX 2007 formal foi gerado para este job. "
        f"No anexo experimental/histórico, a estrutura de referência por peso preservado foi {best['Algoritmo']} "
        f"({best.get('Peso preservado (%)', 0):.2f}%). Tipo estrutural: {stype}."
    )
    validation = {"dataset": job_id, "best_algorithm": best["Algoritmo"], "structural_type": stype, "rows": rows, "summary": summary}

    pd.DataFrame(rows).to_csv(output_dir / files["validation_pure_csv"], index=False, encoding="utf-8")
    (output_dir / files["validation_pure_json"]).write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / files["validation_pure_md"]).write_text("# Anexo experimental — heurísticas históricas\n\n" + summary + "\n", encoding="utf-8")

    return {
        "files": files, "ramex2007": ramex2007, "forward": forward,
        "backForward": back_forward, "comparisonRows": rows,
        "comparisonMarkdown": "# Anexo experimental — heurísticas históricas\n\n" + summary,
        "multidatasetMarkdown": "", "missing": [], "validation": validation,
    }


def validate_pure_outputs(pure: dict[str, Any] | None) -> None:
    if not pure:
        raise ValueError("Output RAMEX 2007 formal incompleto: resultados formais não foram gerados.")
    required = {
        "ramex2007": "ficheiro ramex2007 JSON não encontrado",
        "forward": "ficheiro forward JSON não encontrado",
        "backForward": "ficheiro back_forward_formal JSON não encontrado",
        "validation": "ficheiro validacao_ramex_puro JSON não encontrado",
    }
    for key, message in required.items():
        if not pure.get(key):
            raise ValueError(f"Output RAMEX 2007 formal incompleto: {message}")


def validate_forum_outputs(forum: dict[str, Any] | None) -> None:
    if not forum:
        raise ValueError("Output RAMEX-Forum incompleto: resultados RAMEX-Forum não foram gerados.")
    files = forum.get("files", {})
    required_files = {
        "metrics_json": "ficheiro ramex_forum_metrics.json não encontrado",
        "graph_png": "ficheiro ramex_forum_graph.png não encontrado",
        "simplified_png": "ficheiro ramex_forum_simplified.png não encontrado",
    }
    for key, message in required_files.items():
        if not files.get(key):
            raise ValueError(f"Output RAMEX-Forum incompleto: {message}")
    if not forum.get("metrics"):
        raise ValueError("Output RAMEX-Forum incompleto: métricas RAMEX-Forum não encontradas.")


def pure_response_payload(pure: dict[str, Any] | None) -> dict[str, Any] | None:
    if not pure:
        return None
    return {
        "ramex2007": pure.get("ramex2007"),
        "forward": pure.get("forward"),
        "back_forward_formal": pure.get("backForward"),
        "validation": pure.get("validation"),
        "files": pure.get("files", {}),
    }


def build_transition_matrix(graph: nx.DiGraph) -> dict[str, dict[str, float]]:
    nodes = sorted(graph.nodes())
    return {
        origin: {
            dest: float(graph[origin][dest].get("weight", 0)) if graph.has_edge(origin, dest) else 0.0
            for dest in nodes
        }
        for origin in nodes
    }


def run_pipeline(
    input_file: Path,
    output_dir: Path,
    dataset_type: str,
    progress_cb: ProgressCallback | None = None,
    log_cb: LogCallback | None = None,
    **kw,
) -> dict[str, Any]:
    pipeline_start = time.perf_counter()
    output_dir.mkdir(parents=True, exist_ok=True)
    strat = kw.get("polytree_strategy", "top-k")
    analysis_type = kw.get("analysis_type", "pure")

    if analysis_type not in {"pure", "forum", "both"}:
        raise ValueError("Tipo de análise inválido. Use 'pure', 'forum' ou 'both'.")
    if strat not in {"top-k", "multiobjective"}:
        raise ValueError("Estratégia inválida. Use 'top-k' ou 'multiobjective'.")
    if any(kw.get(k, 1) <= 0 for k in ["top_k_per_node", "max_depth", "max_branching"]):
        raise ValueError("K, prof. e ramos devem ser > 0.")
    if not (0 < kw.get("preserve_weight_target", 0.7) <= 1):
        raise ValueError("preserve_weight_target deve estar entre (0, 1].")

    if progress_cb:
        progress_cb("parsing", "Leitura e parsing do dataset")
    print("RUN_PIPELINE CONFIG", {
        "dataset_type": dataset_type,
        "event_mode": kw.get("event_mode", "simple"),
        "case_column": kw.get("case_column"),
        "entity_column": kw.get("entity_column"),
        "time_column": kw.get("time_column"),
        "event_column": kw.get("event_column"),
        "event_columns": kw.get("event_columns"),
        "numeric_discretization": kw.get("numeric_discretization"),
        "case_window": kw.get("case_window"),
    }, flush=True)
    raw_event_columns = kw.get("event_columns")
    if isinstance(raw_event_columns, str):
        try:
            event_columns = json.loads(raw_event_columns)
        except json.JSONDecodeError:
            event_columns = [part.strip() for part in raw_event_columns.split(",") if part.strip()]
    else:
        event_columns = raw_event_columns
    raw_numeric_rules = kw.get("numeric_discretization")
    if isinstance(raw_numeric_rules, str):
        try:
            numeric_rules = json.loads(raw_numeric_rules)
        except json.JSONDecodeError:
            numeric_rules = {}
    else:
        numeric_rules = raw_numeric_rules
    effective_case_column = kw.get("case_column") or kw.get("entity_column")
    seqs, event_construction = normalize_dataset(
        input_file,
        dataset_type,
        effective_case_column,
        kw.get("time_column"),
        kw.get("event_column"),
        event_mode=kw.get("event_mode", "simple"),
        event_columns=event_columns,
        numeric_discretization=numeric_rules,
        case_window=kw.get("case_window"),
    )
    if log_cb:
        log_cb(f"Dataset lido com {len(seqs)} sequências válidas")

    if progress_cb:
        progress_cb("sequencias", "Reconstrução de sequências e atributo item-seguinte")
    pairs = [(a, b) for s in seqs for a, b in zip(s, s[1:])]
    if not pairs:
        raise ValueError("Nenhuma transição encontrada nas sequências.")
    if log_cb:
        log_cb(f"{len(seqs)} sequências válidas reconstruídas")

    if progress_cb:
        progress_cb("pares", "Transformação formal RAMEX 2007 em rede de estados")
    if log_cb:
        log_cb(f"{len(pairs)} pares gerados")

    if progress_cb:
        progress_cb("frequencias", "Cálculo de frequências absolutas")
    edges_df = build_pair_frequencies(seqs)
    ramex2007_ordered_df = build_ramex2007_ordered_events(seqs)
    ramex2007_sequences_df = build_ramex2007_sequences(ramex2007_ordered_df)
    ramex2007_graph_edges_df = build_ramex2007_graph_edges(seqs)
    forum_temporal_events_df = build_forum_temporal_events(seqs)

    if progress_cb:
        progress_cb("matriz", "Construção da matriz de adjacência RAMEX 2007")
    matrix_df = build_adjacency_matrix(edges_df)
    ramex2007_matrix_df = build_adjacency_matrix(ramex2007_graph_edges_df[["From", "To", "Weight"]])
    graph_edges_df = filter_edges(edges_df, kw.get("min_frequency"), kw.get("top_n"))

    if progress_cb:
        progress_cb("grafo", "Construção do grafo dirigido ponderado")
    original_graph = build_graph(edges_df)
    graph = build_graph(graph_edges_df)
    ramex_graph, ramex_df, root = build_ramex_simplified(graph)
    coverage_metrics = calculate_coverage_metrics(original_graph, graph, ramex_graph)
    if log_cb:
        log_cb(f"{len(edges_df)} transições distintas identificadas")
        log_cb(f"Grafo completo criado com {graph.number_of_nodes()} nós e {graph.number_of_edges()} arestas")

    min_w = kw.get("min_weight") or (kw.get("min_frequency") if kw.get("min_frequency", 0) > 0 else None)
    params = {k: kw.get(k) for k in ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "preserve_weight_target", "max_branching", "min_score", "max_depth"]}
    params.update({"strategy": strat, "top_k_per_node": kw.get("top_k_per_node", 2), "min_weight": min_w or 0})

    if strat == "multiobjective":
        g_poly, df_poly = build_ramex_polytree_multiobjective(graph, root, **params)
    else:
        g_poly, df_poly = build_ramex_polytree(graph, root, as_int(params.get("top_k_per_node"), 2), as_int(params.get("max_depth"), 5), min_w)

    files = {
        "pairs_csv": "pares_frequencias.csv", "matrix_csv": "matriz_adjacencia.csv",
        "graph_edges_csv": "grafo_edges.csv", "ramex_csv": "ramex_simplificado.csv",
        "polytree_csv": "ramex_polytree.csv", "polytree_json": "ramex_polytree.json",
        "graph_png": "grafo.png", "ramex_png": "ramex_simplificado.png", "polytree_png": "ramex_polytree.png",
        "ramex2007_ordered_csv": "ramex2007_ordered.csv",
        "ramex2007_sequences_csv": "ramex2007_sequences.csv",
        "ramex2007_graph_edges_csv": "ramex2007_graph_edges.csv",
        "ramex2007_adjacency_matrix_csv": "ramex2007_adjacency_matrix.csv",
        "ramex2007_adjacency_matrix_png": "ramex2007_adjacency_matrix.png",
    }

    edges_df.rename(columns={"From": "Source", "To": "Target", "Weight": "Frequency"}).to_csv(output_dir / files["pairs_csv"], index=False)
    matrix_df.to_csv(output_dir / files["matrix_csv"])
    graph_edges_df.to_csv(output_dir / files["graph_edges_csv"], index=False)
    ramex2007_ordered_df.to_csv(output_dir / files["ramex2007_ordered_csv"], index=False)
    ramex2007_sequences_df.to_csv(output_dir / files["ramex2007_sequences_csv"], index=False)
    ramex2007_graph_edges_df.to_csv(output_dir / files["ramex2007_graph_edges_csv"], index=False)
    ramex2007_matrix_df.to_csv(output_dir / files["ramex2007_adjacency_matrix_csv"])
    ramex_df.to_csv(output_dir / files["ramex_csv"], index=False)
    df_poly[[c for c in ["From", "To", "Weight", "Level", "Strategy", "Score", "Reason", "ParentPath"] if c in df_poly]].to_csv(output_dir / files["polytree_csv"], index=False)
    (output_dir / files["polytree_json"]).write_text(
        json.dumps(polytree_to_json(graph, g_poly, df_poly, root, strat, params), indent=2), encoding="utf-8"
    )

    draw_graph(graph, output_dir / files["graph_png"])
    draw_graph(ramex_graph, output_dir / files["ramex_png"], root)
    draw_graph(g_poly, output_dir / files["polytree_png"], root)
    draw_adjacency_heatmap(ramex2007_matrix_df, output_dir / files["ramex2007_adjacency_matrix_png"])

    all_nodes = set(edges_df["From"]) | set(edges_df["To"])
    transition_matrix_data = {}
    if len(all_nodes) <= 10:
        transition_matrix_data = build_transition_matrix(graph)
        files["transition_matrix_json"] = "transition_matrix.json"
        (output_dir / files["transition_matrix_json"]).write_text(
            json.dumps(transition_matrix_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    n, e, tw = len(all_nodes), len(edges_df), float(edges_df["Weight"].sum())
    density = e / (n * (n - 1)) if n > 1 else 0
    metrics = {
        "nodes": n, "edges": e, "total_weight": tw,
        "ramex_edges": len(ramex_df), "ramex_weight": float(ramex_df["Weight"].sum()),
        "preserved_percentage": (float(ramex_df["Weight"].sum()) / tw * 100) if tw else 0,
        "density": density, "root": root, "sequences": len(seqs), "pairs": len(pairs),
        "dense": e > 1000 or (n >= 50 and density > 0.2),
    }

    pure: dict[str, Any] | None = None
    if analysis_type in {"pure", "both"}:
        pure = run_pure_ramex_outputs(
            output_dir, output_dir.name,
            output_dir / files["ramex2007_graph_edges_csv"],   # 10A: grafo G com SOURCE/SINK
            ramex2007_graph_edges_df[["From", "To", "Weight"]],
            metrics,
            progress_cb=progress_cb, log_cb=log_cb,
            clean_graph_edges_csv=output_dir / files["graph_edges_csv"],   # 10B/10C: grafo observado puro
            clean_graph_edges_df=graph_edges_df,
        )
        files.update(pure["files"])
        if pure.get("ramex2007"):
            pure["ramex2007"]["transformation"] = {
                "ordered_csv": files["ramex2007_ordered_csv"],
                "sequences_csv": files["ramex2007_sequences_csv"],
                "graph_edges_csv": files["ramex2007_graph_edges_csv"],
                "adjacency_matrix_csv": files["ramex2007_adjacency_matrix_csv"],
                "adjacency_matrix_png": files["ramex2007_adjacency_matrix_png"],
                "source_node": SOURCE_NODE,
                "sink_node": SINK_NODE,
                "original_graph_can_contain_cycles": True,
                "global_view_note": "O RAMEX apresenta uma visão global da base de dados porque todas as transições entre itens são incorporadas numa única rede de estados.",
                "markov_difference": {
                    "RAMEX": "frequências absolutas",
                    "Markov": "frequências relativas/probabilidades",
                },
            }
            (output_dir / files["ramex2007_json"]).write_text(
                json.dumps(pure["ramex2007"], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            (output_dir / files["ramex2007_tree_json"]).write_text(
                json.dumps(pure["ramex2007"], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            if isinstance(pure["ramex2007"].get("validation"), dict):
                (output_dir / files["ramex2007_metrics_json"]).write_text(
                    json.dumps(pure["ramex2007"]["validation"], ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

    forum: dict[str, Any] | None = None
    if analysis_type in {"forum", "both"}:
        if progress_cb:
            progress_cb("forum", "Execução RAMEX-Forum: transformação temporal e análise de influência")
        forum_output_dir = output_dir / "ramex_forum"
        temporal_phase1 = run_forum_temporal_phase1(
            forum_temporal_events_df,
            forum_output_dir,
            entity_column="entity",
            timestamp_column="timestamp",
            signal_column="signal",
            latency_max=kw.get("forum_latency_max", kw.get("latency_max", "1h")),
            epsilon=kw.get("forum_epsilon", 0.01),
            min_frequency=kw.get("forum_min_frequency", 1.0),
            min_influence=kw.get("forum_min_influence", 0.0),
            max_latency=kw.get("forum_max_latency", kw.get("latency_max", "1h")),
        )
        temporal_phase2 = run_forum_temporal_phase2(
            forum_output_dir / temporal_phase1["files"]["filtered_influence_csv"],
            forum_output_dir,
            initial_node=kw.get("forum_initial_node"),
            forward_top_k=as_int(kw.get("forum_forward_top_k"), 1),
            max_depth=as_int(kw.get("forum_max_depth"), as_int(kw.get("max_depth"), 10)),
            min_smoothed_weight=kw.get("forum_min_smoothed_weight"),
            force_heuristic=kw.get("forum_force_heuristic", "auto"),
        )
        forum = run_ramex_forum(graph_edges_df, forum_output_dir)
        forum["temporal_phase1"] = temporal_phase1
        forum["temporal_phase2"] = temporal_phase2
        forum["mode"] = "ramex_forum_with_temporal_phase1"
        forum["interpretation"] = temporal_phase1["interpretation"]
        forum_files = forum.get("files", {})
        temporal_files = temporal_phase1.get("files", {})
        temporal_phase2_files = temporal_phase2.get("files", {})
        forum_files.update({
            f"temporal_{key}": value
            for key, value in temporal_files.items()
        })
        forum_files.update({
            f"phase2_{key}": value
            for key, value in temporal_phase2_files.items()
        })
        forum["files"] = forum_files
        (forum_output_dir / forum_files.get("metrics_json", "ramex_forum_metrics.json")).write_text(
            json.dumps(forum, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        files.update({
            "ramex_forum_edges_csv": forum_files.get("edges_csv", "ramex_forum_edges.csv"),
            "ramex_forum_metrics_json": forum_files.get("metrics_json", "ramex_forum_metrics.json"),
            "ramex_forum_graph_png": forum_files.get("graph_png", "ramex_forum_graph.png"),
            "ramex_forum_simplified_png": forum_files.get("simplified_png", "ramex_forum_simplified.png"),
            "ramex_forum_report_md": forum_files.get("report_md", "ramex_forum_report.md"),
            "ramex_forum_temporal_ordered_csv": temporal_files.get("ordered_dataset_csv", "forum_ordered_dataset.csv"),
            "ramex_forum_temporal_signal_counter_csv": temporal_files.get("signal_counter_csv", "forum_signal_counter.csv"),
            "ramex_forum_temporal_influence_csv": temporal_files.get("temporal_influence_csv", "forum_temporal_influence.csv"),
            "ramex_forum_temporal_filtered_csv": temporal_files.get("filtered_influence_csv", "forum_filtered_influence.csv"),
            "ramex_forum_temporal_matrix_csv": temporal_files.get("influence_matrix_csv", "forum_influence_matrix.csv"),
            "ramex_forum_temporal_matrix_png": temporal_files.get("influence_matrix_png", "forum_influence_matrix.png"),
            "ramex_forum_temporal_graph_edges_csv": temporal_files.get("graph_edges_csv", "forum_graph_edges.csv"),
            "ramex_forum_temporal_graphml": temporal_files.get("graph_graphml", "forum_graph.graphml"),
            "ramex_forum_temporal_graph_png": temporal_files.get("graph_png", "forum_graph.png"),
            "ramex_forum_phase2_metrics_json": temporal_phase2_files.get("metrics_json", "forum_temporal_phase2_metrics.json"),
            "ramex_forum_phase2_structure_png": temporal_phase2_files.get("phase2_structure_png", "forum_phase2_structure.png"),
            "ramex_forum_phase2_forward_csv": temporal_phase2_files.get("forward_tree_csv", "forum_forward_tree.csv"),
            "ramex_forum_phase2_forward_json": temporal_phase2_files.get("forward_tree_json", "forum_forward_tree.json"),
            "ramex_forum_phase2_forward_png": temporal_phase2_files.get("forward_tree_png", "forum_forward_tree.png"),
            "ramex_forum_phase2_back_forward_csv": temporal_phase2_files.get("back_forward_polytree_csv", "forum_back_forward_polytree.csv"),
            "ramex_forum_phase2_back_forward_json": temporal_phase2_files.get("back_forward_polytree_json", "forum_back_forward_polytree.json"),
            "ramex_forum_phase2_back_forward_png": temporal_phase2_files.get("back_forward_polytree_png", "forum_back_forward_polytree.png"),
            "ramex_forum_phase2_dominant_path_csv": temporal_phase2_files.get("dominant_path_csv", "forum_dominant_path.csv"),
            "ramex_forum_phase2_sankey_json": temporal_phase2_files.get("phase2_sankey_json", "forum_phase2_sankey.json"),
        })
        if log_cb:
            log_cb("RAMEX-Forum Fase 1 concluído: rede temporal de influência, smoothing, filtros, matriz e grafo")

    if analysis_type == "both":
        validate_pure_outputs(pure)
        validate_forum_outputs(forum)
    elif analysis_type == "pure":
        validate_pure_outputs(pure)
    elif analysis_type == "forum":
        validate_forum_outputs(forum)

    if progress_cb:
        progress_cb("relatorio", "Geração de relatório técnico")

    pipeline_steps_map = {
        "forum": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo", "RAMEX-Forum"],
        "both": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo observado completo", "RAMEX 2007 formal", "Forward Heuristic", "Back-and-Forward Poly-tree", "Anexo experimental", "RAMEX-Forum"],
        "pure": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo observado completo", "RAMEX 2007 formal", "Forward Heuristic", "Back-and-Forward Poly-tree", "Anexo experimental"],
    }
    pure_legacy = {k: pure[k] for k in ["ramex2007", "forward", "backForward", "comparisonRows", "comparisonMarkdown", "multidatasetMarkdown", "missing"]} if pure else None
    pipeline_elapsed_seconds = round(time.perf_counter() - pipeline_start, 3)

    _experimental_note = (
        "Heurística experimental desenvolvida numa fase inicial do projeto. "
        "Não constitui RAMEX 2007 formal nem RAMEX 2015. "
        "As abordagens formais estão disponíveis em 'pure' (RAMEX 2007, Forward, Back-and-Forward)."
    )
    observed_validation = validate_observed_graph(dataframe_to_digraph(edges_df))
    filtered_validation = validate_observed_graph(graph)
    observed_graph_payload = {
        "metadata": artifact_meta("observed_graph"),
        "warning": artifact_meta("observed_graph")["warning"],
        "validation": observed_validation,
        "edges": edges_to_records(edges_df),
        "nodes": n,
        "edge_count": e,
        "total_weight": tw,
        "density": density,
        "files": {"pairs_csv": files["pairs_csv"], "matrix_csv": files["matrix_csv"]},
    }
    filtered_graph_payload = {
        "metadata": artifact_meta("filtered_graph"),
        "warning": artifact_meta("filtered_graph")["warning"],
        "validation": filtered_validation,
        "edges": edges_to_records(graph_edges_df),
        "nodes": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
        "total_weight": graph_weight_sum(graph),
        "is_filtered": len(graph_edges_df) != len(edges_df),
        "files": {"graph_edges_csv": files["graph_edges_csv"], "graph_png": files["graph_png"]},
    }
    simplified_ramex_payload = {
        "metadata": artifact_meta("simplified_ramex"),
        "warning": artifact_meta("simplified_ramex")["warning"],
        "edges": edges_to_records(ramex_df),
        "note": _experimental_note,
        "files": {"ramex_csv": files["ramex_csv"], "ramex_png": files["ramex_png"]},
    }
    sankey_payload = {
        "metadata": artifact_meta("sankey"),
        "observed_edges_source": "filtered_graph.edges",
        "final_edges_source": "pure_ramex.ramex2007.edges",
        "warning": artifact_meta("sankey")["warning"],
    }

    return {
        "status": "completed", "analysis_type": analysis_type, "metrics": metrics,
        "metadata": {
            "artifact_semantics_version": 1,
            "artifact_semantics": ARTIFACT_SEMANTICS,
            "interpretation": {
                "observed_graph": artifact_meta("observed_graph")["warning"],
                "ramex2007": artifact_meta("ramex2007")["interpretation"],
                "polytree_formal": artifact_meta("polytree_formal")["interpretation"],
                "sankey": artifact_meta("sankey")["warning"],
            },
        },
        "event_construction": event_construction,
        "coverage_metrics": coverage_metrics,
        "interpretation": interpret(metrics),
        "top_transitions": edges_to_records(edges_df.head(5)),
        "matrix": matrix_to_json(matrix_df),
        "observed_graph": observed_graph_payload,
        "filtered_graph": filtered_graph_payload,
        "graph_edges": edges_to_records(graph_edges_df),
        "simplified_ramex": simplified_ramex_payload,
        "ramex_edges": edges_to_records(ramex_df),
        "ramex_edges_note": _experimental_note,
        "polytree": {**polytree_to_json(graph, g_poly, df_poly, root, strat, params), "is_experimental": True, "experimental_note": _experimental_note},
        "polytree_edges": edges_to_records(df_poly),
        "sankey": sankey_payload,
        "visualizations": {
            "observed_graph": {
                "title": artifact_meta("observed_graph")["label"],
                "subtitle": artifact_meta("observed_graph")["description"],
                "warning": artifact_meta("observed_graph")["warning"],
                "file": files["graph_png"],
            },
            "filtered_graph": {
                "title": artifact_meta("filtered_graph")["label"],
                "subtitle": artifact_meta("filtered_graph")["description"],
                "warning": artifact_meta("filtered_graph")["warning"],
                "file": files["graph_png"],
            },
            "simplified_ramex": {
                "title": artifact_meta("simplified_ramex")["label"],
                "subtitle": artifact_meta("simplified_ramex")["description"],
                "warning": artifact_meta("simplified_ramex")["warning"],
                "file": files["ramex_png"],
            },
            "ramex2007": {
                "title": artifact_meta("ramex2007")["label"],
                "subtitle": artifact_meta("ramex2007")["description"],
                "interpretation": artifact_meta("ramex2007")["interpretation"],
                "file": files.get("ramex2007_png"),
            },
            "polytree_formal": {
                "title": artifact_meta("polytree_formal")["label"],
                "subtitle": artifact_meta("polytree_formal")["description"],
                "interpretation": artifact_meta("polytree_formal")["interpretation"],
                "file": files.get("back_forward_polytree_formal_hierarchical_png") or files.get("back_forward_formal_png"),
            },
            "sankey": sankey_payload,
        },
        "files": files,
        "transition_matrix": transition_matrix_data,
        "pure": pure_response_payload(pure),
        "forum": forum,
        "pure_ramex": pure_legacy,
        "formal_polytree": pure["backForward"] if pure else None,
        "polytree_formal": pure["backForward"] if pure else None,
        "pure_validation": pure["validation"] if pure else None,
        "ramex_forum": forum,
        "ramex2007_transformation": {
            "metadata": {
                "label": "Rede formal RAMEX 2007",
                "description": "Rede dirigida ponderada com SOURCE/SINK usada como entrada do rooted branching",
                "warning": "Esta rede ainda não é a arborescência final; pode conter ciclos antes da condensação.",
            },
            "ordered_rows": len(ramex2007_ordered_df),
            "sequence_rows": len(ramex2007_sequences_df),
            "graph_edges": edges_to_records(ramex2007_graph_edges_df),
            "source_exists": SOURCE_NODE in set(ramex2007_graph_edges_df["From"].astype(str)),
            "sink_exists": SINK_NODE in set(ramex2007_graph_edges_df["To"].astype(str)),
            "matrix": matrix_to_json(ramex2007_matrix_df),
            "files": {
                "ordered_csv": files["ramex2007_ordered_csv"],
                "sequences_csv": files["ramex2007_sequences_csv"],
                "graph_edges_csv": files["ramex2007_graph_edges_csv"],
                "adjacency_matrix_csv": files["ramex2007_adjacency_matrix_csv"],
                "adjacency_matrix_png": files["ramex2007_adjacency_matrix_png"],
            },
        },
        "pipeline_steps": pipeline_steps_map[analysis_type],
        "pipeline_elapsed_seconds": pipeline_elapsed_seconds,
    }
