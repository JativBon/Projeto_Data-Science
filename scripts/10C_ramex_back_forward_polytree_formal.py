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

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="backslashreplace")

import matplotlib
matplotlib.use("Agg")
from matplotlib.axes import Axes
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
from ramex_validation import validate_polytree

REQUIRED_COLUMNS = ["From", "To", "Weight"]
METHOD_NAME = "ramex_back_forward_polytree_formal"
FORMAL_TITLE = "RAMEX 2015 / Back-and-Forward — Poly-tree Formal"
FORMAL_LEGEND = "Poly-tree formal: DAG cujo grafo não dirigido é uma árvore."
INVALID_LABEL = "Estrutura Back-and-Forward inválida — requer revisão."


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

    df = pd.read_csv(path, encoding="utf-8")
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


def validate_polytree_formal(tree: nx.DiGraph, original_graph: nx.DiGraph) -> dict:
    return validate_polytree(tree, original_graph)

def hierarchical_layout(graph: nx.DiGraph, root: str) -> dict:
    try:
        return nx.nx_agraph.graphviz_layout(graph, prog="dot", args="-Grankdir=LR")
    except Exception:
        levels = calculate_levels(graph, root) if root in graph else {}
        grouped: dict[int, list[str]] = {}
        for node in graph.nodes:
            grouped.setdefault(levels.get(node, 0), []).append(node)
        max_level = max(grouped.keys(), default=0)
        pos: dict[str, tuple[float, float]] = {}
        for level, nodes in sorted(grouped.items()):
            ordered = sorted(nodes, key=str)
            count = len(ordered)
            for index, node in enumerate(ordered):
                pos[node] = (
                    (level / max(max_level, 1)) * 10,
                    (index - (count - 1) / 2) * max(1.8, 8 / max(count, 1)),
                )
        return pos


def neato_layout_optional(graph: nx.DiGraph) -> dict | None:
    try:
        return nx.nx_agraph.graphviz_layout(graph, prog="neato")
    except Exception:
        return None


def canonical_export_paths(output_csv: Path, output_json: Path, output_png: Path) -> dict[str, Path]:
    return {
        "edges_csv": output_csv.parent / "back_forward_polytree_formal_edges.csv",
        "tree_json": output_json.parent / "back_forward_polytree_formal.json",
        "metrics_json": output_json.parent / "back_forward_polytree_formal_metrics.json",
        "hierarchical_png": output_png.parent / "back_forward_polytree_formal_hierarchical.png",
        "paper_style_png": output_png.parent / "back_forward_polytree_paper_style.png",
        "neato_optional_png": output_png.parent / "back_forward_polytree_formal_neato_optional.png",
    }


def export_outputs(graph: nx.DiGraph, tree: nx.DiGraph, initial: tuple[str, str, float], 
                   rejections: list[dict], warnings: list[str], args: argparse.Namespace) -> dict:
    u, v, w = initial
    levels = calculate_levels(tree, u)
    ordered_edges = sorted(tree.edges(data=True), key=lambda e: (e[2].get("iteration", 0), e[0], e[1]))
    out_json = Path(args.output_json) if args.output_json else Path("data/json") / Path(args.output_csv).with_suffix(".json").name
    canonical_paths = canonical_export_paths(Path(args.output_csv), out_json, Path(args.output_png))

    # CSV
    rows = [{
        "From": o, "To": t, "Weight": fmt_wt(d["weight"]), 
        "Level": 0 if d.get("direction") == "INITIAL" else max(levels[o], levels[t]),
        "Direction": d.get("direction", "FORWARD"), "Method": METHOD_NAME
    } for o, t, d in ordered_edges]
    edges_df = pd.DataFrame(rows)
    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_png).parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    edges_df.to_csv(args.output_csv, index=False, encoding="utf-8")
    edges_df.to_csv(canonical_paths["edges_csv"], index=False, encoding="utf-8")

    # JSON Payload
    validation = validate_polytree_formal(tree, graph)
    is_dag = validation["is_dag"]
    is_undir_tree = validation["undirected_is_tree"]
    orig_w = validation["original_total_weight"]
    sel_w = validation["total_selected_weight"]
    display_label = "Back-and-Forward Poly-tree Formal" if validation["is_valid_polytree"] else INVALID_LABEL

    payload = {
        "algorithm": display_label,
        "display_title": display_label,
        "method": METHOD_NAME,
        "artifact_type": "polytree_formal" if validation["is_valid_polytree"] else "polytree_formal_invalid",
        "initial_edge": {"from": u, "to": v, "weight": w},
        "validation": validation,
        "canonical_exports": {key: str(path) for key, path in canonical_paths.items()},
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(), "selected_edges": tree.number_of_edges(),
            "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": validation["preserved_weight_percentage"],
            "is_acyclic": is_dag, "is_connected": nx.is_weakly_connected(tree),
            "is_polytree": validation["is_valid_polytree"], "is_tree_undirected": is_undir_tree,
            "undirected_is_tree": is_undir_tree,
            "expected_edges": validation["expected_edges"],
            "max_in_degree": validation["max_in_degree"],
            "convergence_nodes": validation["convergence_nodes"],
            "rejected_edges_count": len(rejections),
        },
        "nodes": [{"id": n, "level": levels[n]} for n in sorted(tree.nodes, key=lambda n: (levels[n], n))],
        "edges": [{"from": o, "to": t, "weight": d["weight"], "level": r["Level"], "direction": r["Direction"]} for r, (o, t, d) in zip(rows, ordered_edges)],
        "rejected_edges": rejections, "warnings": warnings,
    }
    
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    canonical_paths["tree_json"].write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    canonical_paths["metrics_json"].write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")

    # DOT
    if args.output_dot:
        lines = ["digraph ramex_polytree_formal {", '  rankdir="LR";'] + [f'  "{n}";' for n in tree.nodes]
        lines.extend(f'  "{o}" -> "{t}" [label="{fmt_wt(d["weight"])} ({d.get("direction", "FORWARD")})", weight="{d["weight"]}"];' for o, t, d in tree.edges(data=True))
        Path(args.output_dot).write_text("\n".join(lines) + "\n}", encoding="utf-8")

    return payload


def render_network_axes(
    ax: Axes,
    tree: nx.DiGraph,
    initial: tuple[str, str, float],
    title: str,
    pos: dict | None = None,
    exploratory: bool = False,
) -> None:
    u, v, _ = initial
    pos = pos or hierarchical_layout(tree, u)
    degrees = dict(tree.to_undirected().degree())
    convergence_nodes = {node for node, degree in tree.in_degree() if int(degree) > 1}

    colors = [
        "#f9a8d4" if n in convergence_nodes else "#f4b183" if n in {u, v} else "#dce9ee"
        for n in tree.nodes
    ]
    max_w = max([d["weight"] for _, _, d in tree.edges(data=True)], default=1)
    small = tree.number_of_nodes() <= 15
    node_sizes = [(5200 if small else 1700) + (900 if small else 420) * degrees.get(n, 0) for n in tree.nodes]
    font_size = 15 if small else 7

    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes, edgecolors="#1f2937", linewidths=1.4, ax=ax)
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold", ax=ax)

    edge_colors = {"INITIAL": "#b45309", "FORWARD": "#2563eb", "BACKWARD": "#7c3aed"}
    for direction, color in edge_colors.items():
        edges = [(o, t) for o, t, d in tree.edges(data=True) if d.get("direction") == direction]
        if edges:
            widths = [1.0 + 5.0 * (tree[o][t]["weight"] / max_w) for o, t in edges]
            nx.draw_networkx_edges(tree, pos, edgelist=edges, width=widths, edge_color=color, 
                                   arrows=True, arrowstyle="-|>", arrowsize=30 if small else 20, alpha=0.86, connectionstyle="arc3,rad=0.04", ax=ax)

    labels = {(o, t): str(fmt_wt(d["weight"])) for o, t, d in tree.edges(data=True)}
    nx.draw_networkx_edge_labels(
        tree, pos, edge_labels=labels, font_size=max(font_size - 1, 6), ax=ax,
        bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
    )
    ax.legend(
        handles=[
            plt.Line2D([0], [0], color=color, lw=3, label=direction)
            for direction, color in edge_colors.items()
        ] + [
            plt.Line2D([0], [0], marker="o", color="w", markerfacecolor="#f9a8d4", markeredgecolor="#1f2937", markersize=12, label="convergência in_degree > 1")
        ],
        loc="upper right",
        frameon=True,
    )
    note = "Visualização exploratória da poly-tree" if exploratory else FORMAL_LEGEND
    ax.text(
        0.01, 0.01, note,
        transform=ax.transAxes,
        fontsize=9,
        color="#334155",
        bbox={"boxstyle": "round,pad=0.35", "fc": "white", "ec": "#cbd5e1", "alpha": 0.92},
    )
    ax.set_title(title, fontsize=13, fontweight="bold")
    ax.axis("off")


def draw_polytree_views(tree: nx.DiGraph, initial: tuple[str, str, float], output_png: Path, canonical_paths: dict[str, str]) -> str | None:
    hierarchical_png = Path(canonical_paths["hierarchical_png"])
    paper_style_png = Path(canonical_paths["paper_style_png"])
    output_paper_style_png = output_png.with_name(output_png.stem + "_paper_style.png")
    neato_png = Path(canonical_paths["neato_optional_png"])

    fig, ax = plt.subplots(figsize=(14, 9))
    render_network_axes(ax, tree, initial, FORMAL_TITLE)
    plt.tight_layout()
    plt.savefig(output_png, dpi=300, bbox_inches="tight")
    plt.savefig(hierarchical_png, dpi=300, bbox_inches="tight")
    plt.savefig(paper_style_png, dpi=300, bbox_inches="tight")
    plt.savefig(output_paper_style_png, dpi=300, bbox_inches="tight")
    plt.close()

    neato_pos = neato_layout_optional(tree)
    if neato_pos is None:
        return None

    fig, ax = plt.subplots(figsize=(14, 9))
    render_network_axes(
        ax,
        tree,
        initial,
        "Visualização exploratória da poly-tree",
        pos=neato_pos,
        exploratory=True,
    )
    plt.tight_layout()
    plt.savefig(neato_png, dpi=300, bbox_inches="tight")
    plt.close()
    return str(neato_png)


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

        if tree.number_of_nodes() < graph.number_of_nodes():
            warnings.append(f"Incluídos {tree.number_of_nodes()} de {graph.number_of_nodes()} nós originais.")

        payload = export_outputs(graph, tree, initial_edge, rejections, warnings, args)

        optional_neato = draw_polytree_views(tree, initial_edge, Path(args.output_png), payload["canonical_exports"])
        if optional_neato:
            payload["canonical_exports"]["neato_optional_png"] = optional_neato
        else:
            payload["canonical_exports"].pop("neato_optional_png", None)
        out_json = Path(args.output_json) if args.output_json else Path("data/json") / Path(args.output_csv).with_suffix(".json").name
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        Path(payload["canonical_exports"]["tree_json"]).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        # Resumo
        m = payload["metrics"]
        print(f"\n{'='*56}\nRAMEX Back-and-Forward Poly-tree Formal\n{'='*56}")
        print(f"Ficheiro lido         : {args.input_edges_csv}")
        if invalid_count: print(f"Aviso                 : ignoradas {invalid_count} arestas inválidas")
        print(f"Nós originais         : {m['original_nodes']}\nArestas originais     : {m['original_edges']}")
        print(f"Arestas seleccionadas : {m['selected_edges']}\nPeso preservado       : {m['preserved_weight_percent']:.2f}%")
        print(f"É poly-tree formal    : {m['is_polytree']}\n")
        print("Ficheiros exportados:")
        for label, path in payload.get("canonical_exports", {}).items():
            print(f"- {label}: {path}")
        
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

