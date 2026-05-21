from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import apply_epsilon_and_filters, parse_latency_to_seconds  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 1 - epsilon smoothing e filtros de ruído.")
    parser.add_argument("temporal_influence_csv")
    parser.add_argument("--epsilon", type=float, default=0.01)
    parser.add_argument("--min-frequency", type=float, default=1.0)
    parser.add_argument("--min-influence", type=float, default=0.0)
    parser.add_argument("--max-latency", default=None)
    parser.add_argument("--output", default="backend/results/forum/forum_filtered_influence.csv")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    max_latency = parse_latency_to_seconds(args.max_latency) if args.max_latency else None
    apply_epsilon_and_filters(
        pd.read_csv(args.temporal_influence_csv),
        epsilon=args.epsilon,
        min_frequency=args.min_frequency,
        min_influence=args.min_influence,
        max_latency_seconds=max_latency,
    ).to_csv(output, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

