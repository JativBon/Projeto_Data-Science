from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

REQUIRED_COLUMNS = ["From", "To", "Weight"]
METHOD_NAME = "ramex_back_forward_heuristic"


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RAMEX Back-and-Forward Heuristic a partir de um CSV.")
    parser.add_argument("input_edges_csv", help="CSV de entrada (From, To, Weight).")
    parser.add_argument("output_csv", help="CSV de saí­da.")
    parser.add_argument("output_png", help="PNG de saí­da.")
    parser.add_argument("--start-edge", default="auto", help="Aresta inicial: auto ou From->To.")
    parser.add_argument("--max-iterations", type=int, default=1000, help="Número máximo de iterações.")
    parser.add_argument("--output-json", default=None, help="JSON opcional.")
    parser.add_argument("--output-dot", default=None, help="Ficheiro DOT opcional.")
    
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
        raise ValueError(f"Colunas obrigatÃ³rias em falta: {missing}")

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    initial_len = len(df)
    valid_df = df.dropna(subset=REQUIRED_COLUMNS).query("Weight > 0").copy()

    if valid_df.empty:
        raise ValueError("NÃ£o existem arestas vÃ¡lidas com peso positivo.")

    return valid_df.sort_values(by="Weight", ascending=False).reset_index(drop=True), initial_len - len(valid_df)


def build_graph(df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for u, v, w in df[REQUIRED_COLUMNS].itertuples(index=False):
        graph.add_edge(u, v, weight=float(w))
    if not graph.edges:
        raise ValueError("O grafo nÃ£o contÃ©m arestas.")
    return graph


def choose_initial_edge(graph: nx.DiGraph, start_edge: str) -> tuple[str, str, float]:
    if start_edge.strip().lower() == "auto":
        u, v, d = max(graph.edges(data=True), key=lambda e: (e[2]["weight"], -ord(e[0][0]), -ord(e[1][0])))
        return u, v, float(d["weight"])

    sep = "->" if "->" in start_edge else "," if "," in start_edge else None
    if not sep:
        raise ValueError("start-edge invÃ¡lido. Use auto, From->To ou From,To.")

    u, v = [p.strip() for p in start_edge.split(sep, 1)]
    if not graph.has_edge(u, v):
        raise ValueError(f"A aresta inicial indicada não existe: {u} -> {v}")
    
    return u, v, float(graph[u][v]["weight"])


def candidate_edges(graph: nx.DiGraph, included: set[str], selected: set[tuple[str, str]]) -> list[tuple[str, str, float, str]]:
    candidates = []
    for node in included:
        candidates.extend((node, v, d["weight"], "FORWARD") for _, v, d in graph.out_edges(node, data=True) 
                          if v not in included and (node, v) not in selected)
        candidates.extend((u, node, d["weight"], "BACKWARD") for u, _, d in graph.in_edges(node, data=True) 
                          if u not in included and (u, node) not in selected)
    
    return sorted(candidates, key=lambda e: (-e[2], e[3], e[0], e[1]))


def build_back_forward_tree(graph: nx.DiGraph, initial_edge: tuple[str, str, float], max_iters: int) -> nx.DiGraph:
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

    if not tree.edges:
        raise ValueError("Não foi possível construir a poly-tree Back-and-Forward.")
    return tree


def calculate_levels(tree: nx.DiGraph, initial_from: str) -> dict[str, int]:
    levels = nx.single_source_shortest_path_length(tree.to_undirected(), initial_from)
    return {node: levels.get(node, 0) for node in tree.nodes}


def fmt_wt(w: float) -> int | float:
    return int(w) if w.is_integer() else round(w, 4)


def dataset_label_from_path(path: Path) -> str:
    for part in path.stem.replace("-", "_").split("_"):
        if part.lower().startswith("dataset"):
            return part
    return path.stem


def hierarchical_layout(graph: nx.DiGraph, root: str) -> dict:
    n = graph.number_of_nodes()
    nodesep = max(0.6, min(2.0, 60 / max(n, 1)))
    ranksep = max(1.0, min(3.5, 80 / max(n, 1)))
    # Para poly-trees com arestas bidirecionais, 'dot' pode criar layouts desequilibrados.
    # Usamos 'neato' como primeira opção para Back-and-Forward.
    for prog, args in [
        ("neato", f"-Gnodesep={nodesep:.2f}"),
        ("dot",   f"-Grankdir=TB -Gnodesep={nodesep:.2f} -Granksep={ranksep:.2f}"),
        ("fdp",   ""),
    ]:
        try:
            return nx.nx_agraph.graphviz_layout(graph, prog=prog, args=args)
        except Exception:
            pass
    # Fallback manual com BFS
    levels = calculate_levels(graph, root) if root in graph else {}
    for node in graph.nodes:
        levels.setdefault(node, 0)
    grouped: dict[int, list[str]] = {}
    for node, lvl in levels.items():
        grouped.setdefault(lvl, []).append(node)
    max_lvl = max(grouped.keys(), default=0)
    pos: dict[str, tuple[float, float]] = {}
    for lvl, nodes in grouped.items():
        nodes_sorted = sorted(nodes, key=str)
        count = len(nodes_sorted)
        for i, node in enumerate(nodes_sorted):
            x = (i - (count - 1) / 2) * max(1.5, 8 / max(count, 1))
            y = -(lvl / max(max_lvl, 1)) * 10
            pos[node] = (x, y)
    return pos


def export_outputs(graph: nx.DiGraph, tree: nx.DiGraph, initial: tuple[str, str, float], warnings: list[str], args: argparse.Namespace) -> dict:
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
    is_connected = nx.is_weakly_connected(tree) if tree.nodes else False
    is_polytree = is_dag and nx.is_tree(tree.to_undirected())

    payload = {
        "algorithm": "RAMEX Back-and-Forward Heuristic",
        "initial_edge": {"from": u, "to": v, "weight": w},
        "metrics": {
            "original_nodes": graph.number_of_nodes(), "original_edges": graph.number_of_edges(),
            "selected_nodes": tree.number_of_nodes(), "selected_edges": tree.number_of_edges(),
            "original_weight_sum": orig_w, "selected_weight_sum": sel_w,
            "preserved_weight_percent": (sel_w / orig_w * 100) if orig_w else 0,
            "is_acyclic": is_dag,
            "is_connected": is_connected,
            "is_polytree": is_polytree,
        },
        "nodes": [{"id": n, "level": levels[n]} for n in sorted(tree.nodes, key=lambda n: (levels[n], n))],
        "edges": [{"from": o, "to": t, "weight": d["weight"], "level": r["Level"], "direction": r["Direction"]} for r, (o, t, d) in zip(rows, ordered_edges)],
        "warnings": warnings,
    }

    out_json = Path(args.output_json) if args.output_json else Path("data/json") / Path(args.output_csv).with_suffix(".json").name
    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_png).parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # DOT
    if args.output_dot:
        lines = ["digraph ramex_back_forward {", '  rankdir="LR";'] + [f'  "{n}";' for n in tree.nodes]
        lines.extend(f'  "{o}" -> "{t}" [label="{fmt_wt(d["weight"])} ({d.get("direction", "FORWARD")})", weight="{d["weight"]}"];' for o, t, d in tree.edges(data=True))
        Path(args.output_dot).write_text("\n".join(lines) + "\n}", encoding="utf-8")

    return payload


def draw_tree(tree: nx.DiGraph, initial: tuple[str, str, float], output_png: Path) -> None:
    u, v, _ = initial
    n = tree.number_of_nodes()
    pos = hierarchical_layout(tree, u)
    degrees = dict(tree.to_undirected().degree())

    # Dimensões escaladas com o número de nós
    if n <= 15:
        figsize, dpi, font_size, node_base, node_scale, arrowsize = (16, 12), 300, 12, 2200, 800, 22
    elif n <= 50:
        figsize, dpi, font_size, node_base, node_scale, arrowsize = (22, 16), 250, 9, 1300, 500, 18
    elif n <= 120:
        figsize, dpi, font_size, node_base, node_scale, arrowsize = (28, 20), 200, 7, 850, 280, 14
    else:
        figsize, dpi, font_size, node_base, node_scale, arrowsize = (36, 26), 180, 6, 550, 180, 10

    colors = ["#f4b183" if nd in {u, v} else "#dceef5" for nd in tree.nodes]
    max_w = max((d["weight"] for _, _, d in tree.edges(data=True)), default=1) or 1
    node_sizes = [node_base + node_scale * degrees.get(nd, 0) for nd in tree.nodes]

    plt.figure(figsize=figsize)
    nx.draw_networkx_nodes(tree, pos, node_color=colors, node_size=node_sizes,
                           edgecolors="#315f72", linewidths=1.6)
    nx.draw_networkx_labels(tree, pos, font_size=font_size, font_weight="bold",
                            font_color="#0f172a")

    edge_colors = {"INITIAL": "#b45309", "FORWARD": "#2563eb", "BACKWARD": "#7c3aed"}
    legend_handles = []
    for direction, color in edge_colors.items():
        edges = [(o, t) for o, t, d in tree.edges(data=True) if d.get("direction") == direction]
        if edges:
            widths = [0.8 + 3.5 * (tree[o][t]["weight"] / max_w) for o, t in edges]
            nx.draw_networkx_edges(
                tree, pos, edgelist=edges, width=widths, edge_color=color,
                arrows=True, arrowstyle="-|>", arrowsize=arrowsize, alpha=0.82,
                connectionstyle="arc3,rad=0.04",
            )
            legend_handles.append(plt.Line2D([0], [0], color=color, lw=3, label=direction))

    # Labels nas arestas só para grafos pequenos
    if n <= 60:
        labels = {(o, t): str(fmt_wt(d["weight"])) for o, t, d in tree.edges(data=True)}
        nx.draw_networkx_edge_labels(
            tree, pos, edge_labels=labels, font_size=max(font_size - 2, 5),
            bbox={"boxstyle": "round,pad=0.18", "fc": "white", "ec": "#cbd5e1", "alpha": 0.85},
        )

    if legend_handles:
        plt.legend(handles=legend_handles, loc="upper right", frameon=True, fontsize=10)
    plt.title(f"RAMEX Back-and-Forward Poly-tree Formal - {dataset_label_from_path(output_png)}",
              fontsize=14, fontweight="bold", pad=10)
    plt.axis("off")
    plt.tight_layout(pad=1.5)
    plt.savefig(output_png, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close()

def main() -> None:
    args = parse_arguments()
    warnings = []

    try:
        edges_df, invalid_count = load_edges(args.input_edges_csv)
        graph = build_graph(edges_df)
        initial_edge = choose_initial_edge(graph, args.start_edge)
        tree = build_back_forward_tree(graph, initial_edge, args.max_iterations)

        if not nx.is_directed_acyclic_graph(tree):
            raise ValueError("O output contém ciclos.")
        if not nx.is_weakly_connected(tree):
            raise ValueError("A estrutura final não está conetada.")
        if not nx.is_tree(tree.to_undirected()):
            raise ValueError("A estrutura final não satisfaz a condição de poly-tree (grafo não dirigido não é árvore).")

        if tree.number_of_nodes() < graph.number_of_nodes():
            warnings.append(f"IncluÃ­dos {tree.number_of_nodes()} de {graph.number_of_nodes()} nÃ³s originais.")

        payload = export_outputs(graph, tree, initial_edge, warnings, args)
        draw_tree(tree, initial_edge, Path(args.output_png))

        m = payload["metrics"]
        print(f"Ficheiro lido: {args.input_edges_csv}")
        if invalid_count: print(f"Aviso: {invalid_count} arestas inválidas ignoradas.")
        print(f"Nós originais: {m['original_nodes']} | Arestas originais: {m['original_edges']}")
        print(f"Arestas selecionadas: {m['selected_edges']}")
        print(f"Peso preservado: {m['preserved_weight_percent']:.2f}%")
        print(f"Poly-tree válida: {m['is_polytree']}")

        if warnings:
            print("\nAvisos:\n" + "\n".join(f"- {w}" for w in warnings))

    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()

