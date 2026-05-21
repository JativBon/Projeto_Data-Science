from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib  # type: ignore
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # type: ignore
import networkx as nx  # type: ignore
import pandas as pd  # type: ignore


DEFAULT_EPSILON = 0.01
DEFAULT_LATENCY_MAX = "1h"


def _records(df: pd.DataFrame, limit: int | None = None) -> list[dict[str, Any]]:
    view = df if limit is None else df.head(limit)
    records = view.where(pd.notnull(view), None).to_dict(orient="records")
    return [{str(k): v for k, v in rec.items()} for rec in records]


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if pd.notna(parsed) else default
    except (TypeError, ValueError):
        return default


def _clean_signal(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except Exception:
        pass
    text = str(value).strip()
    if not text or text.lower() in {"nan", "nat", "none"}:
        return None
    return text


def parse_latency_to_seconds(value: str | int | float | None) -> float:
    if value is None or value == "":
        value = DEFAULT_LATENCY_MAX
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().lower().replace(",", ".")
    if re.fullmatch(r"\d+(\.\d+)?", text):
        return float(text)

    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seg|m|min|mins|h|hr|hrs|d|dia|dias)?", text)
    if not match:
        raise ValueError(f"latency_max inválido: {value}")

    amount = float(match.group(1))
    unit = match.group(2) or "s"
    factors = {
        "ms": 0.001,
        "s": 1.0,
        "sec": 1.0,
        "secs": 1.0,
        "seg": 1.0,
        "m": 60.0,
        "min": 60.0,
        "mins": 60.0,
        "h": 3600.0,
        "hr": 3600.0,
        "hrs": 3600.0,
        "d": 86400.0,
        "dia": 86400.0,
        "dias": 86400.0,
    }
    return amount * factors[unit]


def read_table(path: Path) -> pd.DataFrame:
    ext = path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(path)
    if ext == ".xlsx":
        return pd.read_excel(path)
    raise ValueError("RAMEX-Forum Fase 1 aceita CSV ou XLSX.")


def _timestamp_sort_key(series: pd.Series) -> tuple[pd.Series, str]:
    numeric = pd.to_numeric(series, errors="coerce")
    datetimes = pd.to_datetime(series, errors="coerce")
    if numeric.notna().mean() >= datetimes.notna().mean() and numeric.notna().mean() >= 0.8:
        return numeric, "numeric"
    if datetimes.notna().mean() >= 0.8:
        return datetimes, "datetime"
    return series.astype(str), "text"


def prepare_dataset(
    df: pd.DataFrame,
    entity_column: str,
    timestamp_column: str,
    signal_column: str,
) -> pd.DataFrame:
    missing = [col for col in [entity_column, timestamp_column, signal_column] if col not in df.columns]
    if missing:
        raise ValueError(f"Colunas obrigatórias ausentes para RAMEX-Forum: {missing}")

    prepared = df[[entity_column, timestamp_column, signal_column]].copy()
    prepared.columns = ["entity", "timestamp", "signal"]
    prepared["entity"] = prepared["entity"].apply(_clean_signal)
    prepared["signal"] = prepared["signal"].apply(_clean_signal)
    prepared = prepared.dropna(subset=["entity", "timestamp", "signal"]).copy()
    if prepared.empty:
        raise ValueError("RAMEX-Forum Fase 1 não encontrou eventos válidos.")

    prepared["_order"], order_kind = _timestamp_sort_key(prepared["timestamp"])
    prepared = prepared.dropna(subset=["_order"]).sort_values(
        ["entity", "_order", "signal"],
        kind="stable",
    ).reset_index(drop=True)
    prepared["timestamp_order_kind"] = order_kind
    prepared["event_index"] = prepared.groupby("entity").cumcount() + 1
    return prepared[["entity", "timestamp", "signal", "event_index", "timestamp_order_kind"]]


def signal_counter(ordered_df: pd.DataFrame) -> pd.DataFrame:
    counter = (
        ordered_df.groupby(["entity", "timestamp", "signal"], sort=False)
        .size()
        .reset_index(name="signal_counter")
    )
    return counter[["entity", "timestamp", "signal", "signal_counter"]]


def _event_time_values(group: pd.DataFrame) -> tuple[list[Any], bool]:
    kind = str(group["timestamp_order_kind"].iloc[0]) if "timestamp_order_kind" in group else "numeric"
    if kind == "datetime":
        values = pd.to_datetime(group["timestamp"], errors="coerce").tolist()
        return values, True
    numeric = pd.to_numeric(group["timestamp"], errors="coerce")
    if numeric.notna().all():
        return numeric.astype(float).tolist(), False
    return group["event_index"].astype(float).tolist(), False


def _delta_seconds(left: Any, right: Any, is_datetime: bool) -> float:
    if is_datetime:
        return max(0.0, (right - left).total_seconds())
    return max(0.0, float(right) - float(left))


def temporal_influence(ordered_df: pd.DataFrame, latency_max_seconds: float) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for entity, group in ordered_df.groupby("entity", sort=False):
        group = group.sort_values(["event_index", "signal"], kind="stable").reset_index(drop=True)
        times, is_datetime = _event_time_values(group)
        signals = group["signal"].astype(str).tolist()

        for i, from_signal in enumerate(signals):
            for j in range(i + 1, len(signals)):
                delta_t = _delta_seconds(times[i], times[j], is_datetime)
                if delta_t <= 0:
                    continue
                if delta_t > latency_max_seconds:
                    break
                temporal_decay = 1.0 / (1.0 + delta_t)
                rows.append({
                    "entity": str(entity),
                    "from_signal": from_signal,
                    "to_signal": signals[j],
                    "delta_t": delta_t,
                    "frequency": 1,
                    "temporal_decay": temporal_decay,
                    "influence_weight": temporal_decay,
                })

    if not rows:
        return pd.DataFrame(columns=[
            "from_signal", "to_signal", "delta_t", "frequency",
            "temporal_decay", "influence_weight",
        ])

    raw = pd.DataFrame(rows)
    grouped = (
        raw.groupby(["from_signal", "to_signal", "delta_t"], sort=False)
        .agg(
            frequency=("frequency", "sum"),
            temporal_decay=("temporal_decay", "mean"),
            influence_weight=("influence_weight", "sum"),
        )
        .reset_index()
    )
    return grouped.sort_values(
        ["influence_weight", "frequency", "from_signal", "to_signal"],
        ascending=[False, False, True, True],
        kind="stable",
    ).reset_index(drop=True)


def apply_epsilon_and_filters(
    influence_df: pd.DataFrame,
    epsilon: float = DEFAULT_EPSILON,
    min_frequency: float = 1.0,
    min_influence: float = 0.0,
    max_latency_seconds: float | None = None,
) -> pd.DataFrame:
    df = influence_df.copy()
    if df.empty:
        df["smoothed_weight"] = []
        return df

    df["frequency"] = pd.to_numeric(df["frequency"], errors="coerce").fillna(0.0)
    df["delta_t"] = pd.to_numeric(df["delta_t"], errors="coerce").fillna(0.0)
    df["influence_weight"] = pd.to_numeric(df["influence_weight"], errors="coerce").fillna(0.0)
    df["smoothed_weight"] = df["influence_weight"] + float(epsilon)

    filtered = df[df["frequency"] >= float(min_frequency)].copy()
    filtered = filtered[filtered["smoothed_weight"] >= float(min_influence)].copy()
    if max_latency_seconds is not None:
        filtered = filtered[filtered["delta_t"] <= float(max_latency_seconds)].copy()

    return filtered.sort_values(
        ["smoothed_weight", "frequency", "from_signal", "to_signal"],
        ascending=[False, False, True, True],
        kind="stable",
    ).reset_index(drop=True)


def graph_edges_from_filtered(filtered_df: pd.DataFrame) -> pd.DataFrame:
    if filtered_df.empty:
        return pd.DataFrame(columns=[
            "From", "To", "Weight", "InfluenceWeight", "SmoothedWeight",
            "Frequency", "DeltaT", "TemporalDecay",
        ])
    grouped = (
        filtered_df.groupby(["from_signal", "to_signal"], sort=False)
        .agg(
            Weight=("smoothed_weight", "sum"),
            InfluenceWeight=("influence_weight", "sum"),
            SmoothedWeight=("smoothed_weight", "sum"),
            Frequency=("frequency", "sum"),
            DeltaT=("delta_t", "mean"),
            TemporalDecay=("temporal_decay", "mean"),
        )
        .reset_index()
        .rename(columns={"from_signal": "From", "to_signal": "To"})
    )
    return grouped.sort_values(["Weight", "Frequency", "From", "To"], ascending=[False, False, True, True]).reset_index(drop=True)


def influence_matrix(graph_edges_df: pd.DataFrame) -> pd.DataFrame:
    nodes = sorted(set(graph_edges_df.get("From", pd.Series(dtype=str)).astype(str)) | set(graph_edges_df.get("To", pd.Series(dtype=str)).astype(str)))
    matrix = pd.DataFrame(0.0, index=nodes, columns=nodes)
    for rec in graph_edges_df.to_dict(orient="records"):
        matrix.at[str(rec["From"]), str(rec["To"])] += _safe_float(rec.get("Weight"))
    return matrix


def draw_influence_heatmap(matrix_df: pd.DataFrame, output_png: Path) -> None:
    if matrix_df.empty:
        return
    limit = min(60, matrix_df.shape[0], matrix_df.shape[1])
    view = matrix_df.iloc[:limit, :limit]
    fig_size = max(8, min(18, limit * 0.34))
    fig, ax = plt.subplots(figsize=(fig_size, fig_size), dpi=150)
    image = ax.imshow(view.values, cmap="PuBuGn", aspect="auto")
    ax.set_title("RAMEX-Forum - Matriz de Influencia Temporal", fontsize=12, fontweight="bold")
    ax.set_xlabel("TO")
    ax.set_ylabel("FROM")
    ax.set_xticks(range(limit))
    ax.set_yticks(range(limit))
    ax.set_xticklabels([str(col) for col in view.columns], rotation=90, fontsize=6)
    ax.set_yticklabels([str(idx) for idx in view.index], fontsize=6)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04, label="peso suavizado")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def build_temporal_graph(graph_edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for rec in graph_edges_df.to_dict(orient="records"):
        graph.add_edge(
            str(rec["From"]),
            str(rec["To"]),
            weight=_safe_float(rec.get("Weight")),
            influence_weight=_safe_float(rec.get("InfluenceWeight")),
            smoothed_weight=_safe_float(rec.get("SmoothedWeight")),
            frequency=_safe_float(rec.get("Frequency")),
            delta_t=_safe_float(rec.get("DeltaT")),
        )
    return graph


def _adapt_phase2_edges(influence_df: pd.DataFrame) -> pd.DataFrame:
    columns = {str(col).lower(): str(col) for col in influence_df.columns}

    def pick(*names: str) -> str | None:
        for name in names:
            if name.lower() in columns:
                return columns[name.lower()]
        return None

    from_col = pick("from_signal", "from", "source", "From")
    to_col = pick("to_signal", "to", "target", "To")
    weight_col = pick("smoothed_weight", "SmoothedWeight", "Weight")
    influence_col = pick("influence_weight", "InfluenceWeight")
    frequency_col = pick("frequency", "Frequency")
    delta_col = pick("delta_t", "avg_delta_t", "DeltaT")
    if not from_col or not to_col:
        raise ValueError("RAMEX-Forum Fase 2 requer colunas from_signal/to_signal ou From/To.")
    if not weight_col and not influence_col:
        raise ValueError("RAMEX-Forum Fase 2 requer smoothed_weight ou influence_weight.")

    df = pd.DataFrame({
        "From": influence_df[from_col].astype(str),
        "To": influence_df[to_col].astype(str),
        "Weight": pd.to_numeric(influence_df[weight_col or influence_col], errors="coerce").fillna(0.0),
        "InfluenceWeight": pd.to_numeric(influence_df[influence_col], errors="coerce").fillna(0.0) if influence_col else pd.to_numeric(influence_df[weight_col], errors="coerce").fillna(0.0),
        "Frequency": pd.to_numeric(influence_df[frequency_col], errors="coerce").fillna(0.0) if frequency_col else 0.0,
        "DeltaT": pd.to_numeric(influence_df[delta_col], errors="coerce").fillna(0.0) if delta_col else 0.0,
    })
    df = df[df["Weight"] > 0].copy()
    if df.empty:
        raise ValueError("Não existem relações de influência suficientes após filtragem.")
    return (
        df.groupby(["From", "To"], sort=False)
        .agg(
            Weight=("Weight", "sum"),
            InfluenceWeight=("InfluenceWeight", "sum"),
            Frequency=("Frequency", "sum"),
            DeltaT=("DeltaT", "mean"),
        )
        .reset_index()
        .sort_values(["Weight", "Frequency", "From", "To"], ascending=[False, False, True, True])
        .reset_index(drop=True)
    )


def _phase2_graph(edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for rec in edges_df.to_dict(orient="records"):
        graph.add_edge(
            str(rec["From"]),
            str(rec["To"]),
            weight=_safe_float(rec.get("Weight")),
            influence_weight=_safe_float(rec.get("InfluenceWeight")),
            frequency=_safe_float(rec.get("Frequency")),
            delta_t=_safe_float(rec.get("DeltaT")),
        )
    return graph


def _edge_row(graph: nx.DiGraph, u: str, v: str, level: int, direction: str, reason: str) -> dict[str, Any]:
    data = graph.get_edge_data(u, v, default={})
    return {
        "From": str(u),
        "To": str(v),
        "Weight": _safe_float(data.get("weight")),
        "InfluenceWeight": _safe_float(data.get("influence_weight")),
        "Frequency": _safe_float(data.get("frequency")),
        "Level": int(level),
        "Direction": direction,
        "Reason": reason,
    }


def _infer_initial_node(graph: nx.DiGraph, provided: str | None, force_heuristic: str) -> tuple[str | None, str, str | None]:
    nodes = {str(node) for node in graph.nodes}
    if provided:
        if provided not in nodes:
            raise ValueError(f"initial_node '{provided}' não existe na rede temporal RAMEX-Forum.")
        return provided, "provided", None
    if force_heuristic == "back_and_forward":
        return None, "none", None

    zero_in = [str(node) for node in graph.nodes if graph.in_degree(node) == 0 and graph.out_degree(node) > 0]
    if len(zero_in) == 1:
        return zero_in[0], "inferred", None
    if len(zero_in) > 1:
        out_weight = {
            node: sum(float(data.get("weight", 0.0)) for _, _, data in graph.out_edges(node, data=True))
            for node in zero_in
        }
        return max(zero_in, key=lambda node: (out_weight[node], node)), "inferred", "Múltiplos nós iniciais; escolhido maior peso de saída."
    if force_heuristic == "forward":
        candidates = [str(node) for node in graph.nodes if graph.out_degree(node) > 0]
        if candidates:
            out_weight = {
                node: sum(float(data.get("weight", 0.0)) for _, _, data in graph.out_edges(node, data=True))
                for node in candidates
            }
            return max(candidates, key=lambda node: (out_weight[node], node)), "inferred", "Forward forçado sem in_degree=0; escolhido maior peso de saída."
    return None, "none", None


def forum_forward_tree(
    graph: nx.DiGraph,
    initial_node: str,
    top_k: int = 1,
    max_depth: int = 10,
    min_smoothed_weight: float | None = None,
) -> pd.DataFrame:
    selected: list[dict[str, Any]] = []
    visited = {initial_node}
    frontier = [(initial_node, 0)]
    while frontier:
        current, level = frontier.pop(0)
        if level >= max_depth:
            continue
        candidates = [
            (str(current), str(target), data)
            for _, target, data in graph.out_edges(current, data=True)
            if str(target) not in visited and (min_smoothed_weight is None or float(data.get("weight", 0.0)) >= min_smoothed_weight)
        ]
        candidates.sort(key=lambda edge: (-float(edge[2].get("weight", 0.0)), edge[1]))
        for u, v, _data in candidates[:max(1, int(top_k))]:
            selected.append(_edge_row(graph, u, v, level + 1, "FORWARD", "Melhor aresta forward por smoothed_weight"))
            visited.add(v)
            frontier.append((v, level + 1))
    return pd.DataFrame(selected)


def forum_back_forward_polytree(
    graph: nx.DiGraph,
    max_depth: int = 10,
    min_smoothed_weight: float | None = None,
    max_edges: int | None = None,
) -> pd.DataFrame:
    all_edges = [
        (str(u), str(v), data)
        for u, v, data in graph.edges(data=True)
        if min_smoothed_weight is None or float(data.get("weight", 0.0)) >= min_smoothed_weight
    ]
    if not all_edges:
        return pd.DataFrame()

    u0, v0, _ = max(all_edges, key=lambda edge: (float(edge[2].get("weight", 0.0)), edge[0], edge[1]))
    selected = [_edge_row(graph, u0, v0, 0, "INITIAL", "Aresta inicial mais forte por smoothed_weight")]
    selected_undirected = nx.Graph()
    selected_undirected.add_edge(u0, v0)
    selected_nodes = {u0, v0}
    levels = {u0: 0, v0: 1}
    max_allowed_edges = max_edges or max(0, graph.number_of_nodes() - 1)

    while len(selected) < max_allowed_edges and len(selected) < max(1, graph.number_of_nodes() - 1):
        candidates: list[tuple[float, str, str, str, int]] = []
        for node in list(selected_nodes):
            level = levels.get(node, 0)
            if level >= max_depth:
                continue
            for _, target, data in graph.out_edges(node, data=True):
                target = str(target)
                if target in selected_nodes:
                    continue
                w = float(data.get("weight", 0.0))
                if min_smoothed_weight is not None and w < min_smoothed_weight:
                    continue
                candidates.append((w, str(node), target, "FORWARD", level + 1))
            for source, _, data in graph.in_edges(node, data=True):
                source = str(source)
                if source in selected_nodes:
                    continue
                w = float(data.get("weight", 0.0))
                if min_smoothed_weight is not None and w < min_smoothed_weight:
                    continue
                candidates.append((w, source, str(node), "BACKWARD", level + 1))

        candidates.sort(key=lambda item: (-item[0], item[1], item[2], item[3]))
        chosen = None
        for _w, u, v, direction, level in candidates:
            test = selected_undirected.copy()
            test.add_edge(u, v)
            if nx.is_forest(test):
                chosen = (u, v, direction, level)
                break
        if chosen is None:
            break
        u, v, direction, level = chosen
        selected.append(_edge_row(graph, u, v, level, direction, f"Melhor candidata {direction.lower()} por smoothed_weight sem ciclo não dirigido"))
        selected_undirected.add_edge(u, v)
        selected_nodes.update([u, v])
        levels.setdefault(u, level)
        levels.setdefault(v, level)
    return pd.DataFrame(selected)


def _structure_graph(selected_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for rec in selected_df.to_dict(orient="records"):
        graph.add_edge(
            str(rec["From"]),
            str(rec["To"]),
            weight=_safe_float(rec.get("Weight")),
            influence_weight=_safe_float(rec.get("InfluenceWeight")),
            frequency=_safe_float(rec.get("Frequency")),
            direction=str(rec.get("Direction", "")),
            level=int(_safe_float(rec.get("Level"), 0)),
        )
    return graph


def _forward_dominant_path(tree: nx.DiGraph, root: str) -> list[dict[str, Any]]:
    path: list[dict[str, Any]] = []
    current = root
    seen = {root}
    step = 1
    while True:
        candidates = [
            (str(current), str(v), data)
            for _, v, data in tree.out_edges(current, data=True)
            if str(v) not in seen
        ]
        if not candidates:
            break
        u, v, data = max(candidates, key=lambda edge: (float(edge[2].get("weight", 0.0)), edge[1]))
        path.append({
            "Step": step,
            "From": u,
            "To": v,
            "Weight": float(data.get("weight", 0.0)),
            "InfluenceWeight": float(data.get("influence_weight", 0.0)),
            "Direction": str(data.get("direction", "FORWARD")),
        })
        current = v
        seen.add(v)
        step += 1
    return path


def _polytree_dominant_path(poly: nx.DiGraph) -> list[dict[str, Any]]:
    if poly.number_of_edges() == 0:
        return []
    undirected = poly.to_undirected()
    best_path: list[str] = []
    best_weight = -1.0
    for source in undirected.nodes:
        for target in undirected.nodes:
            if source == target:
                continue
            try:
                nodes = nx.shortest_path(undirected, source, target)
            except nx.NetworkXNoPath:
                continue
            total = 0.0
            for a, b in zip(nodes, nodes[1:]):
                data = poly.get_edge_data(a, b) or poly.get_edge_data(b, a) or {}
                total += float(data.get("weight", 0.0))
            if total > best_weight:
                best_weight = total
                best_path = [str(node) for node in nodes]
    rows: list[dict[str, Any]] = []
    for step, (a, b) in enumerate(zip(best_path, best_path[1:]), start=1):
        data = poly.get_edge_data(a, b)
        direction = "FORWARD"
        if data is None:
            data = poly.get_edge_data(b, a) or {}
            direction = "BACKWARD"
        rows.append({
            "Step": step,
            "From": a,
            "To": b,
            "Weight": float(data.get("weight", 0.0)),
            "InfluenceWeight": float(data.get("influence_weight", 0.0)),
            "Direction": str(data.get("direction", direction)),
        })
    return rows


def draw_phase2_structure(graph: nx.DiGraph, output_png: Path, title: str, initial_node: str | None = None) -> None:
    if graph.number_of_edges() == 0:
        return
    node_count = graph.number_of_nodes()
    fig_size = (14, 10) if node_count <= 25 else (22, 16) if node_count <= 100 else (34, 24)
    fig, ax = plt.subplots(figsize=fig_size, dpi=240)
    try:
        pos = nx.nx_agraph.graphviz_layout(graph, prog="dot")
    except Exception:
        pos = nx.spring_layout(graph, seed=57, weight="weight", iterations=80)

    max_weight = max((float(data.get("weight", 0.0)) for _, _, data in graph.edges(data=True)), default=1.0) or 1.0
    node_colors = ["#f59e0b" if str(node) == str(initial_node) else "#eef8fb" for node in graph.nodes]
    edge_colors = [
        "#f59e0b" if data.get("direction") == "INITIAL" else "#0e7490" if data.get("direction") == "FORWARD" else "#7c3aed"
        for _, _, data in graph.edges(data=True)
    ]
    widths = [0.8 + 5.0 * float(data.get("weight", 0.0)) / max_weight for _, _, data in graph.edges(data=True)]
    nx.draw_networkx_nodes(graph, pos, ax=ax, node_color=node_colors, edgecolors="#315f72", linewidths=1.2, node_size=900)
    nx.draw_networkx_edges(graph, pos, ax=ax, edge_color=edge_colors, width=widths, arrows=True, arrowstyle="-|>", arrowsize=18, alpha=0.78)
    nx.draw_networkx_labels(graph, pos, ax=ax, font_size=8 if node_count > 50 else 10, font_weight="bold")
    if graph.number_of_edges() <= 90:
        labels = {(u, v): f"{float(data.get('weight', 0.0)):.2f}" for u, v, data in graph.edges(data=True)}
        nx.draw_networkx_edge_labels(graph, pos, labels, ax=ax, font_size=7)
    ax.set_title(title, fontsize=15, fontweight="bold")
    ax.axis("off")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=260, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def run_forum_temporal_phase2(
    filtered_influence_csv: Path,
    output_dir: Path,
    initial_node: str | None = None,
    forward_top_k: int = 1,
    max_depth: int = 10,
    min_smoothed_weight: float | None = None,
    force_heuristic: str = "auto",
    max_edges: int | None = None,
) -> dict[str, Any]:
    if not filtered_influence_csv.is_file():
        raise ValueError("RAMEX-Forum Fase 2 requer outputs válidos da Fase 1.")
    if force_heuristic not in {"auto", "forward", "back_and_forward"}:
        raise ValueError("force_heuristic deve ser auto, forward ou back_and_forward.")
    output_dir.mkdir(parents=True, exist_ok=True)
    edges_df = _adapt_phase2_edges(pd.read_csv(filtered_influence_csv))
    graph = _phase2_graph(edges_df)
    total_weight = float(edges_df["Weight"].sum())
    warnings: list[str] = []

    selected_initial_node, initial_node_mode, warning = _infer_initial_node(graph, initial_node, force_heuristic)
    if warning:
        warnings.append(warning)
    heuristic = "forward" if selected_initial_node and force_heuristic != "back_and_forward" else "back_and_forward"
    if force_heuristic == "forward" and not selected_initial_node:
        raise ValueError("Forward Heuristic requer initial_node válido ou nó inicial inferível.")

    files = {
        "forward_tree_csv": "forum_forward_tree.csv",
        "forward_tree_json": "forum_forward_tree.json",
        "forward_tree_png": "forum_forward_tree.png",
        "back_forward_polytree_csv": "forum_back_forward_polytree.csv",
        "back_forward_polytree_json": "forum_back_forward_polytree.json",
        "back_forward_polytree_png": "forum_back_forward_polytree.png",
        "phase2_structure_png": "forum_phase2_structure.png",
        "phase2_structure_svg": "forum_phase2_structure.svg",
        "phase2_sankey_json": "forum_phase2_sankey.json",
        "dominant_path_csv": "forum_dominant_path.csv",
        "metrics_json": "forum_temporal_phase2_metrics.json",
    }

    if heuristic == "forward":
        selected_df = forum_forward_tree(graph, selected_initial_node or "", forward_top_k, max_depth, min_smoothed_weight)
        structure = "influence_tree"
        algorithm = "RAMEX-Forum Forward Heuristic"
        output_csv, output_json, output_png = files["forward_tree_csv"], files["forward_tree_json"], files["forward_tree_png"]
    else:
        selected_df = forum_back_forward_polytree(graph, max_depth, min_smoothed_weight, max_edges)
        structure = "influence_polytree"
        algorithm = "RAMEX-Forum Back-and-Forward Heuristic"
        output_csv, output_json, output_png = files["back_forward_polytree_csv"], files["back_forward_polytree_json"], files["back_forward_polytree_png"]

    if selected_df.empty:
        raise ValueError("Não existem relações de influência suficientes após filtragem.")
    selected_graph = _structure_graph(selected_df)
    undirected = selected_graph.to_undirected()
    selected_weight = float(selected_df["Weight"].sum())
    is_dag = bool(nx.is_directed_acyclic_graph(selected_graph))
    is_connected = bool(nx.is_connected(undirected)) if undirected.number_of_nodes() > 0 else False
    is_tree_undirected = bool(nx.is_tree(undirected)) if undirected.number_of_nodes() > 0 else False
    root_indegree_ok = selected_initial_node is None or selected_graph.in_degree(selected_initial_node) == 0
    non_root_indegree_ok = all(
        selected_graph.in_degree(node) <= 1
        for node in selected_graph.nodes
        if str(node) != str(selected_initial_node)
    )
    is_tree = bool(is_dag and is_connected and root_indegree_ok and non_root_indegree_ok)
    is_polytree = bool(is_dag and is_connected and is_tree_undirected and selected_graph.number_of_edges() == selected_graph.number_of_nodes() - 1)
    dominant_rows = _forward_dominant_path(selected_graph, selected_initial_node or "") if heuristic == "forward" else _polytree_dominant_path(selected_graph)
    dominant_path_nodes = [dominant_rows[0]["From"], *[row["To"] for row in dominant_rows]] if dominant_rows else []
    initial_edge = None
    if heuristic == "back_and_forward":
        first = selected_df.iloc[0].to_dict()
        initial_edge = f"{first['From']} -> {first['To']}"

    structure_payload = {
        "algorithm": algorithm,
        "phase": 2,
        "structure": structure,
        "initial_node": selected_initial_node,
        "initial_edge": initial_edge,
        "nodes_selected": int(selected_graph.number_of_nodes()),
        "edges_selected": int(selected_graph.number_of_edges()),
        "selected_weight": selected_weight,
        "total_influence_weight": total_weight,
        "preserved_influence_percent": (selected_weight / total_weight * 100) if total_weight else 0.0,
        "is_dag": is_dag,
        "is_tree": is_tree,
        "is_connected": is_connected,
        "is_tree_undirected": is_tree_undirected,
        "is_polytree": is_polytree,
        "validation": {
            "root_in_degree_zero": bool(root_indegree_ok),
            "non_root_in_degree_lte_1": bool(non_root_indegree_ok),
            "edges_eq_nodes_minus_1": bool(selected_graph.number_of_edges() == selected_graph.number_of_nodes() - 1),
        },
        "warnings": warnings,
        "edges": _records(selected_df),
    }
    selected_df.to_csv(output_dir / output_csv, index=False, encoding="utf-8")
    (output_dir / output_json).write_text(json.dumps(structure_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    pd.DataFrame(dominant_rows).to_csv(output_dir / files["dominant_path_csv"], index=False, encoding="utf-8")
    draw_phase2_structure(selected_graph, output_dir / output_png, algorithm, selected_initial_node)
    draw_phase2_structure(selected_graph, output_dir / files["phase2_structure_png"], "RAMEX-Forum Fase 2 - Estrutura Extraida", selected_initial_node)
    draw_phase2_structure(selected_graph, output_dir / files["phase2_structure_svg"], "RAMEX-Forum Fase 2 - Estrutura Extraida", selected_initial_node)

    sankey = {
        "nodes": sorted(set(selected_df["From"].astype(str)) | set(selected_df["To"].astype(str))),
        "links": [
            {
                "source": str(row["From"]),
                "target": str(row["To"]),
                "value": float(row["Weight"]),
                "direction": str(row["Direction"]),
                "frequency": float(row["Frequency"]),
            }
            for row in selected_df.to_dict(orient="records")
        ],
    }
    (output_dir / files["phase2_sankey_json"]).write_text(json.dumps(sankey, ensure_ascii=False, indent=2), encoding="utf-8")
    metrics = {
        "phase": 2,
        "input": filtered_influence_csv.name,
        "heuristic_used": heuristic,
        "initial_node_mode": initial_node_mode,
        "selected_initial_node": selected_initial_node,
        "initial_edge": initial_edge,
        "nodes_before": int(graph.number_of_nodes()),
        "edges_before": int(graph.number_of_edges()),
        "nodes_after": int(selected_graph.number_of_nodes()),
        "edges_after": int(selected_graph.number_of_edges()),
        "total_influence_weight": total_weight,
        "selected_influence_weight": selected_weight,
        "preserved_influence_percent": (selected_weight / total_weight * 100) if total_weight else 0.0,
        "max_depth": int(max_depth),
        "top_k": int(forward_top_k),
        "is_dag": is_dag,
        "is_tree": is_tree,
        "is_polytree": is_polytree,
        "dominant_path": dominant_path_nodes,
        "warnings": warnings,
    }
    payload = {
        "mode": "ramex_forum_temporal_phase2",
        "phase": "extracao_estrutural",
        "metrics": metrics,
        "structure": structure_payload,
        "selected_edges": _records(selected_df),
        "dominant_path": dominant_rows,
        "sankey": sankey,
        "files": files,
        "interpretation": (
            "Na Fase 2, o RAMEX-Forum transforma a rede temporal de influência numa estrutura interpretável. "
            "Quando existe nó inicial, aplica-se Forward Heuristic. Na ausência de nó inicial claro, aplica-se "
            "Back-and-Forward Heuristic para construir uma Poly-tree de influência."
        ),
    }
    (output_dir / files["metrics_json"]).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def draw_temporal_graph(graph: nx.DiGraph, output_png: Path) -> None:
    if graph.number_of_edges() == 0:
        return

    node_count = graph.number_of_nodes()
    fig_size = (14, 10) if node_count <= 25 else (22, 16) if node_count <= 100 else (34, 24)
    fig, ax = plt.subplots(figsize=fig_size, dpi=220)
    try:
        pos = nx.nx_agraph.graphviz_layout(graph, prog="sfdp")
    except Exception:
        pos = nx.spring_layout(graph, seed=47, weight="weight", iterations=80)

    strengths = {str(node): 0.0 for node in graph.nodes}
    for u, v, data in graph.edges(data=True):
        w = float(data.get("weight", 0.0))
        strengths[str(u)] += w
        strengths[str(v)] += w
    max_strength = max(strengths.values(), default=1.0) or 1.0
    node_sizes = [420 + 1800 * strengths[str(node)] / max_strength for node in graph.nodes]

    max_weight = max((float(data.get("weight", 0.0)) for _, _, data in graph.edges(data=True)), default=1.0) or 1.0
    widths = [0.8 + 5.0 * float(data.get("weight", 0.0)) / max_weight for _, _, data in graph.edges(data=True)]
    edge_colors = ["#0f766e" if graph.has_edge(v, u) else "#7aa7b5" for u, v in graph.edges()]
    node_colors = ["#f8fafc" for _ in graph.nodes]

    nx.draw_networkx_nodes(graph, pos, ax=ax, node_size=node_sizes, node_color=node_colors, edgecolors="#0f766e", linewidths=1.2)
    nx.draw_networkx_edges(
        graph,
        pos,
        ax=ax,
        width=widths,
        edge_color=edge_colors,
        arrows=True,
        arrowstyle="-|>",
        arrowsize=12 if node_count > 50 else 18,
        alpha=0.72,
        connectionstyle="arc3,rad=0.08",
    )
    nx.draw_networkx_labels(graph, pos, ax=ax, font_size=7 if node_count > 60 else 9, font_weight="bold")
    if graph.number_of_edges() <= 80:
        labels = {(u, v): f"{float(data.get('weight', 0.0)):.2f}" for u, v, data in graph.edges(data=True)}
        nx.draw_networkx_edge_labels(graph, pos, labels, ax=ax, font_size=7, label_pos=0.55)

    ax.set_title("RAMEX-Forum - Grafo Temporal de Influencia", fontsize=15, fontweight="bold")
    ax.axis("off")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=260, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def matrix_to_payload(matrix_df: pd.DataFrame, limit: int = 40) -> dict[str, Any]:
    view = matrix_df.iloc[:limit, :limit]
    rows = []
    for idx, row in view.iterrows():
        rows.append({"From": str(idx), **{str(col): float(row[col]) for col in view.columns}})
    return {
        "columns": [str(col) for col in view.columns],
        "rows": rows,
        "total_rows": int(matrix_df.shape[0]),
        "total_columns": int(matrix_df.shape[1]),
        "is_truncated": matrix_df.shape[0] > limit or matrix_df.shape[1] > limit,
    }


def _build_metrics(
    ordered_df: pd.DataFrame,
    influence_df: pd.DataFrame,
    filtered_df: pd.DataFrame,
    graph_edges_df: pd.DataFrame,
    graph: nx.DiGraph,
    latency_max_seconds: float,
    epsilon: float,
    min_frequency: float,
    min_influence: float,
    max_latency_seconds: float | None,
) -> dict[str, Any]:
    has_cycles = False
    try:
        nx.find_cycle(graph, orientation="original")
        has_cycles = True
    except nx.NetworkXNoCycle:
        has_cycles = False
    except Exception:
        has_cycles = False

    filters_active = {
        "min_frequency": float(min_frequency),
        "min_influence": float(min_influence),
        "max_latency": max_latency_seconds,
    }
    return {
        "events": int(len(ordered_df)),
        "entities": int(ordered_df["entity"].nunique()),
        "signals": int(ordered_df["signal"].nunique()),
        "temporal_relations": int(len(graph_edges_df)),
        "raw_influence_relations": int(len(influence_df)),
        "filtered_influence_relations": int(len(filtered_df)),
        "latency_max": latency_max_seconds,
        "epsilon": float(epsilon),
        "filters_active": filters_active,
        "cycles_allowed": True,
        "has_cycles": bool(has_cycles),
        "multiple_inputs_allowed": True,
        "total_influence_weight": float(graph_edges_df["Weight"].sum()) if not graph_edges_df.empty else 0.0,
    }


def run_forum_temporal_phase1(
    events_df: pd.DataFrame,
    output_dir: Path,
    entity_column: str = "entity",
    timestamp_column: str = "timestamp",
    signal_column: str = "signal",
    latency_max: str | int | float | None = DEFAULT_LATENCY_MAX,
    epsilon: float = DEFAULT_EPSILON,
    min_frequency: float = 1.0,
    min_influence: float = 0.0,
    max_latency: str | int | float | None = None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    latency_max_seconds = parse_latency_to_seconds(latency_max)
    max_latency_seconds = parse_latency_to_seconds(max_latency) if max_latency not in {None, ""} else latency_max_seconds

    ordered = prepare_dataset(events_df, entity_column, timestamp_column, signal_column)
    counters = signal_counter(ordered)
    influence = temporal_influence(ordered, latency_max_seconds)
    filtered = apply_epsilon_and_filters(
        influence,
        epsilon=epsilon,
        min_frequency=min_frequency,
        min_influence=min_influence,
        max_latency_seconds=max_latency_seconds,
    )
    graph_edges = graph_edges_from_filtered(filtered)
    matrix = influence_matrix(graph_edges)
    graph = build_temporal_graph(graph_edges)

    files = {
        "ordered_dataset_csv": "forum_ordered_dataset.csv",
        "signal_counter_csv": "forum_signal_counter.csv",
        "temporal_influence_csv": "forum_temporal_influence.csv",
        "filtered_influence_csv": "forum_filtered_influence.csv",
        "influence_matrix_csv": "forum_influence_matrix.csv",
        "influence_matrix_png": "forum_influence_matrix.png",
        "graph_edges_csv": "forum_graph_edges.csv",
        "graph_graphml": "forum_graph.graphml",
        "graph_png": "forum_graph.png",
        "metrics_json": "forum_temporal_phase1_metrics.json",
    }

    ordered.to_csv(output_dir / files["ordered_dataset_csv"], index=False, encoding="utf-8")
    counters.to_csv(output_dir / files["signal_counter_csv"], index=False, encoding="utf-8")
    influence.to_csv(output_dir / files["temporal_influence_csv"], index=False, encoding="utf-8")
    filtered.to_csv(output_dir / files["filtered_influence_csv"], index=False, encoding="utf-8")
    graph_edges.to_csv(output_dir / files["graph_edges_csv"], index=False, encoding="utf-8")
    matrix.to_csv(output_dir / files["influence_matrix_csv"], encoding="utf-8")
    draw_influence_heatmap(matrix, output_dir / files["influence_matrix_png"])
    draw_temporal_graph(graph, output_dir / files["graph_png"])
    if graph.number_of_nodes() > 0:
        nx.write_graphml(graph, output_dir / files["graph_graphml"])

    metrics = _build_metrics(
        ordered, influence, filtered, graph_edges, graph,
        latency_max_seconds, epsilon, min_frequency, min_influence, max_latency_seconds,
    )
    top_edges = _records(graph_edges, limit=200)
    payload = {
        "mode": "ramex_forum_temporal_phase1",
        "phase": "transformacao_temporal_do_problema",
        "parameters": {
            "entity_column": entity_column,
            "timestamp_column": timestamp_column,
            "signal_column": signal_column,
            "latency_max": latency_max,
            "latency_max_seconds": latency_max_seconds,
            "epsilon": float(epsilon),
            "min_frequency": float(min_frequency),
            "min_influence": float(min_influence),
            "max_latency_seconds": max_latency_seconds,
        },
        "metrics": metrics,
        "signal_counter": {"rows": _records(counters, limit=200), "total_rows": int(len(counters))},
        "temporal_influence": {"edges": top_edges, "total_edges": int(len(graph_edges))},
        "influence_graph": {"mode": "temporal_influence_graph", "cycles_allowed": True, "edges": top_edges},
        "influence_matrix": matrix_to_payload(matrix),
        "interpretation": (
            "O dataset original foi transformado numa rede temporal de influência, onde cada nó representa "
            "um sinal/evento e cada aresta representa uma influência temporal suavizada e filtrada."
        ),
        "notes": [
            "RAMEX-Forum usa influência temporal, sinais, latência máxima, epsilon smoothing e filtragem de ruído.",
            "Os pesos são absolutos suavizados; não há normalização probabilística nesta fase.",
            "Ciclos e múltiplas entradas são permitidos na rede temporal G_forum.",
        ],
        "files": files,
    }
    (output_dir / files["metrics_json"]).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
