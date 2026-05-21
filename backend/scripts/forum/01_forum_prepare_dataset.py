from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend-ramex"))

from forum_temporal_pipeline import prepare_dataset, read_table  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="RAMEX-Forum Fase 1 - preparar dataset temporal.")
    parser.add_argument("input")
    parser.add_argument("--entity-column", required=True)
    parser.add_argument("--time-column", required=True)
    parser.add_argument("--signal-column", required=True)
    parser.add_argument("--output", default="backend/results/forum/forum_ordered_dataset.csv")
    args = parser.parse_args()

    ordered = prepare_dataset(read_table(Path(args.input)), args.entity_column, args.time_column, args.signal_column)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    ordered.to_csv(output, index=False, encoding="utf-8")


if __name__ == "__main__":
    main()

