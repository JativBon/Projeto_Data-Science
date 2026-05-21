"""
05_ramex2007_matriz_adjacencia.py

Gera matriz de adjacencia formal RAMEX 2007 a partir de From, To, Weight.
As linhas sao origens, as colunas destinos e os valores frequencias absolutas.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


def build_matrix(edges: pd.DataFrame) -> pd.DataFrame:
    required = {"From", "To", "Weight"}
    missing = required - set(edges.columns)
    if missing:
        raise ValueError(f"Colunas em falta: {sorted(missing)}")
    df = edges[["From", "To", "Weight"]].copy()
    df["From"] = df["From"].astype(str)
    df["To"] = df["To"].astype(str)
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce").fillna(0)
    nodes = sorted(set(df["From"]) | set(df["To"]))
    matrix = pd.DataFrame(0, index=nodes, columns=nodes, dtype=int)
    for row in df.itertuples(index=False):
        matrix.at[row.From, row.To] += int(row.Weight)
    return matrix


def draw_heatmap(matrix: pd.DataFrame, output_png: Path) -> None:
    limit = min(60, matrix.shape[0], matrix.shape[1])
    view = matrix.iloc[:limit, :limit]
    fig_size = max(8, min(18, limit * 0.34))
    fig, ax = plt.subplots(figsize=(fig_size, fig_size), dpi=140)
    image = ax.imshow(view.values, cmap="YlGnBu", aspect="auto")
    ax.set_title("RAMEX 2007 - Matriz de Adjacencia", fontsize=12, fontweight="bold")
    ax.set_xlabel("Destino")
    ax.set_ylabel("Origem")
    ax.set_xticks(range(limit))
    ax.set_yticks(range(limit))
    ax.set_xticklabels([str(col) for col in view.columns], rotation=90, fontsize=6)
    ax.set_yticklabels([str(idx) for idx in view.index], fontsize=6)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04, label="Frequencia absoluta")
    plt.tight_layout()
    output_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_png, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Matriz de adjacencia RAMEX 2007.")
    parser.add_argument("edges_csv")
    parser.add_argument("output_csv")
    parser.add_argument("--output-png")
    args = parser.parse_args()

    matrix = build_matrix(pd.read_csv(args.edges_csv))
    output_csv = Path(args.output_csv)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    matrix.to_csv(output_csv)
    if args.output_png:
        draw_heatmap(matrix, Path(args.output_png))
    print(f"Matriz gerada: {output_csv}")


if __name__ == "__main__":
    main()
