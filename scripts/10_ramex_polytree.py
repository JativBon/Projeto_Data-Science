"""
10_ramex_polytree.py

Gera uma aproximação RAMEX Poly-tree a partir de um CSV de arestas ponderadas.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import deque
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

COLUNAS_OBRIGATORIAS = ["From", "To", "Weight"]
DEFAULT_MAX_DEPTH = 5
DEFAULT_TOP_K_PER_NODE = 2
DEFAULT_MAX_BRANCHING = 3
DEFAULT_MIN_SCORE = 0.0
DEFAULT_PRESERVE_WEIGHT_TARGET = 0.7

# Pesos experimentais usados no score multiobjetivo do Poly-tree.
DEFAULT_ALPHA = 0.35
DEFAULT_BETA = 0.25
DEFAULT_GAMMA = 0.15
DEFAULT_DELTA = 0.15
DEFAULT_EPSILON = 0.05
DEFAULT_ZETA = 0.05

HIGH_NORMALIZED_WEIGHT = 0.7
HIGH_TRANSITION_PROBABILITY = 0.5
MIN_COVERAGE_GAIN_REASON = 0.05
CENTRAL_TARGET_THRESHOLD = 0.65
REDUNDANCY_WEIGHT_KEEP_THRESHOLD = 0.35
SCORE_DECIMALS = 4
INTERPRETABILITY_WEIGHT_PRESERVED = 0.4
INTERPRETABILITY_BRANCHING = 0.3
INTERPRETABILITY_NODE_COVERAGE = 0.3


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera aproximação RAMEX Poly-tree.")
    parser.add_argument("input_edges_csv", help="CSV de arestas (From, To, Weight).")
    parser.add_argument("output_csv", help="CSV de saída.")
    parser.add_argument("output_png", help="PNG da poly-tree.")
    parser.add_argument("--strategy", choices=["top-k", "multiobjective"], default="top-k")
    parser.add_argument("--min-weight", type=float, default=None)
    parser.add_argument("--top-k-per-node", type=int, default=DEFAULT_TOP_K_PER_NODE)
    parser.add_argument("--max-depth", type=int, default=DEFAULT_MAX_DEPTH)
    parser.add_argument("--alpha", type=float, default=DEFAULT_ALPHA)
    parser.add_argument("--beta", type=float, default=DEFAULT_BETA)
    parser.add_argument("--gamma", type=float, default=DEFAULT_GAMMA)
    parser.add_argument("--delta", type=float, default=DEFAULT_DELTA)
    parser.add_argument("--epsilon", type=float, default=DEFAULT_EPSILON)
    parser.add_argument("--zeta", type=float, default=DEFAULT_ZETA)
    parser.add_argument("--preserve-weight-target", type=float, default=DEFAULT_PRESERVE_WEIGHT_TARGET)
    parser.add_argument("--max-branching", type=int, default=DEFAULT_MAX_BRANCHING)
    parser.add_argument("--min-score", type=float, default=DEFAULT_MIN_SCORE)
    
    args = parser.parse_args()
    if args.top_k_per_node <= 0 or (args.max_depth and args.max_depth <= 0) or args.max_branching <= 0:
        raise ValueError("top-k, max-depth e max-branching devem ser > 0.")
    if not (0 < args.preserve_weight_target <= 1):
        raise ValueError("--preserve-weight-target deve estar entre 0 e 1.")
    if any(getattr(args, p) < 0 for p in ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "min_score"] + (["min_weight"] if args.min_weight else [])):
        raise ValueError("Pesos e scores mínimos não podem ser negativos.")
    return args


def load_edges(path: str) -> tuple[pd.DataFrame, int]:
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio ou inexistente: {path}")

    df = pd.read_csv(p, encoding="utf-8")
    if missing := [c for c in COLUNAS_OBRIGATORIAS if c not in df.columns]:
        raise ValueError(f"Colunas em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    initial_len = len(df)
    valid_df = df.dropna(subset=COLUNAS_OBRIGATORIAS).query("Weight > 0").copy()

    if valid_df.empty:
        raise ValueError("Não existem arestas válidas com peso positivo.")

    return valid_df.sort_values(by="Weight", ascending=False).reset_index(drop=True), initial_len - len(valid_df)


def calculate_centrality(graph: nx.DiGraph) -> dict[str, float]:
    try:
        cent = nx.pagerank(graph, weight="weight")
    except Exception:
        cent = nx.degree_centrality(graph)
    
    max_c = max(cent.values(), default=1.0) or 1.0
    return {str(k): float(v) / max_c for k, v in cent.items()}


def choose_root(graph: nx.DiGraph, centrality: dict[str, float]) -> str:
    for node in graph.nodes:
        if str(node).upper() == "START":
            return str(node)

    cands = [(str(n), sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), graph.out_degree(n), centrality.get(str(n), 0.0)) for n in graph.nodes]
    return min(cands, key=lambda x: (-x[1], -x[3], -x[2], x[0]))[0]


def build_polytree_topk(graph: nx.DiGraph, root: str, top_k: int, max_depth: int, min_weight: float | None) -> pd.DataFrame:
    queue, rows, seen = deque([(root, 0, [root])]), [], set()

    while queue:
        curr, lvl, path = queue.popleft()
        if lvl >= (max_depth or DEFAULT_MAX_DEPTH): continue

        edges = sorted(
            [(str(curr), str(v), d["weight"]) for _, v, d in graph.out_edges(curr, data=True) 
             if v not in path and (min_weight is None or d["weight"] >= min_weight)],
            key=lambda e: (-e[2], e[1])
        )

        for u, v, w in edges[:top_k]:
            parent_path = " -> ".join(path)
            if (u, v, parent_path) in seen: continue
            seen.add((u, v, parent_path))

            rows.append({
                "From": u, "To": v, "Weight": w, "Level": lvl + 1, "ParentPath": parent_path,
                "Score": 0.0, "Strategy": "top-k", "Reason": "Selecionada via Top-K de maior peso"
            })
            queue.append((v, lvl + 1, path + [v]))

    if not rows: raise ValueError("Falha ao construir a poly-tree com os parâmetros definidos.")
    return pd.DataFrame(rows)


def explain_mo_reason(nw: float, tp: float, cg: float, tc: float, rp: float) -> str:
    if nw >= HIGH_NORMALIZED_WEIGHT and tp >= HIGH_TRANSITION_PROBABILITY: return "alto peso e elevada probabilidade local"
    if cg >= MIN_COVERAGE_GAIN_REASON: return "boa cobertura global"
    if tc >= CENTRAL_TARGET_THRESHOLD: return "destino central no grafo"
    if rp > 0 and nw >= REDUNDANCY_WEIGHT_KEEP_THRESHOLD: return "penalizada por redundância, mantida por peso"
    return "equilíbrio entre peso, cobertura e centralidade"


def build_polytree_multiobjective(graph: nx.DiGraph, root: str, args: argparse.Namespace, cent: dict[str, float]) -> pd.DataFrame:
    orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
    if orig_w <= 0: raise ValueError("Soma dos pesos originais é zero.")

    max_w = max((d["weight"] for _, _, d in graph.edges(data=True)), default=1.0) or 1.0
    out_w = {str(n): sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)) for n in graph.nodes}

    frontier, rows, uniq_edges = [(root, [root])], [], set()
    rep_targets, sel_from, pres_w = {}, {}, 0.0

    for lvl in range(args.max_depth):
        if not frontier or pres_w / orig_w >= args.preserve_weight_target: break

        cands = []
        for curr, path in frontier:
            for _, v, d in graph.out_edges(curr, data=True):
                u, v_str, w = str(curr), str(v), float(d["weight"])
                if (args.min_weight and w < args.min_weight) or v_str in path or sel_from.get(u, 0) >= args.max_branching:
                    continue

                nw, tp = w / max_w, (w / out_w[u] if out_w.get(u, 0) else 0.0)
                cg = (w / orig_w) if (u, v_str) not in uniq_edges else 0.0
                tc, rp = cent.get(v_str, 0.0), rep_targets.get(v_str, 0) / max(1, len(rows))
                cp = min(1.0, ((lvl + 1) / max(args.max_depth, 1)) + (sel_from.get(u, 0) / max(args.max_branching, 1)))

                score = (args.alpha * nw + args.beta * tp + args.gamma * cg + args.delta * tc - args.epsilon * rp - args.zeta * cp)
                if score >= args.min_score:
                    cands.append({
                        "From": u, "To": v_str, "Weight": w, "Level": lvl + 1, "ParentPath": " -> ".join(path),
                        "Path": path + [v_str], "Score": score, "Strategy": "multiobjective",
                        "Reason": explain_mo_reason(nw, tp, cg, tc, rp)
                    })

        cands.sort(key=lambda r: (-r["Score"], -r["Weight"], r["To"]))
        next_frontier, sel_lvl = [], 0

        for r in cands:
            if sel_lvl >= args.max_branching: break
            u, v_str = r["From"], r["To"]
            if sel_from.get(u, 0) >= args.max_branching: continue

            p = r.pop("Path")
            rows.append(r)
            sel_lvl += 1
            sel_from[u] = sel_from.get(u, 0) + 1
            rep_targets[v_str] = rep_targets.get(v_str, 0) + 1

            if (u, v_str) not in uniq_edges:
                uniq_edges.add((u, v_str))
                pres_w += r["Weight"]

            next_frontier.append((v_str, p))
            if pres_w / orig_w >= args.preserve_weight_target: break

        frontier = next_frontier

    if not rows: raise ValueError("Falha ao construir a poly-tree multiobjetivo.")
    df = pd.DataFrame(rows)
    df["Score"] = pd.to_numeric(df["Score"], errors="coerce").round(SCORE_DECIMALS)
    return df


def build_polytree_graph(df: pd.DataFrame) -> nx.DiGraph:
    g = nx.DiGraph()
    for u, v, w in df[["From", "To", "Weight"]].itertuples(index=False):
        if g.has_edge(u, v):
            g[u][v]["weight"] = max(g[u][v]["weight"], float(w))
            g[u][v]["occurrences"] += 1
        else:
            g.add_edge(u, v, weight=float(w), occurrences=1)
    return g


def fmt_wt(w: float) -> int | float:
    return int(w) if float(w).is_integer() else w


def as_str(value: Any) -> str:
    return str(value)


def as_int(value: Any) -> int:
    return int(value)


def as_float(value: Any) -> float:
    return float(value)


def export_outputs(graph: nx.DiGraph, pt_graph: nx.DiGraph, df: pd.DataFrame, root: str, args: argparse.Namespace) -> dict:
    df_export = df.copy()
    df_export["Weight"] = df_export["Weight"].apply(fmt_wt)
    df_export[[c for c in ["From", "To", "Weight", "Level", "Strategy", "Score", "Reason", "ParentPath"] if c in df.columns]].to_csv(args.output_csv, index=False, encoding="utf-8")

    orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
    pt_w = sum(d["weight"] for _, _, d in pt_graph.edges(data=True))
    avg_branch = float(df.groupby("From")["To"].count().mean()) if not df.empty else 0.0

    metrics = {
        "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
        "polytree_nodes": pt_graph.number_of_nodes(), "polytree_edges": len(df),
        "original_weight_sum": orig_w, "polytree_weight_sum": pt_w,
        "preserved_weight_percent": (pt_w / orig_w * 100) if orig_w else 0,
        "coverage_by_level": {str(l): float(g["Weight"].sum()) for l, g in df.groupby("Level")},
        "average_branching": avg_branch, "branching_average": avg_branch,
        "max_depth": int(df["Level"].max()) if not df.empty else 0,
        "repeated_nodes": int(df["To"].duplicated().sum()) if "To" in df.columns else 0,
        "average_score": float(pd.to_numeric(df["Score"], errors="coerce").mean()) if "Score" in df.columns and not df["Score"].isna().all() else None,
        "density_before": nx.density(graph) if graph.number_of_nodes() > 1 else 0,
        "density_after": nx.density(pt_graph) if pt_graph.number_of_nodes() > 1 else 0,
        "edge_reduction_percent": (1 - pt_graph.number_of_edges() / graph.number_of_edges()) * 100 if graph.number_of_edges() else 0,
        "interpretability_score": (
            INTERPRETABILITY_WEIGHT_PRESERVED * min(1.0, pt_w / orig_w if orig_w else 0)
            + INTERPRETABILITY_BRANCHING * (1 / (1 + avg_branch))
            + INTERPRETABILITY_NODE_COVERAGE * min(1.0, len(set(df["To"])) / max(1, pt_graph.number_of_nodes()))
        ) * 100
    }

    node_levels = {root: 0}
    for row in df.sort_values("Level").to_dict(orient="records"):
        from_node = as_str(row["From"])
        to_node = as_str(row["To"])
        level = as_int(row["Level"])
        node_levels[from_node] = min(node_levels.get(from_node, level), max(level - 1, 0))
        node_levels[to_node] = min(node_levels.get(to_node, level), level)

    payload = {
        "root": root, "strategy": args.strategy, "metrics": metrics,
        "nodes": [{"id": n, "level": l} for n, l in sorted(node_levels.items(), key=lambda x: (x[1], x[0]))],
        "edges": [
            {
                "from": as_str(row["From"]),
                "to": as_str(row["To"]),
                "weight": as_float(row["Weight"]),
                "level": as_int(row["Level"]),
                "strategy": as_str(row["Strategy"]),
                "score": None if pd.isna(row.get("Score")) else as_float(row["Score"]),
                "reason": as_str(row["Reason"]),
            }
            for row in df.to_dict(orient="records")
        ],
        "parameters": vars(args), "scoring_formula": "score = alpha * nw + beta * tp + gamma * cg + delta * tc - epsilon * rp - zeta * cp"
    }
    
    out_json = Path("data/json") / Path(args.output_csv).with_suffix(".json").name
    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_png).parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def draw_polytree(graph: nx.DiGraph, root: str, output_png: str) -> None:
    if not graph.edges: return
    
    try: pos = nx.nx_agraph.graphviz_layout(graph, prog="dot")
    except Exception: pos = nx.spring_layout(graph, seed=42, weight="weight")

    small = graph.number_of_nodes() <= 35 and graph.number_of_edges() <= 90
    max_w = max([d["weight"] for _, _, d in graph.edges(data=True)], default=1)
    widths = [0.8 + 4.0 * (d["weight"] / max_w) for _, _, d in graph.edges(data=True)]
    colors = ["#f9cb9c" if n == root else "#dce9ee" for n in graph.nodes]

    plt.figure(figsize=(14, 9))
    nx.draw_networkx_nodes(graph, pos, node_size=2600 if small else 650, node_color=colors, edgecolors="#1f2937")
    nx.draw_networkx_edges(graph, pos, width=widths, alpha=0.68 if small else 0.24, edge_color="#374151", arrows=True, arrowsize=18 if small else 9, connectionstyle="arc3,rad=0.05")
    nx.draw_networkx_labels(graph, pos, font_size=10 if small else 6, font_weight="bold")

    if small:
        nx.draw_networkx_edge_labels(graph, pos, edge_labels={(u, v): fmt_wt(d["weight"]) for u, v, d in graph.edges(data=True)}, font_size=8)

    plt.title("RAMEX Poly-tree - aproximação acadêmica", fontsize=14)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
    plt.close()


def main() -> int:
    args = parse_arguments()
    try:
        edges_df, invalid_count = load_edges(args.input_edges_csv)
        graph = nx.DiGraph()
        graph.add_weighted_edges_from(edges_df[["From", "To", "Weight"]].itertuples(index=False))
        
        cent = calculate_centrality(graph)
        root = choose_root(graph, cent)
        
        df = build_polytree_multiobjective(graph, root, args, cent) if args.strategy == "multiobjective" else build_polytree_topk(graph, root, args.top_k_per_node, args.max_depth, args.min_weight)
        
        pt_graph = build_polytree_graph(df)
        payload = export_outputs(graph, pt_graph, df, root, args)
        draw_polytree(pt_graph, root, args.output_png)
        
        m = payload["metrics"]
        print(f"Ficheiro lido: {args.input_edges_csv}\nAviso: {invalid_count} arestas ignoradas." if invalid_count else f"Ficheiro lido: {args.input_edges_csv}")
        print(f"Nós originais: {m['original_nodes']} | Arestas: {m['original_edges']}\nRaiz: {root}")
        print(f"Nós PT: {m['polytree_nodes']} | Arestas PT: {m['polytree_edges']}")
        print(f"Peso preservado: {fmt_wt(m['polytree_weight_sum'])} de {fmt_wt(m['original_weight_sum'])} ({m['preserved_weight_percent']:.2f}%)")
        print(f"Profundidade máx: {m['max_depth']} | Nós repetidos: {m['repeated_nodes']} | Score médio: {m['average_score'] or 'N/A'}")
        
        print("\nTop 10 arestas selecionadas:")
        for row in df.sort_values("Weight", ascending=False).head(10).to_dict(orient="records"):
            score = row.get("Score")
            sc = f" | score {as_float(score):.4f}" if pd.notna(score) else ""
            print(
                f"{as_str(row['From'])} -> {as_str(row['To'])} = {fmt_wt(as_float(row['Weight']))} "
                f"| nível {as_int(row['Level'])}{sc} | {as_str(row['Reason'])}"
            )

        return 0

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
