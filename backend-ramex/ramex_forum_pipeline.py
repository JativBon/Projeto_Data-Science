from __future__ import annotations
# pyright: reportMissingImports=false

import json
import os
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib  # type: ignore
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # type: ignore
import networkx as nx  # type: ignore
import pandas as pd  # type: ignore


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    return [{str(k): v for k, v in rec.items()} for rec in records]


def _safe_float(value: Any) -> float:
    try:
        parsed = float(value)
        return parsed if pd.notna(parsed) else 0.0
    except (TypeError, ValueError):
        return 0.0


def prepare_forum_edges(edges_df: pd.DataFrame) -> pd.DataFrame:
    missing = {"From", "To", "Weight"} - set(edges_df.columns)
    if missing:
        raise ValueError(f"Colunas obrigatórias ausentes para RAMEX-Forum: {sorted(missing)}")

    df = edges_df[["From", "To", "Weight"]].copy()
    df["From"] = df["From"].astype(str)
    df["To"] = df["To"].astype(str)
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce").fillna(0)
    df = df[df["Weight"] > 0].copy()
    if df.empty:
        raise ValueError("RAMEX-Forum não encontrou relações com peso positivo.")

    df["RelativeWeight"] = (df["Weight"] / df.groupby("From")["Weight"].transform("sum") * 100).fillna(0)
    df.sort_values(["From", "RelativeWeight", "Weight", "To"], ascending=[True, False, False, True], inplace=True)
    df["Rank"] = df.groupby("From").cumcount() + 1
    return df.reset_index(drop=True)


def build_graph(edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for rec in edges_df.to_dict(orient="records"):
        row = {str(k): v for k, v in rec.items()}
        graph.add_edge(
            str(row.get("From", "")),
            str(row.get("To", "")),
            weight=_safe_float(row.get("Weight")),
            relative_weight=_safe_float(row.get("RelativeWeight")),
        )
    return graph


def select_simplified_influence(edges_df: pd.DataFrame) -> pd.DataFrame:
    selected: list[dict[str, Any]] = []
    graph = nx.DiGraph()
    seen_origins: set[str] = set()

    for rec in edges_df.sort_values(["RelativeWeight", "Weight"], ascending=[False, False]).to_dict(orient="records"):
        row = {str(k): v for k, v in rec.items()}
        if row["From"] in seen_origins:
            continue
        graph.add_edge(row["From"], row["To"])
        if nx.is_directed_acyclic_graph(graph):
            selected.append(row)
            seen_origins.add(row["From"])
        else:
            graph.remove_edge(row["From"], row["To"])

    if not selected:
        return edges_df.head(0).copy()
    return pd.DataFrame(selected).sort_values(["RelativeWeight", "Weight"], ascending=[False, False]).reset_index(drop=True)


def centrality_payload(graph: nx.DiGraph, edges_df: pd.DataFrame) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    out_strength = edges_df.groupby("From")["Weight"].sum().to_dict()
    in_strength = edges_df.groupby("To")["Weight"].sum().to_dict()
    total_weight = float(edges_df["Weight"].sum()) or 1.0

    try:
        betweenness = (
            {node: 0.0 for node in graph.nodes}
            if graph.number_of_edges() > 2000
            else nx.betweenness_centrality(graph, weight="weight", normalized=True)
        )
    except Exception:
        betweenness = {node: 0.0 for node in graph.nodes}

    nodes = [
        {
            "id": str(node),
            "out_strength": (out_w := float(out_strength.get(node, 0.0))),
            "in_strength": (in_w := float(in_strength.get(node, 0.0))),
            "out_relative_strength": out_w / total_weight * 100,
            "in_relative_strength": in_w / total_weight * 100,
            "degree": int(graph.degree(node)),
            "betweenness": float(betweenness.get(node, 0.0)),
        }
        for node in sorted(graph.nodes)
    ]

    if not nodes:
        return nodes, {"most_influential": {}, "most_received": {}}

    most_influential = max(nodes, key=lambda n: (n["out_strength"], n["degree"], n["id"]))
    most_received = max(nodes, key=lambda n: (n["in_strength"], n["degree"], n["id"]))
    return nodes, {"most_influential": most_influential, "most_received": most_received}


def dominant_paths(edges_df: pd.DataFrame, max_path_length: int = 6, limit: int = 3) -> list[dict[str, Any]]:
    outgoing: dict[str, list[dict[str, Any]]] = {}
    for rec in edges_df.sort_values(["RelativeWeight", "Weight"], ascending=[False, False]).to_dict(orient="records"):
        row = {str(k): v for k, v in rec.items()}
        outgoing.setdefault(str(row["From"]), []).append(row)

    starts = (
        edges_df.groupby("From")["Weight"].sum()
        .sort_values(ascending=False)
        .head(limit).index.astype(str).tolist()
    )

    paths = []
    for start in starts:
        path, edges, current, seen = [start], [], start, {start}
        for _ in range(max_path_length - 1):
            candidates = [e for e in outgoing.get(current, []) if str(e["To"]) not in seen]
            if not candidates:
                break
            edge = candidates[0]
            edges.append(edge)
            current = str(edge["To"])
            path.append(current)
            seen.add(current)

        if edges:
            paths.append({
                "start": start,
                "path": path,
                "edges": _records(pd.DataFrame(edges)),
                "total_weight": float(sum(_safe_float(e["Weight"]) for e in edges)),
                "average_relative_weight": float(sum(_safe_float(e["RelativeWeight"]) for e in edges) / len(edges)),
            })
    return paths


def draw_forum_graph(
    graph: nx.DiGraph,
    output_png: Path,
    title: str,
    simplified: bool = False,
    highlight_path: list[str] | None = None,
) -> None:
    if graph.number_of_edges() == 0:
        return

    graph_to_draw = graph
    if graph.number_of_edges() > 350:
        top_edges = sorted(
            graph.edges(data=True),
            key=lambda e: (float(e[2].get("relative_weight", 0.0)), float(e[2].get("weight", 0.0))),
            reverse=True,
        )[:350]
        graph_to_draw = nx.DiGraph()
        graph_to_draw.add_nodes_from(graph.nodes)
        for u, v, data in top_edges:
            graph_to_draw.add_edge(u, v, **data)

    n_nodes = graph_to_draw.number_of_nodes()
    n_edges_draw = graph_to_draw.number_of_edges()

    # layout hierárquico para grafos simplificados; sfdp para grafos de influência densos
    for prog in (["dot"] if simplified else ["sfdp", "fdp"]):
        try:
            pos = nx.nx_agraph.graphviz_layout(graph_to_draw, prog=prog)
            break
        except Exception:
            pos = None
    if pos is None:
        pos = nx.spring_layout(graph_to_draw, seed=42, weight="relative_weight", iterations=50, k=2.0)

    # figsize dinâmico: grafos maiores precisam de mais espaço
    fig_w = max(18, min(32, n_nodes * 0.55))
    fig_h = max(14, min(26, n_nodes * 0.45))
    plt.figure(figsize=(fig_w, fig_h), dpi=200)

    strengths = {node: 0.0 for node in graph_to_draw.nodes}
    for u, v, data in graph_to_draw.edges(data=True):
        strengths[u] += float(data.get("weight", 0.0))
        strengths[v] += float(data.get("weight", 0.0))
    max_strength = max(strengths.values(), default=1.0) or 1.0
    # Tamanho mínimo maior para garantir legibilidade dos labels
    node_sizes = [900 + 2800 * strengths[n] / max_strength for n in graph_to_draw.nodes]

    edge_data = [(float(d.get("relative_weight", 0.0)), u, v, d) for u, v, d in graph_to_draw.edges(data=True)]
    max_rel = max((rw for rw, *_ in edge_data), default=1.0) or 1.0
    widths = [0.6 + 4.5 * rw / max_rel for rw, *_ in edge_data]
    edge_colors = ["#1f5f78" if rw >= max_rel * 0.65 else "#7aafc0" for rw, *_ in edge_data]

    highlight = set(highlight_path or [])
    node_colors = ["#d8903f" if n in highlight else "#dceef5" for n in graph_to_draw.nodes]

    nx.draw_networkx_nodes(
        graph_to_draw, pos, node_size=node_sizes, node_color=node_colors,
        edgecolors="#315f72", linewidths=1.8,
    )
    nx.draw_networkx_edges(
        graph_to_draw, pos, width=widths, edge_color=edge_colors, alpha=0.70,
        arrows=True, arrowstyle="-|>",
        arrowsize=14 if n_edges_draw > 80 else 22,
    )
    font_sz = 8 if n_nodes > 50 else (9 if n_nodes > 30 else 11)
    nx.draw_networkx_labels(
        graph_to_draw, pos, font_size=font_sz, font_weight="bold", font_color="#0f172a",
    )

    if n_edges_draw <= 80:
        edge_labels = {(u, v): f"{float(d.get('relative_weight', 0.0)):.1f}%" for u, v, d in graph_to_draw.edges(data=True)}
        nx.draw_networkx_edge_labels(
            graph_to_draw, pos, edge_labels=edge_labels,
            font_size=max(7, font_sz - 1), label_pos=0.55,
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor="none", alpha=0.78),
        )

    plt.title(title, fontsize=16, fontweight="bold", pad=12)
    plt.axis("off")
    plt.tight_layout(pad=1.5)
    plt.savefig(output_png, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close()


def build_report(metrics: dict[str, Any], paths: list[dict[str, Any]]) -> str:
    top = metrics.get("top_relation") or {}
    dominant = " -> ".join(paths[0]["path"]) if paths else "Não disponível"
    return f"""# Relatório RAMEX-Forum

O RAMEX-Forum não substitui o RAMEX 2007 formal. Atua como abordagem complementar para exploração temporal de sinais, latência e influência.

## Métricas principais

- Nós: {metrics.get("nodes")}
- Arestas: {metrics.get("edges")}
- Soma dos pesos absolutos: {metrics.get("total_weight")}
- Nó mais influente: {metrics.get("most_influential_node")}
- Nó mais recebido: {metrics.get("most_received_node")}
- Relação principal: {top.get("from")} -> {top.get("to")} ({top.get("relative_weight", 0):.2f}%)
- Caminho dominante: {dominant}

## Interpretação

As frequências absolutas identificam quantas vezes uma transição ocorreu. Os pesos relativos mostram a importância de cada destino face às alternativas de saída da mesma origem.
"""


def run_ramex_forum(edges_df: pd.DataFrame, output_dir: Path, max_path_length: int = 6) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    forum_edges = prepare_forum_edges(edges_df)
    graph = build_graph(forum_edges)
    simplified_edges = select_simplified_influence(forum_edges)
    simplified_graph = build_graph(simplified_edges) if not simplified_edges.empty else nx.DiGraph()
    central_nodes, central_summary = centrality_payload(graph, forum_edges)
    paths = dominant_paths(forum_edges, max_path_length=max_path_length)

    top_relation = forum_edges.sort_values(["Weight", "RelativeWeight"], ascending=[False, False]).iloc[0].to_dict()
    metrics = {
        "nodes": graph.number_of_nodes(),
        "edges": graph.number_of_edges(),
        "total_weight": float(forum_edges["Weight"].sum()),
        "density": nx.density(graph) if graph.number_of_nodes() > 1 else 0.0,
        "normalized_relations": len(forum_edges),
        "most_influential_node": central_summary["most_influential"].get("id"),
        "most_received_node": central_summary["most_received"].get("id"),
        "top_relation": {
            "from": str(top_relation["From"]),
            "to": str(top_relation["To"]),
            "weight": float(top_relation["Weight"]),
            "relative_weight": float(top_relation["RelativeWeight"]),
        },
        "dominant_path": paths[0]["path"] if paths else [],
        "average_relative_weight": float(forum_edges["RelativeWeight"].mean()),
    }

    files = {
        "edges_csv": "ramex_forum_edges.csv",
        "metrics_json": "ramex_forum_metrics.json",
        "graph_png": "ramex_forum_graph.png",
        "simplified_png": "ramex_forum_simplified.png",
        "report_md": "ramex_forum_report.md",
    }

    forum_edges.to_csv(output_dir / files["edges_csv"], index=False, encoding="utf-8")
    draw_forum_graph(graph, output_dir / files["graph_png"], "RAMEX-Forum - Grafo de Influência")
    draw_forum_graph(
        simplified_graph, output_dir / files["simplified_png"],
        "RAMEX-Forum - Estrutura Simplificada de Influência",
        simplified=True, highlight_path=metrics["dominant_path"],
    )

    report = build_report(metrics, paths)
    payload = {
        "mode": "ramex_forum",
        "metrics": metrics,
        "influence_graph": {
            "mode": "influence_graph",
            "normalized": True,
            "edges": _records(forum_edges),
        },
        "simplified_influence": {
            "mode": "simplified_influence",
            "selection_rule": "highest_relative_weight_per_origin",
            "edges": _records(simplified_edges),
        },
        "path_analysis": {
            "central_nodes": central_nodes,
            "dominant_paths": paths,
            "most_influential_node": metrics["most_influential_node"],
            "most_received_node": metrics["most_received_node"],
        },
        "interpretation": (
            "O RAMEX-Forum complementa o RAMEX 2007 formal ao destacar influência temporal, nós influentes "
            "e caminhos dominantes, sem substituir a arborescência formal do RAMEX 2007."
        ),
        "files": files,
    }
    (output_dir / files["metrics_json"]).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / files["report_md"]).write_text(report, encoding="utf-8")
    return payload
