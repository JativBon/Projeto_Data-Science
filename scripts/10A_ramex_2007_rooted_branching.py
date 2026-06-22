"""
10A_ramex_2007_rooted_branching.py

Esta fase implementa o RAMEX 2007 formal através de Maximum Weight Rooted
Branching, conforme o artigo de Cavique (2007). Não usa a expansão greedy local
mantida em 07_ramex_simplificado.py.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
from ramex_validation import validate_rooted_branching as common_validate_rooted_branching

REQUIRED_EDGE_COLUMNS = ["From", "To", "Weight"]
METHOD_NAME = "maximum_weight_rooted_branching"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RAMEX 2007 formal - Maximum Weight Rooted Branching.")
    parser.add_argument("input_edges_csv", help="CSV de arestas com colunas From, To, Weight.")
    parser.add_argument("output_csv", help="CSV de saida.")
    parser.add_argument("output_png", help="PNG de saida.")
    parser.add_argument("--root", default=None, help="No raiz a usar.")
    parser.add_argument("--auto-root", action="store_true", help="Escolher raiz automaticamente.")
    parser.add_argument("--allow-self-loops", action="store_true", help="Manter self-loops no input.")
    parser.add_argument("--output-json", default=None, help="JSON a gerar.")
    parser.add_argument("--output-dot", default=None, help="DOT opcional.")
    parser.add_argument("--output-expanded-paths", default=None, help="CSV opcional com caminhos dominantes da expansão.")
    parser.add_argument("--compare-simplified", action="store_true", help="Gerar comparação técnica com a heuristica 07.")
    parser.add_argument("--input-type", choices=["edges"], default="edges", help="Mantido por compatibilidade.")
    args = parser.parse_args()
    if args.root and args.auto_root:
        parser.error("Use apenas --root ou --auto-root, não ambos.")
    return args


def fmt_weight(weight: float) -> int | float:
    return int(weight) if float(weight).is_integer() else round(float(weight), 6)


def load_edges(path: Path, allow_self_loops: bool) -> tuple[nx.DiGraph, list[str]]:
    warnings: list[str] = []
    if not path.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {path}")
    if path.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio: {path}")

    try:
        df = pd.read_csv(path, encoding="utf-8")
    except pd.errors.EmptyDataError as exc:
        raise ValueError("O CSV de arestas está vazio.") from exc

    if missing := [column for column in REQUIRED_EDGE_COLUMNS if column not in df.columns]:
        raise ValueError(f"Colunas obrigatorias em falta: {missing}")

    original_len = len(df)
    df = df[REQUIRED_EDGE_COLUMNS].copy()
    df["From"] = df["From"].astype("string").str.strip()
    df["To"] = df["To"].astype("string").str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    valid_mask = df["From"].notna() & df["To"].notna() & df["Weight"].notna() & (df["Weight"] > 0)
    invalid_count = int(original_len - valid_mask.sum())
    if invalid_count:
        warnings.append(f"Ignoradas {invalid_count} arestas inválidas ou com peso não positivo.")

    df = df.loc[valid_mask].copy()
    df["From"] = df["From"].astype(str)
    df["To"] = df["To"].astype(str)
    df["Weight"] = df["Weight"].astype(float)

    if not allow_self_loops:
        loop_mask = df["From"] == df["To"]
        loop_count = int(loop_mask.sum())
        if loop_count:
            warnings.append(f"Removidos {loop_count} self-loops.")
            df = df.loc[~loop_mask].copy()

    if df.empty:
        raise ValueError("Não existem arestas válidas com peso positivo.")

    df = (
        df.groupby(["From", "To"], as_index=False)["Weight"]
        .sum()
        .sort_values(by="Weight", ascending=False, kind="stable")
        .reset_index(drop=True)
    )

    graph = nx.DiGraph()
    graph.add_weighted_edges_from(df[REQUIRED_EDGE_COLUMNS].itertuples(index=False))
    if graph.number_of_edges() == 0:
        raise ValueError("Grafo vazio após validação das arestas.")
    return graph, warnings


def node_weight_sums(graph: nx.DiGraph, node: str) -> tuple[float, float]:
    out_weight = sum(float(data["weight"]) for _, _, data in graph.out_edges(node, data=True))
    in_weight = sum(float(data["weight"]) for _, _, data in graph.in_edges(node, data=True))
    return out_weight, in_weight


def choose_auto_root(graph: nx.DiGraph, warnings: list[str]) -> tuple[str, str]:
    by_upper = {str(node).upper(): str(node) for node in graph.nodes}
    for special in ("SOURCE", "START"):
        if special in by_upper:
            return by_upper[special], special

    no_incoming = [str(node) for node in graph.nodes if graph.in_degree(node) == 0]
    if len(no_incoming) == 1:
        return no_incoming[0], "single_zero_indegree"
    if len(no_incoming) > 1:
        chosen = min(no_incoming, key=lambda node: (-node_weight_sums(graph, node)[0], -graph.out_degree(node), node))
        return chosen, "zero_indegree_highest_out_weight"

    chosen = min(
        (str(node) for node in graph.nodes),
        key=lambda node: (
            -node_weight_sums(graph, node)[0],
            -(node_weight_sums(graph, node)[0] - node_weight_sums(graph, node)[1]),
            -graph.out_degree(node),
            node,
        ),
    )
    warnings.append("No SOURCE/START não existe e o grafo não tem nós sem entradas; foi escolhida uma raiz real dominante.")
    return chosen, "dominant_real_root"


def select_root(graph: nx.DiGraph, requested_root: str | None, auto_root: bool, warnings: list[str]) -> tuple[str, str]:
    if requested_root:
        root = str(requested_root).strip()
        if root not in graph:
            raise ValueError(f"Raiz indicada não existe no grafo: {root}")
        return root, "provided_root"
    if auto_root or requested_root is None:
        return choose_auto_root(graph, warnings)
    raise ValueError("Indique --root <node> ou --auto-root.")


def reachable_subgraph(graph: nx.DiGraph, root: str, warnings: list[str]) -> nx.DiGraph:
    reachable = set(nx.descendants(graph, root)) | {root}
    unreachable = set(graph.nodes) - reachable
    if unreachable:
        warnings.append("Nem todos os nós são alcançáveis a partir da raiz; a arborescência cobre apenas o subgrafo alcançável.")

    subgraph = nx.DiGraph(graph.subgraph(reachable).copy())
    if subgraph.number_of_nodes() <= 1:
        raise ValueError("O subgrafo alcançável a partir da raiz não contém nós suficientes.")
    if subgraph.number_of_edges() == 0:
        raise ValueError("O subgrafo alcançável a partir da raiz não contém arestas.")
    return subgraph


def maximum_weight_rooted_branching(graph: nx.DiGraph, root: str | None = None, warnings: list[str] | None = None) -> nx.DiGraph:
    if warnings is None:
        warnings = []
    if root is None:
        root, root_selection = choose_auto_root(graph, warnings)
    else:
        root = str(root)
        root_selection = "provided_root"
    if root not in graph:
        raise ValueError(f"Raiz indicada não existe no grafo: {root}")

    working = nx.DiGraph(graph.copy())
    working.remove_edges_from(list(working.in_edges(root)))
    branching = nx.algorithms.tree.branchings.maximum_spanning_arborescence(
        working,
        attr="weight",
        default=0,
        preserve_attrs=True,
    )

    tree = nx.DiGraph()
    tree.add_nodes_from(str(node) for node in branching.nodes)
    for source, target, data in branching.edges(data=True):
        tree.add_edge(str(source), str(target), weight=float(data.get("weight", 0)))
    tree.graph["root"] = root
    tree.graph["root_selection"] = root_selection
    return tree


def validate_ramex2007_arborescence(tree: nx.DiGraph, root: str, original_graph: nx.DiGraph) -> dict[str, Any]:
    return common_validate_rooted_branching(tree, root, original_graph)

def validate_rooted_branching(tree: nx.DiGraph, root: str) -> dict[str, Any]:
    validation = common_validate_rooted_branching(tree, root)
    if not validation["is_valid_rooted_branching"]:
        raise ValueError("; ".join(validation["validation_messages"]))
    return validation

def tree_rows(tree: nx.DiGraph, root: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    levels = nx.single_source_shortest_path_length(tree, root)
    ordered_edges = sorted(tree.edges(data=True), key=lambda edge: (levels.get(edge[0], 0), str(edge[0]), str(edge[1])))
    rows = [
        {
            "From": str(source),
            "To": str(target),
            "Weight": fmt_weight(float(data["weight"])),
            "Level": int(levels.get(target, levels.get(source, 0) + 1)),
        }
        for source, target, data in ordered_edges
    ]
    return rows, {str(node): int(level) for node, level in levels.items()}


def expand_dominant_paths(tree: nx.DiGraph, root: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    leaves = sorted([str(node) for node in tree.nodes if tree.out_degree(node) == 0])
    rows: list[dict[str, Any]] = []
    for leaf in leaves:
        try:
            path = [str(node) for node in nx.shortest_path(tree, root, leaf)]
        except nx.NetworkXNoPath:
            continue
        edge_weights = [
            float(tree[source][target].get("weight", 0.0))
            for source, target in zip(path, path[1:])
        ]
        path_weight = sum(edge_weights)
        bottleneck_weight = min(edge_weights) if edge_weights else 0.0
        rows.append({
            "path": " -> ".join(path),
            "start": path[0] if path else root,
            "end": leaf,
            "branch_depth": max(len(path) - 1, 0),
            "path_weight": fmt_weight(path_weight),
            "bottleneck_weight": fmt_weight(bottleneck_weight),
            "edges": max(len(path) - 1, 0),
        })

    branching_values = [int(tree.out_degree(node)) for node in tree.nodes if tree.out_degree(node) > 0]
    metrics = {
        "dominant_paths_count": len(rows),
        "max_branch_depth": max((int(row["branch_depth"]) for row in rows), default=0),
        "average_branching_factor": (sum(branching_values) / len(branching_values)) if branching_values else 0.0,
        "max_branching_factor": max(branching_values, default=0),
    }
    rows.sort(key=lambda row: (-float(row["path_weight"]), -int(row["branch_depth"]), str(row["path"])))
    return rows, metrics


def hierarchical_layout(tree: nx.DiGraph, root: str, levels: dict[str, int]) -> dict[str, tuple[float, float]]:
    try:
        return nx.nx_agraph.graphviz_layout(tree, prog="dot", args="-Grankdir=LR")
    except Exception:
        try:
            layout_graph = tree.copy()
            for node in layout_graph.nodes:
                layout_graph.nodes[node]["subset"] = levels.get(str(node), 0)
            return nx.multipartite_layout(layout_graph, subset_key="subset", align="horizontal", scale=8)
        except Exception:
            grouped: dict[int, list[str]] = {}
            for node in tree.nodes:
                grouped.setdefault(levels.get(str(node), 0), []).append(str(node))
            positions: dict[str, tuple[float, float]] = {}
            for level, nodes in sorted(grouped.items()):
                ordered = sorted(nodes)
                width = max(len(ordered) - 1, 1)
                for index, node in enumerate(ordered):
                    positions[node] = (index - width / 2, -level)
            return positions


def dominant_path_edges(tree: nx.DiGraph, root: str) -> set[tuple[str, str]]:
    best_path: list[str] = []
    best_weight = -1.0
    for leaf in [str(node) for node in tree.nodes if tree.out_degree(node) == 0]:
        if root not in tree or not nx.has_path(tree, root, leaf):
            continue
        path = [str(node) for node in nx.shortest_path(tree, root, leaf)]
        weight = sum(float(tree[source][target].get("weight", 0.0)) for source, target in zip(path, path[1:]))
        if weight > best_weight:
            best_weight = weight
            best_path = path
    return set(zip(best_path, best_path[1:]))


def draw_tree(tree: nx.DiGraph, root: str, output_png: Path) -> None:
    _, levels = tree_rows(tree, root)
    pos = hierarchical_layout(tree, root, levels)
    node_count = tree.number_of_nodes()
    if node_count <= 20:
        figsize = (14, 10)
    elif node_count <= 100:
        figsize = (22, 16)
    else:
        figsize = (36, 24)
    small = node_count <= 35
    medium = node_count <= 100
    node_sizes = [
        2600 if str(node) == root else 2300 if str(node).upper() == "SINK" else 1500 if small else 820 if medium else 470
        for node in tree.nodes
    ]
    colors = [
        "#f4b183" if str(node) == root else "#334155" if str(node).upper() == "SINK" else "#dce9ee"
        for node in tree.nodes
    ]
    label_colors = {str(node): ("#ffffff" if str(node).upper() == "SINK" else "#111827") for node in tree.nodes}
    max_weight = max((float(data["weight"]) for _, _, data in tree.edges(data=True)), default=1.0)
    dom_edges = dominant_path_edges(tree, root)
    widths = [0.8 + 6.2 * (float(data["weight"]) / max_weight) for _, _, data in tree.edges(data=True)]
    edge_colors = ["#0f766e" if (str(u), str(v)) in dom_edges else "#8aa3b1" for u, v, _ in tree.edges(data=True)]
    edge_alpha = [0.95 if (str(u), str(v)) in dom_edges else 0.58 for u, v, _ in tree.edges(data=True)]
    label_font = 9 if small else 6 if medium else 4
    edge_label_font = 8 if small else 5 if medium else 3

    plt.figure(figsize=figsize)
    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes, edgecolors="#1f2937", linewidths=1.0)
    for (source, target, data), width, color, alpha in zip(tree.edges(data=True), widths, edge_colors, edge_alpha):
        nx.draw_networkx_edges(
            tree,
            pos,
            edgelist=[(source, target)],
            arrows=True,
            arrowstyle="-|>",
            arrowsize=22 if small else 14 if medium else 8,
            width=width,
            edge_color=color,
            alpha=alpha,
            connectionstyle="arc3,rad=0.02",
        )
    nx.draw_networkx_labels(tree, pos, font_size=label_font, font_weight="bold", font_color="#111827")
    if "SINK" in {str(node).upper() for node in tree.nodes}:
        sink_labels = {node: str(node) for node in tree.nodes if str(node).upper() == "SINK"}
        nx.draw_networkx_labels(tree, pos, labels=sink_labels, font_size=label_font, font_weight="bold", font_color="#ffffff")
    if node_count <= 120:
        nx.draw_networkx_edge_labels(
            tree,
            pos,
            edge_labels={(u, v): str(fmt_weight(float(data["weight"]))) for u, v, data in tree.edges(data=True)},
            font_size=edge_label_font,
            bbox={"boxstyle": "round,pad=0.12", "fc": "white", "ec": "#cbd5e1", "alpha": 0.88},
        )
    plt.title("RAMEX 2007 — Arborescência Dirigida por Maximum Weight Rooted Branching", fontsize=18, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
    plt.close()


def simplified_greedy_comparison(graph: nx.DiGraph, root: str) -> nx.DiGraph:
    tree = nx.DiGraph()
    tree.add_node(root)
    visited = {root}
    while True:
        candidates = [(source, target, float(data["weight"])) for source in visited for _, target, data in graph.out_edges(source, data=True) if target not in visited]
        if not candidates:
            break
        source, target, weight = min(candidates, key=lambda edge: (-edge[2], str(edge[0]), str(edge[1])))
        tree.add_edge(str(source), str(target), weight=weight)
        if not nx.is_directed_acyclic_graph(tree):
            tree.remove_edge(source, target)
            visited.add(target)
            continue
        visited.add(target)
    return tree


def comparison_row(method: str, tree: nx.DiGraph, total_weight: float, root: str) -> dict[str, Any]:
    selected_weight = sum(float(data["weight"]) for _, _, data in tree.edges(data=True))
    try:
        valid = bool(validate_rooted_branching(tree, root)["is_arborescence"])
    except Exception:
        valid = False
    return {
        "method": method,
        "edges": tree.number_of_edges(),
        "selected_weight": selected_weight,
        "preserved_weight_percent": (selected_weight / total_weight * 100) if total_weight else 0,
        "structurally_valid": valid,
    }


def write_compare_simplified(graph: nx.DiGraph, formal_tree: nx.DiGraph, root: str, output_csv: Path) -> list[dict[str, Any]]:
    total_weight = sum(float(data["weight"]) for _, _, data in graph.edges(data=True))
    simplified_tree = simplified_greedy_comparison(graph, root)
    rows = [
        comparison_row("RAMEX 2007 Rooted Branching", formal_tree, total_weight, root),
        comparison_row("RAMEX simplificado - heuristica greedy", simplified_tree, total_weight, root),
    ]
    pd.DataFrame(rows).to_csv(output_csv.with_name(output_csv.stem + "_compare_simplified.csv"), index=False, encoding="utf-8")
    return rows


def canonical_export_paths(output_csv: Path, output_json: Path, output_png: Path) -> dict[str, Path]:
    return {
        "edges_csv": output_csv.parent / "ramex2007_edges.csv",
        "nodes_csv": output_csv.parent / "ramex2007_nodes.csv",
        "tree_json": output_json.parent / "ramex2007_tree.json",
        "metrics_json": output_json.parent / "ramex2007_metrics.json",
        "tree_png": output_png.parent / "ramex2007_tree.png",
        "tree_paper_style_png": output_png.parent / "ramex2007_tree_paper_style.png",
    }


def export_outputs(
    graph: nx.DiGraph,
    reachable_graph: nx.DiGraph,
    tree: nx.DiGraph,
    root: str,
    root_selection: str,
    args: argparse.Namespace,
    warnings: list[str],
) -> dict[str, Any]:
    validation = validate_ramex2007_arborescence(tree, root, graph)
    rows, levels = tree_rows(tree, root)
    if not rows:
        raise ValueError("Não foram selecionadas arestas para exportar.")

    output_csv = Path(args.output_csv)
    output_png = Path(args.output_png)
    output_json = Path(args.output_json) if args.output_json else Path("data/json") / output_csv.with_suffix(".json").name
    canonical_paths = canonical_export_paths(output_csv, output_json, output_png)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    edge_rows_df = pd.DataFrame(rows, columns=["From", "To", "Weight", "Level"])
    edge_rows_df.to_csv(output_csv, index=False, encoding="utf-8")
    edge_rows_df.to_csv(canonical_paths["edges_csv"], index=False, encoding="utf-8")
    draw_tree(tree, root, output_png)
    paper_style_png = output_png.with_name(output_png.stem + "_paper_style.png")
    shutil.copyfile(output_png, paper_style_png)
    complete_png = output_png.with_name(output_png.stem + "_tree_complete.png")
    if complete_png != output_png:
        shutil.copyfile(output_png, complete_png)
    shutil.copyfile(output_png, canonical_paths["tree_png"])
    shutil.copyfile(paper_style_png, canonical_paths["tree_paper_style_png"])

    total_weight_original = sum(float(data["weight"]) for _, _, data in graph.edges(data=True))
    reachable_total_weight = sum(float(data["weight"]) for _, _, data in reachable_graph.edges(data=True))
    selected_weight = sum(float(data["weight"]) for _, _, data in tree.edges(data=True))
    preserved = (selected_weight / total_weight_original * 100) if total_weight_original else 0
    preserved_reachable = (selected_weight / reachable_total_weight * 100) if reachable_total_weight else 0
    original_has_cycles = not nx.is_directed_acyclic_graph(graph)
    removed_edges = graph.number_of_edges() - tree.number_of_edges()
    compression_ratio = (tree.number_of_edges() / graph.number_of_edges()) if graph.number_of_edges() else 0
    expanded_paths, expansion_metrics = expand_dominant_paths(tree, root)
    compare_rows = write_compare_simplified(reachable_graph, tree, root, output_csv) if args.compare_simplified else []

    expanded_paths_csv = Path(args.output_expanded_paths) if args.output_expanded_paths else output_csv.with_name(output_csv.stem + "_expanded_paths.csv")
    pd.DataFrame(
        expanded_paths,
        columns=["path", "start", "end", "branch_depth", "path_weight", "bottleneck_weight", "edges"],
    ).to_csv(expanded_paths_csv, index=False, encoding="utf-8")

    node_rows = [
        {
            "Node": str(node),
            "Level": levels.get(str(node), 0),
            "IsRoot": str(node) == root,
            "InDegree": int(tree.in_degree(node)),
            "OutDegree": int(tree.out_degree(node)),
        }
        for node in sorted(tree.nodes, key=lambda item: (levels.get(str(item), 0), str(item)))
    ]
    pd.DataFrame(node_rows, columns=["Node", "Level", "IsRoot", "InDegree", "OutDegree"]).to_csv(
        canonical_paths["nodes_csv"],
        index=False,
        encoding="utf-8",
    )

    final_label = (
        "RAMEX 2007 formal"
        if validation["is_valid_arborescence"]
        else "Estrutura RAMEX 2007 inválida — requer revisão."
    )

    payload = {
        "algorithm": final_label,
        "display_title": final_label,
        "method": METHOD_NAME,
        "artifact_type": "ramex2007_formal" if validation["is_valid_arborescence"] else "ramex2007_invalid_structure",
        "paper_alignment": {
            "main_phases": [
                "transformacao_da_base_de_dados_em_rede_de_transicao_de_estados",
                "pesquisa_de_sequencia_de_ramificacao_altamente_provavel",
            ],
            "condensation": "Maximum Weight Rooted Branching (Fulkerson/Edmonds)",
            "expansion": "percurso da arborescencia B para reconstruir caminhos dominantes",
            "complexity": "O(N^2)",
        },
        "root": root,
        "root_selection": root_selection,
        "nodes_original": graph.number_of_nodes(),
        "edges_original": graph.number_of_edges(),
        "nodes_selected": tree.number_of_nodes(),
        "edges_selected": tree.number_of_edges(),
        "total_weight_original": total_weight_original,
        "selected_weight": selected_weight,
        "preserved_weight_percent": preserved,
        "reachable_total_weight": reachable_total_weight,
        "preserved_reachable_weight_percent": preserved_reachable,
        "is_dag": validation["is_dag"],
        "is_arborescence": validation["is_valid_arborescence"],
        "is_valid_arborescence": validation["is_valid_arborescence"],
        "root_in_degree": validation["root_in_degree"],
        "max_non_root_in_degree": validation["max_non_root_in_degree"],
        "reachable_from_root": validation["all_reachable_from_root"],
        "original_graph_has_cycles": original_has_cycles,
        "original_graph_can_contain_cycles": True,
        "expanded_paths_csv": str(expanded_paths_csv),
        "tree_complete_png": str(complete_png),
        "tree_paper_style_png": str(paper_style_png),
        "canonical_exports": {key: str(path) for key, path in canonical_paths.items()},
        "validation": validation,
        "warnings": warnings,
        "nodes": [{"id": row["Node"], "level": row["Level"], "is_root": row["IsRoot"]} for row in node_rows],
        "edges": [{"from": row["From"], "to": row["To"], "weight": row["Weight"], "level": row["Level"]} for row in rows],
        "condensation": {
            "input_nodes": graph.number_of_nodes(),
            "input_edges": graph.number_of_edges(),
            "output_nodes": tree.number_of_nodes(),
            "output_edges": tree.number_of_edges(),
            "compression_ratio": compression_ratio,
            "removed_edges": removed_edges,
            "preserved_weight": selected_weight,
            "preserved_weight_percent": preserved,
            "rooted_branching_algorithm": "Fulkerson/Edmonds maximum weight rooted branching",
        },
        "expansion": {
            "dominant_paths": expanded_paths[:25],
            "metrics": expansion_metrics,
            "expanded_paths_csv": str(expanded_paths_csv),
        },
        "compare_simplified": compare_rows,
        "metrics": {
            "original_nodes": graph.number_of_nodes(),
            "original_edges": graph.number_of_edges(),
            "reachable_nodes": reachable_graph.number_of_nodes(),
            "reachable_edges": reachable_graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(),
            "selected_edges": tree.number_of_edges(),
            "original_weight_sum": total_weight_original,
            "reachable_weight_sum": reachable_total_weight,
            "selected_weight_sum": selected_weight,
            "preserved_weight_percent": preserved,
            "preserved_reachable_weight_percent": preserved_reachable,
            "is_acyclic": validation["is_dag"],
            "is_dag": validation["is_dag"],
            "is_arborescence": validation["is_valid_arborescence"],
            "is_valid_arborescence": validation["is_valid_arborescence"],
            "is_connected": validation["all_reachable_from_root"],
            "root_in_degree": validation["root_in_degree"],
            "max_indegree_except_root": validation["max_non_root_in_degree"],
            "max_non_root_in_degree": validation["max_non_root_in_degree"],
            "reachable_from_root": validation["all_reachable_from_root"],
            "all_reachable_from_root": validation["all_reachable_from_root"],
            "expected_edges": validation["expected_edges"],
            "original_graph_has_cycles": original_has_cycles,
            "compression_ratio": compression_ratio,
            "removed_edges": removed_edges,
            "preserved_weight": selected_weight,
            "branch_depth": expansion_metrics["max_branch_depth"],
            "branching_factor": expansion_metrics["average_branching_factor"],
        },
    }
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    canonical_paths["tree_json"].write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    canonical_paths["metrics_json"].write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.output_dot:
        dot_path = Path(args.output_dot)
        dot_path.parent.mkdir(parents=True, exist_ok=True)
        lines = ["digraph ramex2007 {", '  rankdir="TB";'] + [f'  "{node}";' for node in tree.nodes]
        lines.extend(f'  "{source}" -> "{target}" [label="{fmt_weight(float(data["weight"]))}"];' for source, target, data in tree.edges(data=True))
        dot_path.write_text("\n".join(lines) + "\n}\n", encoding="utf-8")

    return payload


def main() -> None:
    args = parse_arguments()
    warnings: list[str] = []
    try:
        graph, load_warnings = load_edges(Path(args.input_edges_csv), args.allow_self_loops)
        warnings.extend(load_warnings)
        root, root_selection = select_root(graph, args.root, args.auto_root, warnings)
        reachable_graph = reachable_subgraph(graph, root, warnings)
        tree = maximum_weight_rooted_branching(reachable_graph, root)
        payload = export_outputs(graph, reachable_graph, tree, root, root_selection, args, warnings)

        print("RAMEX 2007 formal executado")
        print(f"Ficheiro lido: {args.input_edges_csv}")
        print(f"Raiz: {payload['root']} | criterio: {payload['root_selection']}")
        print(f"Nos originais: {payload['nodes_original']} | Arestas originais: {payload['edges_original']}")
        print(f"Nos selecionados: {payload['nodes_selected']} | Arestas selecionadas: {payload['edges_selected']}")
        print(f"Peso preservado: {payload['selected_weight']:.2f} de {payload['total_weight_original']:.2f} ({payload['preserved_weight_percent']:.2f}%)")
        print(f"Validade estrutural: {payload['is_valid_arborescence']}")
        print(f"DAG: {payload['is_dag']} | Arborescencia: {payload['is_arborescence']} | root_in_degree: {payload['root_in_degree']} | max_non_root_in_degree: {payload['max_non_root_in_degree']}")
        print("Ficheiros exportados:")
        for label, path in payload.get("canonical_exports", {}).items():
            print(f"- {label}: {path}")
        if payload["warnings"]:
            print("\nAvisos:\n" + "\n".join(f"- {warning}" for warning in payload["warnings"]))
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()

