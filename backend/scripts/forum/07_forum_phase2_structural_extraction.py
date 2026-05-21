from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import run_forum_temporal_phase2  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 2 - Forward Tree ou Back-and-Forward Poly-tree.")
    parser.add_argument("filtered_influence_csv")
    parser.add_argument("--output-dir", default="backend/results/forum")
    parser.add_argument("--initial-node", default=None)
    parser.add_argument("--forward-top-k", type=int, default=1)
    parser.add_argument("--max-depth", type=int, default=10)
    parser.add_argument("--min-smoothed-weight", type=float, default=None)
    parser.add_argument("--force-heuristic", choices=["auto", "forward", "back_and_forward"], default="auto")
    args = parser.parse_args()

    run_forum_temporal_phase2(
        Path(args.filtered_influence_csv),
        Path(args.output_dir),
        initial_node=args.initial_node,
        forward_top_k=args.forward_top_k,
        max_depth=args.max_depth,
        min_smoothed_weight=args.min_smoothed_weight,
        force_heuristic=args.force_heuristic,
    )


if __name__ == "__main__":
    main()

