"""
04_ramex2007_transformacao_rede.py

Transformacao formal RAMEX 2007:
- ordena eventos por cliente, data e item;
- cria o atributo next_item;
- adiciona SOURCE e SINK;
- constroi a rede dirigida ponderada G com frequencias absolutas.
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd

SOURCE_NODE = "SOURCE"
SINK_NODE = "SINK"


def normalize_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text if text and text.lower() not in {"nan", "nat"} else None


def read_simple_sequences(path: Path) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    if path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
        if "Sequence" in df.columns:
            for index, sequence in enumerate(df["Sequence"].astype(str), start=1):
                customer = str(df.iloc[index - 1].get("Sequence ID", f"C{index:05d}"))
                for position, item in enumerate(sequence.split(), start=1):
                    rows.append({"customer": customer, "timestamp": position, "item": item})
            return pd.DataFrame(rows)

    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        items = [token.strip() for token in line.replace(",", " ").split() if token.strip()]
        for position, item in enumerate(items, start=1):
            rows.append({"customer": f"C{index:05d}", "timestamp": position, "item": item})
    return pd.DataFrame(rows)


def read_event_table(path: Path, customer_col: str, time_col: str, item_col: str) -> pd.DataFrame:
    df = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_excel(path)
    missing = [column for column in [customer_col, time_col, item_col] if column not in df.columns]
    if missing:
        raise ValueError(f"Colunas em falta: {missing}")
    out = df[[customer_col, time_col, item_col]].rename(
        columns={customer_col: "customer", time_col: "timestamp", item_col: "item"}
    )
    out["customer"] = out["customer"].apply(normalize_text)
    out["item"] = out["item"].apply(normalize_text)
    out = out.dropna(subset=["customer", "timestamp", "item"])
    return out


def build_outputs(events_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ordered = events_df.copy()
    ordered["_time_sort"] = pd.to_datetime(ordered["timestamp"], errors="coerce")
    if ordered["_time_sort"].notna().mean() < 0.8:
        ordered["_time_sort"] = pd.to_numeric(ordered["timestamp"], errors="coerce")
    ordered = ordered.dropna(subset=["_time_sort"]).sort_values(
        by=["customer", "_time_sort", "item"],
        kind="stable",
    )
    ordered["sequence_position"] = ordered.groupby("customer").cumcount() + 1
    ordered = ordered[["customer", "timestamp", "item", "sequence_position"]]

    sequence_rows: list[dict[str, Any]] = []
    transitions: list[tuple[str, str, str]] = []
    for customer, group in ordered.groupby("customer", sort=False):
        items = [str(item) for item in group["item"].tolist()]
        timestamps = group["timestamp"].tolist()
        if not items:
            continue
        transitions.append((SOURCE_NODE, items[0], "source_transition"))
        transitions.extend((source, target, "normal_transition") for source, target in zip(items, items[1:]))
        transitions.append((items[-1], SINK_NODE, "sink_transition"))
        for index, item in enumerate(items):
            sequence_rows.append({
                "customer": customer,
                "timestamp": timestamps[index],
                "item": item,
                "next_item": items[index + 1] if index + 1 < len(items) else SINK_NODE,
                "sequence_position": index + 1,
            })

    counter = Counter(transitions)
    edges = pd.DataFrame([
        {"From": source, "To": target, "Weight": weight, "TransitionType": transition_type}
        for (source, target, transition_type), weight in counter.items()
    ])
    edges = edges.sort_values(["TransitionType", "Weight", "From", "To"], ascending=[True, False, True, True])
    return ordered, pd.DataFrame(sequence_rows), edges


def main() -> None:
    parser = argparse.ArgumentParser(description="Transformacao formal RAMEX 2007 em rede de estados.")
    parser.add_argument("input_file")
    parser.add_argument("--customer-column")
    parser.add_argument("--time-column")
    parser.add_argument("--item-column")
    parser.add_argument("--ordered-out", default="ramex2007_ordered.csv")
    parser.add_argument("--sequences-out", default="ramex2007_sequences.csv")
    parser.add_argument("--edges-out", default="ramex2007_graph_edges.csv")
    args = parser.parse_args()

    path = Path(args.input_file)
    if args.customer_column and args.time_column and args.item_column:
        events = read_event_table(path, args.customer_column, args.time_column, args.item_column)
    else:
        events = read_simple_sequences(path)
    ordered, sequences, edges = build_outputs(events)
    Path(args.ordered_out).parent.mkdir(parents=True, exist_ok=True)
    ordered.to_csv(args.ordered_out, index=False)
    sequences.to_csv(args.sequences_out, index=False)
    edges.to_csv(args.edges_out, index=False)
    print(f"Gerados: {args.ordered_out}, {args.sequences_out}, {args.edges_out}")


if __name__ == "__main__":
    main()
