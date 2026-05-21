from __future__ import annotations

import argparse
import sys
from pathlib import Path

import networkx as nx
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import build_temporal_graph, draw_temporal_graph, graph_edges_from_filtered  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 1 - grafo temporal técnico.")
    parser.add_argument("filtered_influence_csv")
    parser.add_argument("--edges-output", default="backend/results/forum/forum_graph_edges.csv")
    parser.add_argument("--graphml-output", default="backend/results/forum/forum_graph.graphml")
    parser.add_argument("--png-output", default="backend/assets/forum/forum_graph.png")
    args = parser.parse_args()

    edges = graph_edges_from_filtered(pd.read_csv(args.filtered_influence_csv))
    graph = build_temporal_graph(edges)
    for path in [Path(args.edges_output), Path(args.graphml_output), Path(args.png_output)]:
        path.parent.mkdir(parents=True, exist_ok=True)
    edges.to_csv(args.edges_output, index=False, encoding="utf-8")
    if graph.number_of_nodes() > 0:
        nx.write_graphml(graph, args.graphml_output)
    draw_temporal_graph(graph, Path(args.png_output))


if __name__ == "__main__":
    main()

