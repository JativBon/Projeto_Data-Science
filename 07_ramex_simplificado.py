"""
07_ramex_simplificado.py

Constrói uma estrutura RAMEX simplificada a partir de um CSV de arestas ponderadas.
"""
from __future__ import annotations

import argparse
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


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Constrói uma estrutura RAMEX simplificada.")
    parser.add_argument("input_edges_csv", help="CSV de arestas (From, To, Weight).")
    parser.add_argument("output_csv", help="CSV a gerar.")
    parser.add_argument("output_png", help="PNG a gerar.")
    return parser.parse_args()


def load_edges(path: str) -> tuple[pd.DataFrame, int, int]:
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio ou inexistente: {path}")

    df = pd.read_csv(p)
    if missing := [c for c in REQUIRED_COLUMNS if c not in df.columns]:
        raise ValueError(f"Colunas obrigatórias em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    
    if df[["From", "To"]].isna().any(axis=None):
        raise ValueError("O ficheiro contém linhas sem origem ou destino.")

    initial_len = len(df)
    non_numeric = int(pd.to_numeric(df["Weight"], errors="coerce").isna().sum())
    
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")
    valid_df = df.dropna(subset=REQUIRED_COLUMNS).query("Weight > 0").copy()

    if valid_df.empty:
        raise ValueError("Não existem arestas válidas com peso positivo.")

    return valid_df.sort_values(by="Weight", ascending=False).reset_index(drop=True), non_numeric, initial_len - len(valid_df)


def build_graph(df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    graph.add_weighted_edges_from(df[REQUIRED_COLUMNS].itertuples(index=False))
    return graph


def choose_root(graph: nx.DiGraph) -> str:
    for node in graph.nodes:
        if str(node).upper() == "START":
            return str(node)

    cands = [(str(n), sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), graph.out_degree(n)) for n in graph.nodes]
    return min(cands, key=lambda x: (-x[1], -x[2], x[0]))[0]


def build_simplified_ramex(graph: nx.DiGraph, root: str) -> tuple[nx.DiGraph, pd.DataFrame]:
    tree = nx.DiGraph()
    tree.add_node(root)
    visited, levels, rows = {root}, {root: 0}, []

    while True:
        cands = [
            (u, v, d["weight"]) 
            for u in visited 
            for _, v, d in graph.out_edges(u, data=True) 
            if v not in visited
        ]
        
        if not cands:
            break

        # Escolhe a aresta de maior peso. Desempata por origem alfabética e depois destino.
        u, v, w = min(cands, key=lambda e: (-e[2], str(e[0]), str(e[1])))
        
        tree.add_edge(u, v, weight=w)
        if not nx.is_directed_acyclic_graph(tree):
            tree.remove_edge(u, v)
            visited.add(v)
            continue

        visited.add(v)
        levels[v] = levels[u] + 1
        rows.append({"From": u, "To": v, "Weight": w, "Level": levels[v]})

    return tree, pd.DataFrame(rows)


def fmt_wt(w: float) -> int | float:
    return int(w) if float(w).is_integer() else w


def export_outputs(graph: nx.DiGraph, df: pd.DataFrame, root: str, out_csv: str, out_png: str) -> None:
    # Exportar CSV
    df_export = df.copy()
    if not df_export.empty:
        df_export["Weight"] = df_export["Weight"].apply(fmt_wt)
    df_export.to_csv(out_csv, index=False, encoding="utf-8")

    # Exportar PNG
    plt.figure(figsize=(12, 8))
    try:
        pos = nx.nx_agraph.graphviz_layout(graph, prog="dot")
    except Exception:
        pos = nx.spring_layout(graph, seed=42, weight="weight")

    small = graph.number_of_nodes() <= 30 and graph.number_of_edges() <= 80
    colors = ["#f9cb9c" if n == root else "#cfe2f3" for n in graph.nodes]
    max_w = max([d["weight"] for _, _, d in graph.edges(data=True)], default=1)
    widths = [1.0 + 4.0 * (d["weight"] / max_w) for _, _, d in graph.edges(data=True)]

    nx.draw_networkx_nodes(graph, pos, node_size=2800 if small else 650, node_color=colors, edgecolors="#1f2937")
    nx.draw_networkx_edges(graph, pos, width=widths, edge_color="#374151", arrows=True, arrowsize=20 if small else 10, connectionstyle="arc3,rad=0.04")
    nx.draw_networkx_labels(graph, pos, font_size=10 if small else 6, font_weight="bold")

    if small:
        lbls = {(u, v): str(fmt_wt(d["weight"])) for u, v, d in graph.edges(data=True)}
        nx.draw_networkx_edge_labels(graph, pos, edge_labels=lbls, font_size=9)

    plt.title("RAMEX simplificado - estrutura principal", fontsize=14)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(out_png, dpi=300, bbox_inches="tight")
    plt.close()


def main() -> int:
    args = parse_arguments()
    try:
        edges_df, non_num, ignored = load_edges(args.input_edges_csv)
        graph = build_graph(edges_df)
        root = choose_root(graph)
        ramex_graph, df = build_simplified_ramex(graph, root)

        if df.empty:
            raise ValueError("Não foi possível construir estrutura RAMEX simplificada com arestas.")

        export_outputs(ramex_graph, df, root, args.output_csv, args.output_png)

        orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
        sel_w = df["Weight"].sum() if not df.empty else 0

        print(f"Ficheiro lido: {args.input_edges_csv}")
        if non_num: print(f"Aviso: {non_num} pesos não numéricos ignorados.")
        if ignored: print(f"Aviso: {ignored} arestas inválidas ignoradas.")
        print(f"Nós originais: {graph.number_of_nodes()} | Arestas: {graph.number_of_edges()}")
        print(f"Raiz: {root}\nArestas selecionadas: {ramex_graph.number_of_edges()}")
        print(f"Peso preservado: {fmt_wt(sel_w)} de {fmt_wt(orig_w)} ({(sel_w / orig_w * 100) if orig_w else 0:.2f}%)")
        print(f"Gerados: CSV ({args.output_csv}) e PNG ({args.output_png}).")

        return 0

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())