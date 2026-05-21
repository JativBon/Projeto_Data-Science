"""
ramex2007_condensation.py

Wrapper explicito para o processo de condensacao RAMEX 2007.
Recebe a rede G formal e chama o 10A com raiz SOURCE.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Condensacao RAMEX 2007 por Maximum Weight Rooted Branching.")
    parser.add_argument("graph_edges_csv")
    parser.add_argument("output_csv")
    parser.add_argument("output_png")
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--expanded-paths-out", default=None)
    args = parser.parse_args()

    command = [
        sys.executable,
        str(Path(__file__).with_name("10A_ramex_2007_rooted_branching.py")),
        args.graph_edges_csv,
        args.output_csv,
        args.output_png,
        "--root",
        "SOURCE",
        "--output-json",
        args.output_json,
    ]
    if args.expanded_paths_out:
        command.extend(["--output-expanded-paths", args.expanded_paths_out])
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
