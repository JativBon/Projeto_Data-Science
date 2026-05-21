"""
10C_ramex_back_forward_polytree_formal.py

RAMEX Back-and-Forward — versão com formalização de Poly-tree.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
from matplotlib.axes import Axes
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

REQUIRED_COLUMNS = ["From", "To", "Weight"]
METHOD_NAME = "ramex_back_forward_polytree_formal"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RAMEX Back-and-Forward Poly-tree Formal.")
    parser.add_argument("input_edges_csv", help="CSV de entrada (From, To, Weight).")
    parser.add_argument("output_csv", help="CSV de saída.")
    parser.add_argument("output_png", help="PNG de saída.")
    parser.add_argument("--start-edge", default="auto", help="Aresta inicial: auto ou From->To.")
    parser.add_argument("--max-iterations", type=int, default=1000, help="Número máximo de iterações.")
    parser.add_argument("--output-json", default=None, help="JSON opcional.")
    parser.add_argument("--output-dot", default=None, help="Ficheiro DOT opcional.")
    parser.add_argument("--compare", action="store_true", help="Comparar com 10C original.")
    
    args = parser.parse_args()
    if args.max_iterations <= 0:
        raise ValueError("max_iterations deve ser um inteiro positivo.")
    return args


def load_edges(path_text: str) -> tuple[pd.DataFrame, int]:
    path = Path(path_text)
    if not path.exists() or path.stat().st_size == 0:
        raise ValueError(f"Ficheiro vazio ou inexistente: {path}")

    df = pd.read_csv(path)
    if missing := [c for c in REQUIRED_COLUMNS if c not in df.columns]:
        raise ValueError(f"Colunas obrigatórias em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    initial_len = len(df)
    valid_df = df.dropna(subset=REQUIRED_COLUMNS).query("Weight > 0").copy()
    
    if valid_df.empty:
        raise ValueError("Não existem arestas válidas com peso positivo.")

    return valid_df.sort_values(by="Weight", ascending=False).reset_index(drop=True), initial_len - len(valid_df)


def build_graph(edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for u, v, w in edges_df[REQUIRED_COLUMNS].itertuples(index=False):
        graph.add_edge(u, v, weight=float(w))
    if not graph.edges:
        raise ValueError("O grafo não contém arestas.")
    return graph


def choose_initial_edge(graph: nx.DiGraph, start_edge: str) -> tuple[str, str, float]:
    if start_edge.strip().lower() == "auto":
        u, v, d = max(graph.edges(data=True), key=lambda e: (e[2]["weight"], -ord(e[0][0]), -ord(e[1][0])))
        return u, v, float(d["weight"])

    sep = "->" if "->" in start_edge else "," if "," in start_edge else None
    if not sep:
        raise ValueError("start-edge inválido. Use auto, From->To ou From,To.")
        
    u, v = [p.strip() for p in start_edge.split(sep, 1)]
    if not graph.has_edge(u, v):
        raise ValueError(f"A aresta inicial indicada não existe: {u} -> {v}")
    
    return u, v, float(graph[u][v]["weight"])


def candidate_edges(graph: nx.DiGraph, included: set[str], selected: set[tuple[str, str]]) -> list[tuple[str, str, float, str]]:
    candidates = []
    for node in included:
        candidates.extend((node, v, d["weight"], "FORWARD") for _, v, d in graph.out_edges(node, data=True) 
                          if v not in included and (node, v) not in selected and node != v)
        candidates.extend((u, node, d["weight"], "BACKWARD") for u, _, d in graph.in_edges(node, data=True) 
                          if u not in included and (u, node) not in selected and u != node)
    
    unique_cands = list(dict.fromkeys(candidates))
    return sorted(unique_cands, key=lambda e: (-e[2], e[3], e[0], e[1]))


def is_polytree_valid(tree: nx.DiGraph, u: str, v: str, weight: float) -> tuple[bool, str]:
    test = tree.copy()
    test.add_edge(u, v, weight=weight)

    if not nx.is_directed_acyclic_graph(test):
        return False, f"ciclo dirigido ao adicionar {u} -> {v}"

    undirected = test.to_undirected()
    if not nx.is_tree(undirected):
        if not nx.is_connected(undirected):
            return False, f"grafo não dirigido ficaria desconexo ao adicionar {u} -> {v}"
        if undirected.number_of_edges() >= undirected.number_of_nodes():
            return False, f"grafo não dirigido ficaria com ciclo ao adicionar {u} -> {v} ({undirected.number_of_edges()} arestas, {undirected.number_of_nodes()} nós)"
        return False, f"grafo não dirigido não seria árvore ao adicionar {u} -> {v}"

    return True, ""


def build_polytree_formal(graph: nx.DiGraph, initial_edge: tuple[str, str, float], max_iters: int) -> tuple[nx.DiGraph, list[dict]]:
    u, v, w = initial_edge
    tree = nx.DiGraph()
    tree.add_edge(u, v, weight=w, direction="INITIAL", iteration=0)

    included, selected = {u, v}, {(u, v)}
    rejections = []

    for iteration in range(1, max_iters + 1):
        if len(included) >= graph.number_of_nodes():
            break

        candidates = candidate_edges(graph, included, selected)
        if not candidates:
            break

        edge_added = False
        for orig, target, weight, direction in candidates:
            valid, reason = is_polytree_valid(tree, orig, target, weight)
            if valid:
                tree.add_edge(orig, target, weight=weight, direction=direction, iteration=iteration)
                selected.update([(orig, target)])
                included.update([orig, target])
                edge_added = True
                break
            else:
                rejections.append({"iteration": iteration, "from": orig, "to": target, "weight": weight, "direction": direction, "reason": reason})

        if not edge_added:
            break

    if not tree.edges:
        raise ValueError("Não foi possível construir a poly-tree formal.")
    return tree, rejections


def _build_original_back_forward(graph: nx.DiGraph, initial_edge: tuple[str, str, float], max_iters: int) -> nx.DiGraph:
    u, v, w = initial_edge
    tree = nx.DiGraph()
    tree.add_edge(u, v, weight=w, direction="INITIAL", iteration=0)
    included, selected = {u, v}, {(u, v)}

    for iteration in range(1, max_iters + 1):
        if len(included) >= graph.number_of_nodes():
            break
            
        candidates = candidate_edges(graph, included, selected)
        edge_added = False
        
        for orig, target, weight, direction in candidates:
            tree.add_edge(orig, target, weight=weight, direction=direction, iteration=iteration)
            if nx.is_directed_acyclic_graph(tree):
                selected.add((orig, target))
                included.update([orig, target])
                edge_added = True
                break
            tree.remove_edge(orig, target)

        if not edge_added:
            break
            
    return tree


def calculate_levels(tree: nx.DiGraph, initial_from: str) -> dict[str, int]:
    levels = nx.single_source_shortest_path_length(tree.to_undirected(), initial_from)
    return {node: levels.get(node, 0) for node in tree.nodes}


def fmt_wt(w: float) -> int | float:
    return int(w) if w.is_integer() else round(w, 4)


def hierarchical_layout(graph: nx.DiGraph, root: str) -> dict:
    try:
        return nx.nx_agraph.graphviz_layout(graph, prog="dot", args="-Grankdir=TB")
    except Exception:
        levels = calculate_levels(graph, root) if root in graph else {}
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


def export_outputs(graph: nx.DiGraph, tree: nx.DiGraph, initial: tuple[str, str, float], 
                   rejections: list[dict], warnings: list[str], args: argparse.Namespace) -> dict:
    u, v, w = initial
    levels = calculate_levels(tree, u)
    ordered_edges = sorted(tree.edges(data=True), key=lambda e: (e[2].get("iteration", 0), e[0], e[1]))

    # CSV
    rows = [{
        "From": o, "To": t, "Weight": fmt_wt(d["weight"]), 
        "Level": 0 if d.get("direction") == "INITIAL" else max(levels[o], levels[t]),
        "Direction": d.get("direction", "FORWARD"), "Method": METHOD_NAME
    } for o, t, d in ordered_edges]
    pd.DataFrame(rows).to_csv(args.output_csv, index=False, encoding="utf-8")

    # JSON Payload
    orig_w = sum(d["weight"] for _, _, d in graph.edges(data=True))
    sel_w = sum(d["weight"] for _, _, d in tree.edges(data=True))
    is_dag = nx.is_directed_acyclic_graph(tree)
    is_undir_tree = nx.is_tree(tree.to_undirected())

    payload = {
        "algorithm": "RAMEX Back-and-Forward Poly-tree Formal", "method": METHOD_NAME,
        "initial_edge": {"from": u, "to": v, "weight": w},
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(), "selected_edges": tree.number_of_edges(),
            "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": (sel_w / orig_w * 100) if orig_w else 0,
            "is_acyclic": is_dag, "is_connected": nx.is_weakly_connected(tree),
            "is_polytree": is_dag and is_undir_tree, "is_tree_undirected": is_undir_tree,
            "rejected_edges_count": len(rejections),
        },
        "nodes": [{"id": n, "level": levels[n]} for n in sorted(tree.nodes, key=lambda n: (levels[n], n))],
        "edges": [{"from": o, "to": t, "weight": d["weight"], "level": r["Level"], "direction": r["Direction"]} for r, (o, t, d) in zip(rows, ordered_edges)],
        "rejected_edges": rejections, "warnings": warnings,
    }
    
    out_json = Path(args.output_json) if args.output_json else Path("data/json") / Path(args.output_csv).with_suffix(".json").name
    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_png).parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # DOT
    if args.output_dot:
        lines = ["digraph ramex_polytree_formal {", '  rankdir="LR";'] + [f'  "{n}";' for n in tree.nodes]
        lines.extend(f'  "{o}" -> "{t}" [label="{fmt_wt(d["weight"])} ({d.get("direction", "FORWARD")})", weight="{d["weight"]}"];' for o, t, d in tree.edges(data=True))
        Path(args.output_dot).write_text("\n".join(lines) + "\n}", encoding="utf-8")

    return payload


def render_network_axes(ax: Axes, tree: nx.DiGraph, initial: tuple[str, str, float], title: str) -> None:
    u, v, _ = initial
    pos = hierarchical_layout(tree, u)
    degrees = dict(tree.to_undirected().degree())

    colors = ["#f4b183" if n in {u, v} else "#dce9ee" for n in tree.nodes]
    max_w = max([d["weight"] for _, _, d in tree.edges(data=True)], default=1)
    node_sizes = [1700 + 420 * degrees.get(n, 0) for n in tree.nodes]
    font_size = 9 if tree.number_of_nodes() <= 15 else 7

    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes, edgecolors="#1f2937", linewidths=1.4, ax=ax)
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold", ax=ax)

    edge_colors = {"INITIAL": "#b45309", "FORWARD": "#2563eb", "BACKWARD": "#7c3aed"}
    for direction, color in edge_colors.items():
        edges = [(o, t) for o, t, d in tree.edges(data=True) if d.get("direction") == direction]
        if edges:
            widths = [1.0 + 5.0 * (tree[o][t]["weight"] / max_w) for o, t in edges]
            nx.draw_networkx_edges(tree, pos, edgelist=edges, width=widths, edge_color=color, 
                                   arrows=True, arrowstyle="-|>", arrowsize=20, alpha=0.86, connectionstyle="arc3,rad=0.04", ax=ax)

    labels = {(o, t): str(fmt_wt(d["weight"])) for o, t, d in tree.edges(data=True)}
    nx.draw_networkx_edge_labels(
        tree, pos, edge_labels=labels, font_size=max(font_size - 1, 6), ax=ax,
        bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
    )
    ax.legend(
        handles=[plt.Line2D([0], [0], color=color, lw=3, label=direction) for direction, color in edge_colors.items()],
        loc="upper right",
        frameon=True,
    )
    ax.set_title(title, fontsize=13, fontweight="bold")
    ax.axis("off")


def print_comparison(graph: nx.DiGraph, tree_orig: nx.DiGraph, tree_formal: nx.DiGraph, rejections: list) -> None:
    def get_m(t: nx.DiGraph):
        w = sum(d["weight"] for _, _, d in t.edges(data=True))
        return t.number_of_nodes(), t.number_of_edges(), w, (w / sum(d["weight"] for _, _, d in graph.edges(data=True)) * 100)

    n1, e1, w1, p1 = get_m(tree_orig)
    n2, e2, w2, p2 = get_m(tree_formal)

    print(f"\n{'='*64}\nCOMPARAÇÃO: 10C original vs 10C Poly-tree Formal\n{'='*64}")
    print(f"{'Métrica':<30} {'10C Original':>15} {'10C Formal':>15}\n{'-'*64}")
    print(f"{'Nós seleccionados':<30} {n1:>15} {n2:>15}")
    print(f"{'Arestas seleccionadas':<30} {e1:>15} {e2:>15}")
    print(f"{'Soma pesos seleccionados':<30} {w1:>15.2f} {w2:>15.2f}")
    print(f"{'Peso preservado (%)':<30} {p1:>14.2f}% {p2:>14.2f}%")
    print(f"{'Acíclico (DAG)':<30} {str(nx.is_directed_acyclic_graph(tree_orig)):>15} {str(nx.is_directed_acyclic_graph(tree_formal)):>15}")
    print(f"{'Grafo não dir. é árvore':<30} {str(nx.is_tree(tree_orig.to_undirected())):>15} {str(nx.is_tree(tree_formal.to_undirected())):>15}")
    print(f"{'Arestas rejeitadas':<30} {'—':>15} {len(rejections):>15}\n{'='*64}")

    only_orig = set(tree_orig.edges()) - set(tree_formal.edges())
    only_form = set(tree_formal.edges()) - set(tree_orig.edges())

    if not only_orig and not only_form:
        print("\nAs estruturas são idênticas.")
    else:
        if only_orig:
            print(f"\nArestas apenas no 10C original ({len(only_orig)}):")
            for u, v in sorted(only_orig): print(f"  {u} -> {v}  (peso: {fmt_wt(tree_orig[u][v]['weight'])})")
        if only_form:
            print(f"\nArestas apenas no 10C Formal ({len(only_form)}):")
            for u, v in sorted(only_form): print(f"  {u} -> {v}  (peso: {fmt_wt(tree_formal[u][v]['weight'])})")
    print()


def main() -> None:
    args = parse_arguments()
    warnings = []

    try:
        edges_df, invalid_count = load_edges(args.input_edges_csv)
        graph = build_graph(edges_df)
        initial_edge = choose_initial_edge(graph, args.start_edge)

        tree, rejections = build_polytree_formal(graph, initial_edge, args.max_iterations)

        assert nx.is_directed_acyclic_graph(tree), "Violação: contém ciclos dirigidos."
        assert nx.is_connected(tree.to_undirected()), "Violação: grafo não dirigido desconexo."
        assert nx.is_tree(tree.to_undirected()), "Violação: grafo não dirigido não é árvore."

        if tree.number_of_nodes() < graph.number_of_nodes():
            warnings.append(f"Incluídos {tree.number_of_nodes()} de {graph.number_of_nodes()} nós originais.")

        payload = export_outputs(graph, tree, initial_edge, rejections, warnings, args)

        # Plot Principal
        fig, ax = plt.subplots(figsize=(14, 9))
        render_network_axes(ax, tree, initial_edge, "RAMEX Back-and-Forward Poly-tree Formal")
        plt.tight_layout()
        plt.savefig(args.output_png, dpi=300, bbox_inches="tight")
        plt.close()

        # Resumo
        m = payload["metrics"]
        print(f"\n{'='*56}\nRAMEX Back-and-Forward Poly-tree Formal\n{'='*56}")
        print(f"Ficheiro lido         : {args.input_edges_csv}")
        if invalid_count: print(f"Aviso                 : ignoradas {invalid_count} arestas inválidas")
        print(f"Nós originais         : {m['original_nodes']}\nArestas originais     : {m['original_edges']}")
        print(f"Arestas seleccionadas : {m['selected_edges']}\nPeso preservado       : {m['preserved_weight_percent']:.2f}%")
        print(f"É poly-tree formal    : {m['is_polytree']}\n")
        
        if m["is_polytree"]: print(">>> ESTRUTURA VÁLIDA COMO POLY-TREE FORMAL <<<\n")
        else: print(">>> AVISO: estrutura NÃO satisfaz poly-tree formal <<<\n")

        if args.compare:
            tree_orig = _build_original_back_forward(graph, initial_edge, args.max_iterations)
            print_comparison(graph, tree_orig, tree, rejections)
            
            fig, axes = plt.subplots(1, 2, figsize=(22, 9))
            render_network_axes(axes[0], tree_orig, initial_edge, "10C — Original")
            render_network_axes(axes[1], tree, initial_edge, "10C — Poly-tree Formal")
            comp_png = Path(args.output_png).with_name(Path(args.output_png).stem + "_comparacao.png")
            plt.tight_layout()
            plt.savefig(comp_png, dpi=300, bbox_inches="tight")
            plt.close()
            print(f"PNG de comparação: {comp_png}")

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

if __name__ == "__main__":
    main()
