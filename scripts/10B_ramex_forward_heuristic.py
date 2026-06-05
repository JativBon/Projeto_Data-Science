from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

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
    try:
        return nx.nx_agraph.graphviz_layout(graph, prog="dot", args="-Grankdir=TB")
    except Exception:
        levels = nx.single_source_shortest_path_length(graph.to_undirected(), root) if root in graph else {}
        grouped: dict[int, list[str]] = {}
        for node in graph.nodes:
            grouped.setdefault(levels.get(node, 0), []).append(node)
        shells = [sorted(nodes, key=str) for _, nodes in sorted(grouped.items())]
        shell_pos = nx.shell_layout(graph, nlist=shells)
        return {
            node: (
                shell_pos[node][0] * (1 + 0.12 * levels.get(node, 0)),
                -1.9 * levels.get(node, 0) + shell_pos[node][1] * 0.2,
            )
            for node in graph.nodes
        }


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
    orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
    sel_w = sum(d["weight"] for _, _, d in tree.edges(data=True))

    is_dag = nx.is_directed_acyclic_graph(tree)
    is_connected = nx.is_weakly_connected(tree) if tree.nodes else False

    payload = {
        "algorithm": "RAMEX Forward Heuristic",
        "root": root,
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(), "selected_edges": tree.number_of_edges(),
            "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": (sel_w / orig_w * 100) if orig_w else 0,
            "is_acyclic": is_dag,
            "is_connected": is_connected,
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
    
    return payload


def draw_tree(tree: nx.DiGraph, root: str, output_png: Path) -> None:
    pos = hierarchical_layout(tree, root)
    degrees = dict(tree.to_undirected().degree())

    colors = ["#f4b183" if n == root else "#dce9ee" for n in tree.nodes]
    max_w = max([d["weight"] for _, _, d in tree.edges(data=True)], default=1)
    widths = [1.0 + 5.0 * (d["weight"] / max_w) for _, _, d in tree.edges(data=True)]
    node_sizes = [1900 + 420 * degrees.get(n, 0) for n in tree.nodes]
    font_size = 9 if tree.number_of_nodes() <= 15 else 7

    plt.figure(figsize=(18, 11))
    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes, edgecolors="#1f2937", linewidths=1.4)
    nx.draw_networkx_edges(
        tree, pos, width=widths, arrows=True, arrowstyle="-|>", arrowsize=20,
        edge_color=edge_color_scale(tree), alpha=0.88, connectionstyle="arc3,rad=0.02"
    )
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold")

    labels = {(u, v): str(fmt_wt(d["weight"])) for u, v, d in tree.edges(data=True)}
    nx.draw_networkx_edge_labels(
        tree, pos, edge_labels=labels, font_size=max(font_size - 1, 6),
        bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
    )

    plt.title(f"RAMEX - Forward Heuristic - {dataset_label_from_path(output_png)}", fontsize=16, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
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

