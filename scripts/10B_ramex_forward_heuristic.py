from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
from ramex_validation import validate_forward_tree

REQUIRED_COLUMNS = ["From", "To", "Weight"]
METHOD_NAME = "ramex_forward_heuristic"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RAMEX Forward Heuristic a partir de um CSV.")
    parser.add_argument("input_edges_csv", help="CSV de arestas (From, To, Weight).")
    parser.add_argument("output_csv", help="CSV de saída.")
    parser.add_argument("output_png", help="PNG de saída.")
    parser.add_argument("--root", required=True, help="Raiz para iniciar a expansão.")
    parser.add_argument("--output-json", default=None, help="JSON opcional.")
    return parser.parse_args()


def load_edges(path_text: str) -> tuple[pd.DataFrame, int]:
    path = Path(path_text)
    if not path.exists() or path.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio ou inexistente: {path}")

    df = pd.read_csv(path)
    if missing := [c for c in REQUIRED_COLUMNS if c not in df.columns]:
        raise ValueError(f"Colunas obrigatórias em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    initial_len = len(df)
    valid_df = df.dropna(subset=REQUIRED_COLUMNS).query("Weight > 0").copy()

    if valid_df.empty:
        raise ValueError("Não existem arestas válidas com peso positivo.")

    return valid_df.sort_values(by="Weight", ascending=False).reset_index(drop=True), initial_len - len(valid_df)


def build_graph(df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for u, v, w in df[REQUIRED_COLUMNS].itertuples(index=False):
        graph.add_edge(u, v, weight=float(w))
    if not graph.edges:
        raise ValueError("O grafo não contém arestas.")
    return graph


def build_forward_tree(graph: nx.DiGraph, root: str) -> nx.DiGraph:
    if root not in graph:
        raise ValueError(f"A raiz indicada não existe no grafo: {root}")

    tree = nx.DiGraph()
    tree.add_node(root)
    included = {root}

    while True:
        candidates = [
            (u, v, d["weight"]) 
            for u in included 
            for _, v, d in graph.out_edges(u, data=True) 
            if v not in included
        ]

        if not candidates:
            break

        # Ordenar por maior peso, com desempate alfabÃ©tico
        candidates.sort(key=lambda e: (-e[2], e[0], e[1]))
        u, v, w = candidates[0]
        
        tree.add_edge(u, v, weight=w)
        
        if not nx.is_directed_acyclic_graph(tree):
            tree.remove_edge(u, v)
            included.add(v)
            continue

        included.add(v)

    if not tree.edges:
        raise ValueError("Não foi possível selecionar arestas a partir da raiz.")
    return tree


def fmt_wt(w: float) -> int | float:
    return int(w) if w.is_integer() else round(w, 4)


def dataset_label_from_path(path: Path) -> str:
    for part in path.stem.replace("-", "_").split("_"):
        if part.lower().startswith("dataset"):
            return part
    return path.stem


def hierarchical_layout(graph: nx.DiGraph, root: str) -> dict:
    n = graph.number_of_nodes()
    # nodesep e ranksep escalados: grafos maiores precisam de mais espaço
    nodesep = max(0.6, min(2.0, 60 / max(n, 1)))
    ranksep = max(1.0, min(3.5, 80 / max(n, 1)))
    for prog in ("dot",):
        try:
            return nx.nx_agraph.graphviz_layout(
                graph, prog=prog,
                args=f"-Grankdir=LR -Gnodesep={nodesep:.2f} -Granksep={ranksep:.2f}",
            )
        except Exception:
            pass
    # Fallback manual: BFS por níveis com espaçamento uniforme
    levels: dict[str, int] = {}
    if root in graph:
        for node, lvl in nx.single_source_shortest_path_length(graph, root).items():
            levels[node] = lvl
    for node in graph.nodes:
        levels.setdefault(node, 0)
    grouped: dict[int, list[str]] = {}
    for node, lvl in levels.items():
        grouped.setdefault(lvl, []).append(node)
    max_lvl = max(grouped.keys(), default=0)
    pos: dict[str, tuple[float, float]] = {}
    for lvl, nodes in grouped.items():
        nodes_sorted = sorted(nodes, key=str)
        count = len(nodes_sorted)
        for i, node in enumerate(nodes_sorted):
            x = (lvl / max(max_lvl, 1)) * 10
            y = (i - (count - 1) / 2) * max(1.8, 8 / max(count, 1))
            pos[node] = (x, y)
    return pos


def edge_color_scale(tree: nx.DiGraph) -> list:
    weights = [d["weight"] for _, _, d in tree.edges(data=True)]
    max_w = max(weights, default=1)
    return [plt.cm.Blues(0.35 + 0.55 * (w / max_w)) for w in weights]


def export_outputs(graph: nx.DiGraph, tree: nx.DiGraph, root: str, args: argparse.Namespace) -> dict:
    levels = nx.single_source_shortest_path_length(tree, root)
    ordered_edges = sorted(tree.edges(data=True), key=lambda e: (levels.get(e[0], 0), e[0], e[1]))

    # CSV
    rows = [{
        "From": u, "To": v, "Weight": fmt_wt(d["weight"]),
        "Level": levels.get(v, levels.get(u, 0) + 1),
        "Method": METHOD_NAME
    } for u, v, d in ordered_edges]
    pd.DataFrame(rows).to_csv(args.output_csv, index=False, encoding="utf-8")

    # JSON
    validation = validate_forward_tree(tree, root, graph)
    orig_w = validation["original_total_weight"]
    sel_w = validation["total_selected_weight"]
    is_dag = validation["is_dag"]
    is_connected = bool(validation["all_reachable_from_root"])

    payload = {
        "algorithm": "RAMEX Forward Heuristic",
        "root": root,
        "validation": validation,
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(), "selected_edges": tree.number_of_edges(),
            "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": validation["preserved_weight_percentage"],
            "is_acyclic": is_dag,
            "is_dag": is_dag,
            "is_connected": is_connected,
            "is_valid_forward_tree": validation["is_valid_forward_tree"],
            "all_reachable_from_root": validation["all_reachable_from_root"],
            "expected_max_edges": validation["expected_max_edges"],
            "max_in_degree": validation["max_in_degree"],
            "max_out_degree": validation["max_out_degree"],
        },
        "nodes": [{"id": n, "level": levels.get(n, 0), "is_root": n == root} 
                  for n in sorted(tree.nodes, key=lambda n: (levels.get(n, 0), n))],
        "edges": [{"from": u, "to": v, "weight": d["weight"], "level": r["Level"]} 
                  for r, (u, v, d) in zip(rows, ordered_edges)]
    }

    out_json = Path(args.output_json) if args.output_json else Path("data/json") / Path(args.output_csv).with_suffix(".json").name
    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_png).parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_json.parent / "forward_metrics.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    
    return payload


def draw_tree(tree: nx.DiGraph, root: str, output_png: Path) -> None:
    n = tree.number_of_nodes()
    pos = hierarchical_layout(tree, root)
    degrees = dict(tree.to_undirected().degree())

    # Dimensões escaladas com o número de nós
    if n <= 15:
        figsize, dpi, font_size, node_base, node_scale = (12, 7), 300, 16, 5600, 1200
    elif n <= 50:
        figsize, dpi, font_size, node_base, node_scale = (22, 16), 250, 9, 1400, 500
    elif n <= 120:
        figsize, dpi, font_size, node_base, node_scale = (28, 20), 200, 7, 900, 300
    else:
        figsize, dpi, font_size, node_base, node_scale = (36, 26), 180, 6, 600, 200

    colors = ["#f4b183" if n_id == root else "#dceef5" for n_id in tree.nodes]
    max_w = max((d["weight"] for _, _, d in tree.edges(data=True)), default=1) or 1
    widths = [0.8 + 4.0 * (d["weight"] / max_w) for _, _, d in tree.edges(data=True)]
    node_sizes = [node_base + node_scale * degrees.get(nd, 0) for nd in tree.nodes]

    plt.figure(figsize=figsize)
    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes,
                           edgecolors="#315f72", linewidths=1.6)
    nx.draw_networkx_edges(
        tree, pos, width=widths, arrows=True, arrowstyle="-|>",
        arrowsize=30 if n <= 15 else max(12, 22 - n // 15),
        edge_color=edge_color_scale(tree), alpha=0.85, connectionstyle="arc3,rad=0.02",
    )
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold",
                            font_color="#0f172a")

    # Labels nas arestas só para grafos pequenos
    if n <= 60:
        labels = {(u, v): str(fmt_wt(d["weight"])) for u, v, d in tree.edges(data=True)}
        nx.draw_networkx_edge_labels(
            tree, pos, edge_labels=labels, font_size=max(font_size - 3, 12 if n <= 15 else 5),
            bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
        )

    plt.title(f"RAMEX - Forward Heuristic - {dataset_label_from_path(output_png)}",
              fontsize=14, fontweight="bold", pad=10)
    plt.axis("off")
    plt.tight_layout(pad=1.5)
    plt.savefig(output_png, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close()

def main() -> None:
    args = parse_arguments()

    try:
        edges_df, invalid_count = load_edges(args.input_edges_csv)
        graph = build_graph(edges_df)
        tree = build_forward_tree(graph, args.root)

        if not nx.is_directed_acyclic_graph(tree):
            raise ValueError("O output contém ciclos.")
        if not nx.is_weakly_connected(tree):
            raise ValueError("A estrutura Forward resultante não está conectada.")

        payload = export_outputs(graph, tree, args.root, args)
        draw_tree(tree, args.root, Path(args.output_png))
        shutil.copyfile(args.output_png, Path(args.output_png).with_name(Path(args.output_png).stem + "_paper_style.png"))

        m = payload["metrics"]
        print(f"Ficheiro lido: {args.input_edges_csv}")
        if invalid_count: print(f"Aviso: ignoradas {invalid_count} arestas inválidas.")
        print(f"Raiz: {args.root}\nNós originais: {m['original_nodes']} | Arestas originais: {m['original_edges']}")
        print(f"Arestas selecionadas: {m['selected_edges']}\nSoma dos pesos: {m['selected_weight_sum']:.2f}")
        print(f"Peso preservado: {m['preserved_weight_percent']:.2f}%\nOutput acíclico: {m['is_acyclic']} | Conectado: {m['is_connected']}")
        print(f"Gerados: CSV, PNG, e JSON com sucesso.")

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

if __name__ == "__main__":
    main()
