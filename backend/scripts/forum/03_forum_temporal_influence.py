from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import parse_latency_to_seconds, temporal_influence  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 1 - influência temporal.")
    parser.add_argument("ordered_csv")
    parser.add_argument("--latency-max", default="1h")
    parser.add_argument("--output", default="backend/results/forum/forum_temporal_influence.csv")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporal_influence(pd.read_csv(args.ordered_csv), parse_latency_to_seconds(args.latency_max)).to_csv(output, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

