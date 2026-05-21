"""
ramex2007_expansion.py

Expansao/interpretacao inicial da arborescencia B RAMEX 2007.
Percorre a arvore condensada e exporta caminhos dominantes.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import networkx as nx
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description="Expansao RAMEX 2007 em caminhos dominantes.")
    parser.add_argument("branching_csv")
    parser.add_argument("output_csv")
    parser.add_argument("--root", default="SOURCE")
    args = parser.parse_args()

    df = pd.read_csv(args.branching_csv)
    graph = nx.DiGraph()
    for row in df.itertuples(index=False):
        graph.add_edge(str(row.From), str(row.To), weight=float(row.Weight))

    rows = []
    leaves = sorted([str(node) for node in graph.nodes if graph.out_degree(node) == 0])
    for leaf in leaves:
        if args.root not in graph or not nx.has_path(graph, args.root, leaf):
            continue
        path = [str(node) for node in nx.shortest_path(graph, args.root, leaf)]
        weights = [float(graph[u][v].get("weight", 0)) for u, v in zip(path, path[1:])]
        rows.append({
            "path": " -> ".join(path),
            "start": args.root,
            "end": leaf,
            "branch_depth": len(path) - 1,
            "path_weight": sum(weights),
            "bottleneck_weight": min(weights) if weights else 0,
            "edges": len(path) - 1,
        })

    output = Path(args.output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).sort_values(["path_weight", "branch_depth"], ascending=[False, False]).to_csv(output, index=False)
    print(f"Caminhos dominantes gerados: {output}")


if __name__ == "__main__":
    main()
