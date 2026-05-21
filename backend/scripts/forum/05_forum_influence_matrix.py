from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import draw_influence_heatmap, graph_edges_from_filtered, influence_matrix  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 1 - matriz de influência.")
    parser.add_argument("filtered_influence_csv")
    parser.add_argument("--output-csv", default="backend/results/forum/forum_influence_matrix.csv")
    parser.add_argument("--output-png", default="backend/assets/forum/forum_influence_matrix.png")
    args = parser.parse_args()

    filtered = pd.read_csv(args.filtered_influence_csv)
    matrix = influence_matrix(graph_edges_from_filtered(filtered))
    csv_path = Path(args.output_csv)
    png_path = Path(args.output_png)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    matrix.to_csv(csv_path, encoding="utf-8")
    draw_influence_heatmap(matrix, png_path)


if __name__ == "__main__":
    main()

