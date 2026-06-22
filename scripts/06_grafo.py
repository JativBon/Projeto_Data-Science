"""
06_grafo.py

Gera um grafo dirigido ponderado a partir de uma matriz de adjacência em CSV.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

DENSE_EDGE_WARNING = 1000
SMALL_GRAPH_NODES = 30
SMALL_GRAPH_EDGES = 80


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera um grafo dirigido ponderado a partir de uma matriz de adjacência.")
    parser.add_argument("input_matrix_csv", help="Ficheiro CSV com a matriz de adjacência.")
    parser.add_argument("output_png", help="Ficheiro PNG a gerar.")
    parser.add_argument("--min-frequency", type=float, default=None, help="Frequência mínima das arestas.")
    parser.add_argument("--top-n", type=int, default=None, help="Número máximo de arestas mais fortes a manter.")
    return parser.parse_args()


def load_adjacency_matrix(file_path: str) -> tuple[pd.DataFrame, int]:
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio ou inexistente: {path}")

    df = pd.read_csv(path, index_col=0, encoding="utf-8")
    if df.empty:
        raise ValueError("A matriz está vazia.")

    df.index = df.index.astype(str).str.strip()
    df.columns = df.columns.astype(str).str.strip()

    numeric_df = df.apply(pd.to_numeric, errors="coerce")
    non_numeric_count = int(numeric_df.isna().sum().sum())
    
    return numeric_df.fillna(0), non_numeric_count


def matrix_to_edges(matrix_df: pd.DataFrame) -> pd.DataFrame:
    # A abordagem stack() é mais idiomática e rápida do que iterrows() aninhados
    edges = matrix_df.stack().reset_index()
    edges.columns = ["From", "To", "Weight"]
    return edges[edges["Weight"] > 0].reset_index(drop=True)


def apply_edge_filters(df: pd.DataFrame, min_freq: float | None, top_n: int | None) -> pd.DataFrame:
    filtered = df.copy()
    
    if min_freq is not None:
        if min_freq < 0: raise ValueError("--min-frequency deve ser >= 0.")
        filtered = filtered[filtered["Weight"] >= min_freq]

    filtered = filtered.sort_values(by="Weight", ascending=False, kind="stable")

    if top_n is not None:
        if top_n <= 0: raise ValueError("--top-n deve ser > 0.")
        filtered = filtered.head(top_n)

    return filtered.reset_index(drop=True)


def build_graph(matrix_df: pd.DataFrame, edges_df: pd.DataFrame, include_all_nodes: bool) -> nx.DiGraph:
    graph = nx.DiGraph()
    if include_all_nodes or edges_df.empty:
        graph.add_nodes_from(matrix_df.index)
        graph.add_nodes_from(matrix_df.columns)

    graph.add_weighted_edges_from(edges_df[["From", "To", "Weight"]].itertuples(index=False))
    return graph


def fmt_wt(w: float) -> str:
    return str(int(w)) if float(w).is_integer() else f"{w:.2f}"


def as_float(value: Any) -> float:
    return float(value)


def draw_graph(graph: nx.DiGraph, output_png: str) -> None:
    if not graph.nodes:
        raise ValueError("O grafo não contém nós para desenhar.")

    plt.figure(figsize=(14, 10))
    
    small = graph.number_of_nodes() <= SMALL_GRAPH_NODES and graph.number_of_edges() <= SMALL_GRAPH_EDGES
    k_val = 1.2 if graph.number_of_nodes() <= SMALL_GRAPH_NODES else None
    pos = nx.spring_layout(graph, seed=42, k=k_val, weight="weight")

    max_w = max([d["weight"] for _, _, d in graph.edges(data=True)], default=1)
    widths = [0.6 + 3.4 * (d["weight"] / max_w) for _, _, d in graph.edges(data=True)]

    nx.draw_networkx_nodes(graph, pos, node_size=2600 if small else 550, node_color="#d9ead3", edgecolors="#274e13", linewidths=1.2)
    nx.draw_networkx_edges(graph, pos, width=widths, alpha=0.65 if small else 0.18, edge_color="#4a5568", arrows=True, arrowsize=18 if small else 8, connectionstyle="arc3,rad=0.08")
    nx.draw_networkx_labels(graph, pos, font_size=10 if small else 6, font_weight="bold")

    if small:
        labels = {(u, v): fmt_wt(d["weight"]) for u, v, d in graph.edges(data=True)}
        nx.draw_networkx_edge_labels(graph, pos, edge_labels=labels, font_size=9, label_pos=0.5, rotate=False)

    plt.title("Grafo dirigido ponderado", fontsize=14)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
    plt.close()


def main() -> int:
    args = parse_arguments()

    try:
        matrix_df, non_numeric = load_adjacency_matrix(args.input_matrix_csv)
        edges_df = matrix_to_edges(matrix_df)
        filtered_df = apply_edge_filters(edges_df, args.min_frequency, args.top_n)
        
        used_filter = args.min_frequency is not None or args.top_n is not None
        graph = build_graph(matrix_df, filtered_df, include_all_nodes=not used_filter)
        
        # Gerar nome do ficheiro de exportação
        out_csv = Path(args.input_matrix_csv).with_name(f"grafo_edges_{Path(args.input_matrix_csv).stem.removeprefix('matriz_adjacencia_')}.csv")
        
        # Exportar CSV de Arestas
        df_exp = filtered_df.copy()
        df_exp["Weight"] = df_exp["Weight"].apply(lambda w: int(w) if float(w).is_integer() else w)
        df_exp.to_csv(out_csv, index=False, encoding="utf-8")
        
        draw_graph(graph, args.output_png)

        # Resumo final (print_summary inline para reduzir boilerplate)
        print(f"Ficheiro lido: {args.input_matrix_csv}")
        if non_numeric:
            print(f"Aviso: {non_numeric} valores não numéricos foram convertidos para zero.")

        n_edges = graph.number_of_edges()
        if n_edges > DENSE_EDGE_WARNING:
            print(f"Aviso: grafo muito denso{' (considere usar filtros)' if not used_filter else ' após os filtros'}.")

        tot_w = filtered_df["Weight"].sum() if not filtered_df.empty else 0
        print(f"Nós: {graph.number_of_nodes()} | Arestas: {n_edges} | Soma total dos pesos: {fmt_wt(tot_w)}")

        print("\nTop 10 arestas mais fortes:")
        if filtered_df.empty:
            print("Sem arestas com peso maior que zero após os filtros.")
        else:
            for row in filtered_df.head(10).to_dict(orient="records"):
                print(f"{row['From']} -> {row['To']} = {fmt_wt(as_float(row['Weight']))}")

        print(f"\nFicheiro PNG gerado: {args.output_png}\nCSV de arestas gerado: {out_csv}")
        return 0

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())