"""
Esta fase implementa a aproximaÃ§Ã£o RAMEX 2007 baseada em Maximum Weight
Rooted Branching. As heurÃ­sticas Top-K/Multiobjetivo pertencem a fases
experimentais anteriores e nÃ£o fazem parte desta implementaÃ§Ã£o base.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

REQUIRED_EDGE_COLUMNS = ["From", "To", "Weight"]


def parse_bool(value: str) -> bool:
    if (norm := value.strip().lower()) in {"true", "1", "yes", "sim", "s"}: return True
    if norm in {"false", "0", "no", "nao", "nÃ£o", "n"}: return False
    raise argparse.ArgumentTypeError("Valor booleano invÃ¡lido. Use true ou false.")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RAMEX 2007 - Maximum Weight Rooted Branching.")
    parser.add_argument("input_file", help="CSV de arestas ou TXT com sequÃªncias.")
    parser.add_argument("output_csv", help="CSV de saÃ­da.")
    parser.add_argument("output_png", help="PNG de saÃ­da.")
    parser.add_argument("--input-type", choices=["edges", "sequences"], default="edges")
    parser.add_argument("--root", default="SOURCE", help="Raiz a usar.")
    parser.add_argument("--source", default="SOURCE", help="Nome do nÃ³ inicial.")
    parser.add_argument("--sink", default="SINK", help="Nome do nÃ³ final.")
    parser.add_argument("--include-sink", type=parse_bool, default=False)
    parser.add_argument("--output-json", default=None, help="JSON a gerar.")
    parser.add_argument("--output-dot", default=None, help="DOT opcional.")
    return parser.parse_args()


def load_sequences_network(path: Path, source: str, sink: str) -> tuple[nx.DiGraph, list[str]]:
    counts, valid_seqs = Counter(), 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if events := [t.strip() for t in line.replace(",", " ").split() if t.strip()]:
            valid_seqs += 1
            counts[(source, events[0])] += 1
            counts.update(zip(events, events[1:]))
            counts[(events[-1], sink)] += 1

    if not valid_seqs:
        raise ValueError("NÃ£o foram encontradas sequÃªncias vÃ¡lidas.")

    graph = nx.DiGraph()
    graph.add_weighted_edges_from((u, v, w) for (u, v), w in counts.items())
    return graph, [f"SequÃªncias vÃ¡lidas lidas: {valid_seqs}."]


def load_edges_network(path: Path, source: str, sink: str, include_sink: bool) -> tuple[nx.DiGraph, list[str]]:
    warnings = []
    try:
        df = pd.read_csv(path)
    except pd.errors.EmptyDataError as exc:
        raise ValueError("O CSV de arestas estÃ¡ vazio.") from exc

    if missing := [c for c in REQUIRED_EDGE_COLUMNS if c not in df.columns]:
        raise ValueError(f"Colunas obrigatÃ³rias em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    initial_len = len(df)
    valid_df = df.dropna(subset=REQUIRED_EDGE_COLUMNS).query("Weight > 0")
    if invalid_count := initial_len - len(valid_df):
        warnings.append(f"Ignoradas {invalid_count} arestas com peso invÃ¡lido.")
    if valid_df.empty:
        raise ValueError("NÃ£o existem arestas vÃ¡lidas com peso positivo.")

    graph = nx.DiGraph()
    graph.add_weighted_edges_from(valid_df[REQUIRED_EDGE_COLUMNS].itertuples(index=False))

    if source not in graph:
        if no_in := [n for n in graph.nodes if graph.in_degree(n) == 0]:
            graph.add_weighted_edges_from((source, n, sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)) or 1.0) for n in no_in)
            warnings.append(f"NÃ³ {source} adicionado a {len(no_in)} nÃ³(s) sem entradas.")
        else:
            warnings.append(f"NÃ³ {source} nÃ£o existe e o grafo nÃ£o tem nÃ³s sem entradas.")

    if include_sink and sink not in graph:
        if no_out := [n for n in graph.nodes if graph.out_degree(n) == 0 and n != sink]:
            graph.add_weighted_edges_from((n, sink, 1.0) for n in no_out)
            warnings.append(f"NÃ³ {sink} adicionado a {len(no_out)} nÃ³(s) sem saÃ­das.")
        else:
            warnings.append(f"NÃ³ {sink} nÃ£o foi adicionado porque nÃ£o existem nÃ³s sem saÃ­das.")

    return graph, warnings


def choose_root(graph: nx.DiGraph, req_root: str, source: str, warnings: list[str]) -> str:
    if req_root in graph:
        return req_root
    if source in graph:
        warnings.append(f"Raiz pedida '{req_root}' nÃ£o existe. Foi usado o nÃ³ {source}.")
        return source

    cands = [(str(n), sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), graph.out_degree(n)) for n in graph.nodes]
    if not cands:
        raise ValueError("NÃ£o existem nÃ³s para escolher raiz.")
    
    chosen = min(cands, key=lambda x: (-x[1], -x[2], x[0]))[0]
    warnings.append(f"Raiz pedida '{req_root}' nÃ£o existe. Escolhida automaticamente: {chosen}.")
    return chosen


def greedy_rooted_branching(graph: nx.DiGraph, root: str) -> nx.DiGraph:
    tree, visited = nx.DiGraph(), {root}
    tree.add_node(root)

    while visited != set(graph.nodes):
        cands = sorted(
            ((u, v, d["weight"]) for u in visited for _, v, d in graph.out_edges(u, data=True) if v not in visited),
            key=lambda e: (-e[2], str(e[0]), str(e[1]))
        )
        if not cands: break

        for u, v, w in cands:
            tree.add_edge(u, v, weight=w)
            if nx.is_directed_acyclic_graph(tree):
                visited.add(v)
                break
            tree.remove_edge(u, v)
        else:
            break
    return tree


def networkx_rooted_branching(graph: nx.DiGraph, root: str, warnings: list[str]) -> tuple[nx.DiGraph, str]:
    working = graph.copy()
    working.remove_edges_from(list(working.in_edges(root)))
    try:
        branching = nx.algorithms.tree.branchings.maximum_spanning_arborescence(working, attr="weight", default=0, preserve_attrs=True)
        if root not in branching or set(nx.descendants(branching, root)) | {root} != set(branching.nodes):
            raise ValueError("ArborescÃªncia invÃ¡lida.")
        return branching, "networkx_arborescence"
    except Exception as exc:
        warnings.append(f"NetworkX nÃ£o garantiu rooted branching ({exc}). A usar fallback greedy.")
        return greedy_rooted_branching(graph, root), "greedy_rooted_branching_fallback"


def fmt_wt(w: float) -> int | float:
    return int(w) if w.is_integer() else round(w, 4)


def dataset_label_from_path(path: Path) -> str:
    for part in path.stem.replace("-", "_").split("_"):
        if part.lower().startswith("dataset"):
            return part
    return path.stem


def hierarchical_layout(graph: nx.DiGraph, root: str) -> dict:
    try:
        return nx.nx_agraph.graphviz_layout(graph, prog="dot", args="-Grankdir=TB")
    except Exception:
        levels = nx.single_source_shortest_path_length(graph.to_undirected(), root) if root in graph else {}
        grouped: dict[int, list[str]] = {}
        for node in graph.nodes:
            grouped.setdefault(levels.get(node, 0), []).append(node)
        shells = [sorted(nodes, key=str) for _, nodes in sorted(grouped.items())]
        shell_pos = nx.shell_layout(graph, nlist=shells)
        return {
            node: (
                shell_pos[node][0] * (1 + 0.12 * levels.get(node, 0)),
                -1.9 * levels.get(node, 0) + shell_pos[node][1] * 0.2,
            )
            for node in graph.nodes
        }


def edge_color_scale(tree: nx.DiGraph) -> list:
    weights = [d["weight"] for _, _, d in tree.edges(data=True)]
    max_w = max(weights, default=1)
    return [plt.cm.Blues(0.35 + 0.55 * (w / max_w)) for w in weights]


def export_outputs(graph: nx.DiGraph, reachable: nx.DiGraph, tree: nx.DiGraph, root: str, method: str, args: argparse.Namespace, warnings: list[str]) -> dict:
    levels = nx.single_source_shortest_path_length(tree, root)
    ordered_edges = sorted(tree.edges(data=True), key=lambda e: (levels.get(e[0], 0), str(e[0]), str(e[1])))

    # CSV
    rows = [{
        "From": u, "To": v, "Weight": fmt_wt(d["weight"]),
        "Level": levels.get(v, levels.get(u, 0) + 1), "Method": method, "IsRootedBranching": True
    } for u, v, d in ordered_edges]
    
    if not rows: raise ValueError("NÃ£o foram selecionadas arestas para exportar.")
    pd.DataFrame(rows).to_csv(args.output_csv, index=False, encoding="utf-8")

    # JSON Payload
    orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
    sel_w = sum(d["weight"] for _, _, d in tree.edges(data=True))
    is_dag = nx.is_directed_acyclic_graph(tree)
    max_indeg = max((deg for n, deg in tree.in_degree() if n != root), default=0)

    val_warnings = []
    if tree.in_degree(root) != 0: val_warnings.append("A raiz tem in-degree diferente de 0.")
    if max_indeg > 1: val_warnings.append("NÃ³ nÃ£o-raiz com in-degree superior a 1.")
    if not is_dag: val_warnings.append("O output contÃ©m ciclos.")
    val_warnings.extend(f"Aresta {u} -> {v} nÃ£o existe no original." for u, v in tree.edges if not graph.has_edge(u, v))

    payload = {
        "algorithm": "RAMEX 2007 Rooted Branching", "method": method, "root": root, "source": args.source, "sink": args.sink, "include_sink": args.include_sink,
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "reachable_nodes": reachable.number_of_nodes(), "selected_nodes": tree.number_of_nodes(),
            "selected_edges": tree.number_of_edges(), "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": (sel_w / orig_w * 100) if orig_w else 0,
            "is_acyclic": is_dag, "max_indegree_except_root": max_indeg,
        },
        "nodes": [{"id": n, "level": levels.get(n, 0), "is_root": n == root} for n in sorted(tree.nodes, key=lambda x: (levels.get(x, 0), str(x)))],
        "edges": [{"from": r["From"], "to": r["To"], "weight": d["weight"], "level": r["Level"]} for r, (u, v, d) in zip(rows, ordered_edges)],
        "warnings": warnings + val_warnings,
    }
    
    out_json = Path(args.output_json) if args.output_json else Path(args.output_csv).with_suffix(".json")
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # DOT
    if args.output_dot:
        lines = ["digraph ramex2007 {", '  rankdir="LR";'] + [f'  "{n}";' for n in tree.nodes]
        lines.extend(f'  "{u}" -> "{v}" [label="{fmt_wt(d["weight"])}", weight="{d["weight"]}"];' for u, v, d in tree.edges(data=True))
        Path(args.output_dot).write_text("\n".join(lines) + "\n", encoding="utf-8")

    return payload


def draw_tree(tree: nx.DiGraph, root: str, sink: str, include_sink: bool, output_png: Path) -> None:
    pos = hierarchical_layout(tree, root)
    degrees = dict(tree.to_undirected().degree())

    colors = ["#f4b183" if n == root else "#d9d2e9" if include_sink and n == sink else "#dce9ee" for n in tree.nodes]
    max_w = max([d["weight"] for _, _, d in tree.edges(data=True)], default=1)
    widths = [1.0 + 5.0 * (d["weight"] / max_w) for _, _, d in tree.edges(data=True)]
    node_sizes = [1900 + 420 * degrees.get(n, 0) for n in tree.nodes]
    font_size = 9 if tree.number_of_nodes() <= 15 else 7

    plt.figure(figsize=(18, 11))
    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes, edgecolors="#1f2937", linewidths=1.4)
    nx.draw_networkx_edges(
        tree, pos, width=widths, arrows=True, arrowstyle="-|>", arrowsize=20,
        edge_color=edge_color_scale(tree), alpha=0.88, connectionstyle="arc3,rad=0.02"
    )
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold")
    nx.draw_networkx_edge_labels(
        tree, pos,
        edge_labels={(u, v): str(fmt_wt(d["weight"])) for u, v, d in tree.edges(data=True)},
        font_size=max(font_size - 1, 6),
        bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
    )

    plt.title(f"RAMEX - RAMEX 2007 Rooted Branching - {dataset_label_from_path(output_png)}", fontsize=16, fontweight="bold")
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
    plt.close()

def main() -> None:
    args = parse_arguments()
    warnings = []

    try:
        path = Path(args.input_file)
        if not path.exists() or path.stat().st_size == 0:
            raise ValueError(f"Ficheiro invÃ¡lido/vazio: {path}")

        if args.input_type == "sequences":
            graph, w = load_sequences_network(path, args.source, args.sink)
        else:
            graph, w = load_edges_network(path, args.source, args.sink, args.include_sink)
        warnings.extend(w)

        if not graph.nodes or not graph.edges:
            raise ValueError("O grafo construÃ­do estÃ¡ vazio.")

        root = choose_root(graph, args.root, args.source, warnings)
        
        reach = set(nx.descendants(graph, root)) | {root}
        if unreach := set(graph.nodes) - reach: warnings.append(f"Removidos {len(unreach)} nÃ³s inalcanÃ§Ã¡veis.")
        if not args.include_sink and args.sink in reach: reach.remove(args.sink)
        
        reachable_graph = nx.DiGraph(graph.subgraph(reach))
        if not reachable_graph.edges: raise ValueError("A componente alcanÃ§Ã¡vel nÃ£o contÃ©m arestas.")

        tree, method = networkx_rooted_branching(reachable_graph, root, warnings)
        if not tree.edges: raise ValueError("NÃ£o foi possÃ­vel gerar rooted branching.")

        payload = export_outputs(graph, reachable_graph, tree, root, method, args, warnings)
        draw_tree(tree, root, args.sink, args.include_sink, Path(args.output_png))

        m = payload["metrics"]
        print(f"Ficheiro lido: {args.input_file} | Tipo: {args.input_type}\nNÃ³s originais: {m['original_nodes']} | Arestas: {m['original_edges']}")
        print(f"Raiz: {root} | Source: {args.source} | Sink: {args.sink} | MÃ©todo: {method}")
        print(f"NÃ³s alcanÃ§Ã¡veis: {m['reachable_nodes']} | Selecionados: {m['selected_nodes']} | Arestas sel.: {m['selected_edges']}")
        print(f"Peso orig.: {m['original_weight_sum']:.2f} | Peso sel.: {m['selected_weight_sum']:.2f} ({m['preserved_weight_percent']:.2f}%)")
        print(f"AcÃ­clico: {m['is_acyclic']} | Max in-degree (!=raiz): {m['max_indegree_except_root']}")
        if payload["warnings"]: print("\nAvisos:\n" + "\n".join(f"- {w}" for w in payload["warnings"]))

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

if __name__ == "__main__":
    main()

