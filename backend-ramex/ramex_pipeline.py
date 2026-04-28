from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import Counter, deque
from itertools import groupby
from pathlib import Path
from typing import Any, Callable

os.environ.setdefault("MPLCONFIGDIR", str(Path.cwd() / ".matplotlib-cache"))

import matplotlib  # type: ignore
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # type: ignore
import networkx as nx  # type: ignore
import pandas as pd  # type: ignore

from ramex_forum_pipeline import run_ramex_forum

ALLOWED_EXTENSIONS = {".txt", ".csv", ".xlsx"}

ProgressCallback = Callable[[str, str], None]
LogCallback = Callable[[str], None]


def safe_filename(filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", Path(filename).name) or "dataset"


def read_table(file_path: Path, nrows: int | None = None) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(file_path, nrows=nrows)
    if ext == ".xlsx":
        return pd.read_excel(file_path, nrows=nrows)
    raise ValueError("Este tipo de dataset requer ficheiro CSV ou XLSX.")


def detect_columns(file_path: Path) -> list[str]:
    if file_path.suffix.lower() not in {".csv", ".xlsx"}:
        return []
    return list(read_table(file_path, nrows=0).columns)


def as_str(value: Any) -> str:
    return "" if value is None else str(value)


def as_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_text_value(value: Any) -> str | None:
    try:
        if bool(pd.isna(value)):
            return None
    except Exception:
        pass
    if value is None:
        return None
    text = as_str(value).strip()
    return None if text.lower() in {"", "nan", "nat"} else text


def load_simple_sequences(file_path: Path) -> list[list[str]]:
    if file_path.suffix.lower() not in {".txt", ".csv"}:
        raise ValueError("Sequências simples devem usar ficheiro TXT ou CSV.")

    sequences = [
        [t.strip() for t in line.split("," if "," in line else None) if t.strip()]
        for line in file_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("Não foram encontradas sequências válidas com tamanho mínimo 2.")
    return valid


def load_event_table_sequences(file_path: Path, case_col: str, time_col: str, event_col: str) -> list[list[str]]:
    df = read_table(file_path)
    if missing := [c for c in [case_col, time_col, event_col] if c not in df.columns]:
        raise ValueError(f"Colunas obrigatórias ausentes: {missing}")

    df = df[[case_col, time_col, event_col]].copy()
    df[event_col] = df[event_col].apply(normalize_text_value)
    df[case_col] = df[case_col].apply(normalize_text_value)
    df = df.dropna(subset=[case_col, event_col])  # type: ignore[call-overload]

    if df.empty:
        raise ValueError("Não existem eventos válidos após limpeza.")

    is_date = pd.api.types.is_datetime64_any_dtype(df[time_col]) or any(
        t in time_col.lower() for t in ["date", "data", "time", "tempo"]
    )
    df["_order"] = (
        pd.to_datetime(df[time_col], errors="coerce")
        if is_date
        else pd.to_numeric(df[time_col], errors="coerce")
    )

    if df["_order"].notna().mean() < 0.8:
        raise ValueError(f"A coluna '{time_col}' contém demasiados valores inválidos para o formato esperado.")

    df = df.dropna(subset=["_order"]).sort_values(by=[case_col, "_order"], kind="stable")

    sequences = [
        [str(e) for e in seq if normalize_text_value(e)]
        for seq in df.groupby(case_col, sort=False)[event_col].apply(list)
    ]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("Não foram geradas sequências com tamanho mínimo 2.")
    return valid


def normalize_dataset(
    file_path: Path,
    ds_type: str,
    case_col: str | None,
    time_col: str | None,
    event_col: str | None,
) -> list[list[str]]:
    if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Extensão inválida. Use .txt, .csv ou .xlsx.")
    if file_path.stat().st_size == 0:
        raise ValueError("O ficheiro está vazio.")

    if ds_type == "simple_sequences":
        sequences = load_simple_sequences(file_path)
    elif ds_type == "event_table":
        if case_col is None or time_col is None or event_col is None:
            raise ValueError("Mapeamento de colunas incompleto para tabela de eventos.")
        sequences = load_event_table_sequences(file_path, case_col, time_col, event_col)
    elif ds_type == "customer_excel":
        sequences = load_event_table_sequences(
            file_path,
            case_col or "Customer ID",
            time_col or "Order Date",
            event_col or "Category",
        )
    else:
        raise ValueError("Tipo de dataset desconhecido.")

    sequences = [[k for k, _ in groupby(seq)] for seq in sequences]
    valid = [seq for seq in sequences if len(seq) >= 2]
    if not valid:
        raise ValueError("Todas as sequências foram descartadas por terem tamanho inferior a 2.")
    return valid


def build_pair_frequencies(sequences: list[list[str]]) -> pd.DataFrame:
    pairs = [(a, b) for seq in sequences for a, b in zip(seq, seq[1:])]
    df = pd.DataFrame([{"From": u, "To": v, "Weight": w} for (u, v), w in Counter(pairs).items()])
    return df.sort_values(by="Weight", ascending=False, kind="stable").reset_index(drop=True)


def build_adjacency_matrix(edges_df: pd.DataFrame) -> pd.DataFrame:
    nodes = sorted(set(edges_df["From"]) | set(edges_df["To"]))
    matrix = pd.DataFrame(0, index=nodes, columns=nodes, dtype=int)
    for row in edges_df.to_dict(orient="records"):
        matrix.at[as_str(row.get("From")), as_str(row.get("To"))] = as_int(row.get("Weight"))
    return matrix


def filter_edges(edges_df: pd.DataFrame, min_freq: float | None, top_n: int | None) -> pd.DataFrame:
    df = edges_df.copy()
    if min_freq and min_freq > 0:
        df = df[df["Weight"] >= min_freq]
    df = df.sort_values(by="Weight", ascending=False, kind="stable")  # type: ignore[call-overload]
    if top_n and top_n > 0:
        df = df.head(top_n)
    return df.reset_index(drop=True)  # type: ignore[return-value]


def build_graph(edges_df: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    graph.add_weighted_edges_from(edges_df[["From", "To", "Weight"]].itertuples(index=False))
    return graph


def calculate_centrality(graph: nx.DiGraph) -> dict[str, float]:
    try:
        cent = nx.pagerank(graph, weight="weight")
    except Exception:
        cent = nx.degree_centrality(graph)

    if not cent:
        return {str(n): 0.0 for n in graph.nodes}
    max_c = max(cent.values()) or 1.0
    return {str(n): float(v) / max_c for n, v in cent.items()}


def choose_root(graph: nx.DiGraph, centrality: dict[str, float] | None = None) -> str:
    for node in graph.nodes:
        if str(node).upper() == "START":
            return str(node)

    cent = centrality or {}
    cands = [
        (str(n), sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), cent.get(str(n), 0.0), graph.out_degree(n))
        for n in graph.nodes
    ]
    return min(cands, key=lambda x: (-x[1], -x[2], -x[3], x[0]))[0]


def build_ramex_simplified(graph: nx.DiGraph) -> tuple[nx.DiGraph, pd.DataFrame, str]:
    if not graph.edges:
        raise ValueError("Não existem arestas para construir RAMEX simplificado.")

    root = choose_root(graph)
    tree = nx.DiGraph()
    tree.add_node(root)
    visited, levels, selected = {root}, {root: 0}, []

    while True:
        cands = [(u, v, d["weight"]) for u in visited for _, v, d in graph.out_edges(u, data=True) if v not in visited]
        if not cands:
            break

        u, v, w = min(cands, key=lambda e: (-e[2], str(e[0]), str(e[1])))
        tree.add_edge(u, v, weight=w)

        if not nx.is_directed_acyclic_graph(tree):
            tree.remove_edge(u, v)
            visited.add(v)
            continue

        visited.add(v)
        levels[v] = levels[u] + 1
        selected.append({"From": u, "To": v, "Weight": w, "Level": levels[v]})

    if not selected:
        raise ValueError("Não foi possível selecionar arestas para a estrutura RAMEX.")
    return tree, pd.DataFrame(selected), root


def build_ramex_polytree(
    graph: nx.DiGraph, root: str, top_k: int = 2, max_depth: int = 5, min_weight: float | None = None
) -> tuple[nx.DiGraph, pd.DataFrame]:
    queue, selected, seen = deque([(root, 0, [root])]), [], set()

    while queue:
        curr, lvl, path = queue.popleft()
        if lvl >= max_depth:
            continue

        out_edges = [
            (str(curr), str(v), d["weight"])
            for _, v, d in graph.out_edges(curr, data=True)
            if v not in path and (min_weight is None or d["weight"] >= min_weight)
        ]
        out_edges.sort(key=lambda e: (-e[2], e[1]))

        for u, v, w in out_edges[:top_k]:
            parent_path = " -> ".join(path)
            if (u, v, parent_path) in seen:
                continue
            seen.add((u, v, parent_path))
            selected.append({
                "From": u, "To": v, "Weight": w, "Level": lvl + 1,
                "ParentPath": parent_path, "Strategy": "top-k",
                "Score": "", "Reason": "Selecionada via top-K de peso na origem",
            })
            queue.append((v, lvl + 1, path + [v]))

    if not selected:
        raise ValueError("Não foi possível selecionar arestas para a Poly-tree.")

    df = pd.DataFrame(selected)
    tree = nx.DiGraph()
    for r in df.itertuples(index=False):
        if tree.has_edge(r.From, r.To):
            tree[r.From][r.To]["weight"] = max(tree[r.From][r.To]["weight"], r.Weight)
            tree[r.From][r.To]["occurrences"] += 1
        else:
            tree.add_edge(r.From, r.To, weight=r.Weight, occurrences=1)

    return tree, df


def explain_multiobjective(nw: float, tp: float, cg: float, tc: float, rp: float) -> str:
    if nw >= 0.7 and tp >= 0.5:
        return "alto peso e elevada probabilidade local"
    if cg >= 0.05:
        return "boa cobertura global"
    if tc >= 0.65:
        return "destino central no grafo"
    if rp > 0 and nw >= 0.35:
        return "penalizada por redundância, mas mantida por peso elevado"
    return "selecionada por equilíbrio entre peso, cobertura e centralidade"


def build_ramex_polytree_multiobjective(graph: nx.DiGraph, root: str, **kw) -> tuple[nx.DiGraph, pd.DataFrame]:
    orig_sum = sum(d["weight"] for _, _, d in graph.edges(data=True))
    if orig_sum <= 0:
        raise ValueError("O grafo não contém peso suficiente para construir a Poly-tree.")

    max_w = max((d["weight"] for _, _, d in graph.edges(data=True)), default=1.0) or 1.0
    out_w = {str(n): sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)) for n in graph.nodes}
    cent = calculate_centrality(graph)

    frontier, selected, seen = [(root, [root])], [], set()
    rep_nodes, sel_from = {root: 1}, {}
    pres_sum = 0.0

    for lvl in range(kw["max_depth"]):
        if not frontier or pres_sum / orig_sum >= kw["preserve_weight_target"]:
            break

        cands = []
        for curr, path in frontier:
            for _, tgt, d in graph.out_edges(curr, data=True):
                u, v, w = str(curr), str(tgt), float(d["weight"])
                if (kw["min_weight"] and w < kw["min_weight"]) or v in path or sel_from.get(u, 0) >= kw["max_branching"]:
                    continue

                nw = w / max_w
                tp = w / out_w.get(u, w) if out_w.get(u, 0) else 0
                cg = w / orig_sum if (u, v) not in seen else 0.0
                tc = cent.get(v, 0.0)
                rp = rep_nodes.get(v, 0) / max(1, len(selected))
                cp = min(1.0, ((lvl + 1) / max(1, kw["max_depth"])) + (sel_from.get(u, 0) / max(1, kw["max_branching"])))

                score = kw["alpha"]*nw + kw["beta"]*tp + kw["gamma"]*cg + kw["delta"]*tc - kw["epsilon"]*rp - kw["zeta"]*cp
                if score >= kw["min_score"]:
                    cands.append({
                        "source": u, "target": v, "weight": w, "score": score,
                        "parent_path": " -> ".join(path), "path": path + [v],
                        "reason": explain_multiobjective(nw, tp, cg, tc, rp),
                    })

        cands.sort(key=lambda x: (-x["score"], -x["weight"], x["target"]))
        next_frontier, sel_lvl = [], 0

        for c in cands:
            if sel_lvl >= kw["max_branching"]:
                break
            if sel_from.get(c["source"], 0) >= kw["max_branching"]:
                continue

            selected.append({
                "From": c["source"], "To": c["target"], "Weight": c["weight"],
                "Level": lvl + 1, "ParentPath": c["parent_path"],
                "Strategy": "multiobjective", "Score": round(c["score"], 6), "Reason": c["reason"],
            })
            sel_lvl += 1
            sel_from[c["source"]] = sel_from.get(c["source"], 0) + 1
            if (c["source"], c["target"]) not in seen:
                seen.add((c["source"], c["target"]))
                pres_sum += c["weight"]
            rep_nodes[c["target"]] = rep_nodes.get(c["target"], 0) + 1
            next_frontier.append((c["target"], c["path"]))
            if pres_sum / orig_sum >= kw["preserve_weight_target"]:
                break

        frontier = next_frontier

    if not selected:
        raise ValueError("Não foi possível selecionar arestas multiobjetivo.")

    df = pd.DataFrame(selected)
    numeric_scores: pd.Series = pd.to_numeric(df["Score"], errors="coerce")  # type: ignore[assignment]
    if df.empty or bool(numeric_scores.isna().any()):
        raise ValueError("Estratégia multiobjetivo falhou: scores inválidos.")

    tree = nx.DiGraph()
    for r in df.itertuples(index=False):
        if tree.has_edge(r.From, r.To):
            tree[r.From][r.To]["weight"] = max(tree[r.From][r.To]["weight"], r.Weight)
            tree[r.From][r.To]["occurrences"] += 1
        else:
            tree.add_edge(r.From, r.To, weight=r.Weight, occurrences=1)

    return tree, df


def draw_graph(graph: nx.DiGraph, output_png: Path, root: str | None = None) -> None:
    if not graph.edges:
        return

    from matplotlib.patches import FancyArrowPatch  # type: ignore
    from matplotlib.patheffects import withStroke  # type: ignore

    n = graph.number_of_nodes()
    is_small = n <= 10

    if is_small:
        pos = nx.circular_layout(graph, scale=1.2)
        figsize = (16, 14)
    else:
        try:
            pos = nx.nx_agraph.graphviz_layout(graph, prog="dot") if root else nx.spring_layout(graph, seed=42, k=2, iterations=50)
        except Exception:
            pos = nx.spring_layout(graph, seed=42, k=2, iterations=50)
        figsize = (14, 10)

    fig, ax = plt.subplots(figsize=figsize, dpi=100)
    edges_list = list(graph.edges(data=True))
    max_w = max([d["weight"] for _, _, d in edges_list], default=1)
    curve_radius = 0.35 if is_small else 0.18

    bidirectional = set()
    for u, v, _ in edges_list:
        if graph.has_edge(v, u) and (v, u) not in bidirectional and (u, v) not in bidirectional:
            bidirectional.add((u, v))

    for u, v, data in edges_list:
        x1, y1 = pos[u]
        x2, y2 = pos[v]
        weight = float(data.get("weight", 1))
        width = 0.8 + (4.2 if is_small else 3.2) * (weight / max_w)

        if (u, v) in bidirectional:
            connectionstyle = f"arc3,rad={curve_radius}"
        elif (v, u) in bidirectional:
            connectionstyle = f"arc3,rad={-curve_radius}"
        else:
            connectionstyle = "arc3,rad=0"

        ax.add_patch(FancyArrowPatch(
            (x1, y1), (x2, y2),
            connectionstyle=connectionstyle,
            arrowstyle="-|>",
            mutation_scale=24 if is_small else 15,
            linewidth=width,
            color="#315f72",
            alpha=0.75,
            zorder=1,
        ))

    colors = ["#f9cb9c" if root and node == root else "#e8f4f8" for node in graph.nodes]
    nx.draw_networkx_nodes(
        graph, pos,
        node_size=3600 if is_small else 900,
        node_color=colors,
        edgecolors="#315f72",
        linewidths=2.5 if is_small else 1.5,
        ax=ax,
    )
    nx.draw_networkx_labels(graph, pos, font_size=13 if is_small else 8, font_weight="bold", ax=ax)

    edge_labels = {
        (u, v): int(w) if float(w).is_integer() else round(w, 2)
        for u, v, d in edges_list
        for w in [float(d.get("weight", 1))]
    }

    if is_small:
        for (u, v), label in edge_labels.items():
            x = (pos[u][0] + pos[v][0]) / 2
            y = (pos[u][1] + pos[v][1]) / 2
            text = ax.text(
                x, y, str(label), fontsize=9, ha="center", va="center",
                fontweight="bold", color="#315f72",
                bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor="none", alpha=0.85),
            )
            text.set_path_effects([withStroke(linewidth=2, foreground="white")])  # type: ignore[arg-type]
    else:
        nx.draw_networkx_edge_labels(graph, pos, edge_labels=edge_labels, font_size=8, ax=ax)

    ax.margins(0.15 if is_small else 0.1)
    ax.axis("off")
    plt.tight_layout(pad=2.0 if is_small else 1.0)
    plt.savefig(output_png, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close()


def matrix_to_json(df: pd.DataFrame, limit: int = 40) -> dict[str, Any]:
    lim = df.iloc[:limit, :limit]
    return {
        "columns": [""] + [str(c) for c in lim.columns],
        "rows": [{"": str(i), **{str(c): int(v) for c, v in row.items()}} for i, row in lim.iterrows()],
        "total_rows": df.shape[0],
        "total_columns": df.shape[1],
        "is_truncated": df.shape[0] > limit or df.shape[1] > limit,
    }


def edges_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    return [{str(k): v for k, v in rec.items()} for rec in records]


def calculate_metrics(g_orig: nx.DiGraph, g_poly: nx.DiGraph, df_poly: pd.DataFrame) -> dict[str, Any]:
    w_orig = sum(d["weight"] for _, _, d in g_orig.edges(data=True))
    w_poly = sum(d["weight"] for _, _, d in g_poly.edges(data=True))
    branching = df_poly.groupby("From")["To"].count() if not df_poly.empty else pd.Series(dtype=float)

    return {
        "original_nodes": g_orig.number_of_nodes(),
        "original_edges": g_orig.number_of_edges(),
        "polytree_nodes": g_poly.number_of_nodes(),
        "polytree_edges": len(df_poly),
        "original_weight_sum": w_orig,
        "polytree_weight_sum": w_poly,
        "preserved_weight_percent": (w_poly / w_orig * 100) if w_orig > 0 else 0,
        "max_depth": int(df_poly["Level"].max()) if not df_poly.empty else 0,
        "average_branching": float(branching.mean()) if not branching.empty else 0.0,
        "repeated_nodes": int(df_poly["To"].duplicated().sum()) if "To" in df_poly else 0,
        "density_before": nx.density(g_orig) if g_orig.number_of_nodes() > 1 else 0,
        "density_after": nx.density(g_poly) if g_poly.number_of_nodes() > 1 else 0,
        "edge_reduction_percent": (1 - g_poly.number_of_edges() / max(1, g_orig.number_of_edges())) * 100,
        "coverage_by_level": {str(l): float(g["Weight"].sum()) for l, g in df_poly.groupby("Level")} if not df_poly.empty else {},
    }


def polytree_to_json(g_orig: nx.DiGraph, g_poly: nx.DiGraph, df_poly: pd.DataFrame, root: str, strat: str, params: dict) -> dict:
    metrics = calculate_metrics(g_orig, g_poly, df_poly)
    levels = {root: 0}
    for row in df_poly.sort_values("Level", kind="stable").to_dict(orient="records"):
        src, dst = as_str(row.get("From")), as_str(row.get("To"))
        level = max(as_int(row.get("Level")), 0)
        prev_level = max(level - 1, 0)
        levels[src] = min(levels.get(src, prev_level), prev_level)
        levels[dst] = min(levels.get(dst, level), level)

    return {
        "root": root,
        "strategy": strat,
        "metrics": metrics | {"strategy": strat},
        "parameters": params,
        "nodes": [{"id": n, "level": l} for n, l in sorted(levels.items(), key=lambda x: (x[1], x[0]))],
        "edges": edges_to_records(df_poly),
        "scoring_formula": "score = alpha*nw + beta*tp + gamma*cg + delta*tc - epsilon*rp - zeta*cp" if strat == "multiobjective" else "top-k",
    }


def interpret(metrics: dict) -> str:
    nodes, edges, dens, pres = metrics["nodes"], metrics["edges"], metrics["density"], metrics["preserved_percentage"]
    avg_w = metrics["total_weight"] / edges if edges else 0

    if nodes <= 10 and avg_w >= 5:
        headline = "O dataset apresenta padrões sequenciais fortes e recorrentes."
    elif nodes >= 100 and dens >= 0.2:
        headline = "Grafo denso, requer filtragem para melhorar a leitura."
    elif nodes >= 50 and avg_w <= 1.5:
        headline = "Transições muito únicas, limitando a extração global."
    else:
        headline = "O dataset apresenta estrutura intermédia."

    return " ".join([
        headline,
        "O desempenho do RAMEX é diretamente condicionado pela estrutura do grafo, nomeadamente pela densidade, repetição de transições e presença de caminhos dominantes.",
        f"A percentagem de peso preservado reflete diretamente a capacidade do RAMEX em identificar padrões dominantes no conjunto de dados ({pres:.2f}%).",
    ])


def script_path(name: str) -> Path:
    return Path(__file__).resolve().parents[1] / name


def run_python_script(args: list[str]) -> None:
    result = subprocess.run([sys.executable, *args], capture_output=True, text=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "erro sem detalhe"
        raise ValueError(f"Falha ao executar {Path(args[0]).name}: {detail}")


def choose_max_out_weight_root(edges_df: pd.DataFrame) -> str:
    grouped = edges_df.groupby("From")["Weight"].sum().sort_values(ascending=False)
    if grouped.empty:
        raise ValueError("Não foi possível escolher raiz por peso de saída.")
    return str(grouped.index[0])


def pure_anchor(payload: dict[str, Any]) -> str:
    if root := payload.get("root"):
        return str(root)
    initial = payload.get("initial_edge") or {}
    if initial:
        return f"{initial.get('from')} -> {initial.get('to')}"
    return "Sem dados gerados"


def pure_validation_rows(ramex2007: dict[str, Any], forward: dict[str, Any], back_forward: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for label, payload in [
        ("RAMEX 2007 Rooted Branching", ramex2007),
        ("RAMEX Forward Heuristic", forward),
        ("RAMEX Back-and-Forward Poly-tree Formal", back_forward),
    ]:
        m = payload.get("metrics", {})
        rows.append({
            "Algoritmo": label,
            "Metodo": payload.get("method", payload.get("algorithm")),
            "Nos selecionados": m.get("selected_nodes"),
            "Arestas selecionadas": m.get("selected_edges"),
            "Soma pesos selecionados": m.get("selected_weight_sum"),
            "Peso preservado (%)": m.get("preserved_weight_percent"),
            "Aciclico": m.get("is_acyclic") if "is_acyclic" in m else m.get("is_dag"),
            "Conectado": m.get("is_connected"),
            "Raiz ou aresta inicial": pure_anchor(payload),
        })
    return rows


def structural_type(nodes: int, density: float, ramex2007_preserved: float) -> str:
    if nodes <= 10 and density >= 0.7:
        return "grafo pequeno e completo"
    if density >= 0.7:
        return "grafo denso"
    if density <= 0.05 and ramex2007_preserved >= 80:
        return "grafo quase linear"
    return "grafo sequencial intermédio"


def run_pure_ramex_outputs(
    output_dir: Path,
    job_id: str,
    graph_edges_csv: Path,
    graph_edges_df: pd.DataFrame,
    metrics: dict[str, Any],
    progress_cb: ProgressCallback | None = None,
    log_cb: LogCallback | None = None,
) -> dict[str, Any]:
    files = {
        "ramex2007_csv": f"ramex2007_{job_id}.csv",
        "ramex2007_json": f"ramex2007_{job_id}.json",
        "ramex2007_png": f"ramex2007_{job_id}.png",
        "forward_csv": f"ramex_forward_{job_id}.csv",
        "forward_json": f"ramex_forward_{job_id}.json",
        "forward_png": f"ramex_forward_{job_id}.png",
        "back_forward_formal_csv": f"ramex_back_forward_formal_{job_id}.csv",
        "back_forward_formal_json": f"ramex_back_forward_formal_{job_id}.json",
        "back_forward_formal_png": f"ramex_back_forward_formal_{job_id}.png",
        "validation_pure_csv": f"validacao_ramex_puro_{job_id}.csv",
        "validation_pure_json": f"validacao_ramex_puro_{job_id}.json",
        "validation_pure_md": f"validacao_ramex_puro_{job_id}.md",
    }

    if progress_cb:
        progress_cb("ramex2007", "Execução RAMEX 2007 Rooted Branching")
    run_python_script([
        str(script_path("10A_ramex_2007_rooted_branching.py")),
        str(graph_edges_csv), str(output_dir / files["ramex2007_csv"]),
        str(output_dir / files["ramex2007_png"]),
        "--input-type", "edges", "--output-json", str(output_dir / files["ramex2007_json"]),
    ])
    ramex2007 = json.loads((output_dir / files["ramex2007_json"]).read_text(encoding="utf-8"))
    if log_cb and (selected_edges := ramex2007.get("metrics", {}).get("selected_edges")) is not None:
        log_cb(f"RAMEX 2007 concluído: {selected_edges} arestas selecionadas")

    graph_nodes = set(graph_edges_df["From"].astype(str)) | set(graph_edges_df["To"].astype(str))
    root_10a = str(ramex2007.get("root", ""))
    if root_10a in graph_nodes:
        forward_root, root_method = root_10a, "from_10A"
    else:
        forward_root, root_method = choose_max_out_weight_root(graph_edges_df), "max_out_weight_fallback"

    if progress_cb:
        progress_cb("forward", "Execução RAMEX Forward")
    run_python_script([
        str(script_path("10B_ramex_forward_heuristic.py")),
        str(graph_edges_csv), str(output_dir / files["forward_csv"]),
        str(output_dir / files["forward_png"]),
        "--root", forward_root, "--output-json", str(output_dir / files["forward_json"]),
    ])
    forward = json.loads((output_dir / files["forward_json"]).read_text(encoding="utf-8"))
    forward["root_selection_method"] = root_method
    (output_dir / files["forward_json"]).write_text(json.dumps(forward, ensure_ascii=False, indent=2), encoding="utf-8")

    if progress_cb:
        progress_cb("polytree_formal", "Execução Back-and-Forward Poly-tree Formal")
    run_python_script([
        str(script_path("10C_ramex_back_forward_polytree_formal.py")),
        str(graph_edges_csv), str(output_dir / files["back_forward_formal_csv"]),
        str(output_dir / files["back_forward_formal_png"]),
        "--output-json", str(output_dir / files["back_forward_formal_json"]),
    ])
    back_forward = json.loads((output_dir / files["back_forward_formal_json"]).read_text(encoding="utf-8"))

    if progress_cb:
        progress_cb("validacao", "Validação comparativa RAMEX puro")
    rows = pure_validation_rows(ramex2007, forward, back_forward)
    best = max(rows, key=lambda row: row.get("Peso preservado (%)") or 0)
    stype = structural_type(metrics["nodes"], metrics["density"], ramex2007.get("metrics", {}).get("preserved_weight_percent", 0))
    summary = f"Os resultados RAMEX puro foram gerados para este job. O melhor método por peso preservado foi {best['Algoritmo']} ({best.get('Peso preservado (%)', 0):.2f}%). Tipo estrutural: {stype}."
    validation = {"dataset": job_id, "best_algorithm": best["Algoritmo"], "structural_type": stype, "rows": rows, "summary": summary}

    pd.DataFrame(rows).to_csv(output_dir / files["validation_pure_csv"], index=False, encoding="utf-8")
    (output_dir / files["validation_pure_json"]).write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / files["validation_pure_md"]).write_text("# Validação RAMEX Puro\n\n" + summary + "\n", encoding="utf-8")

    return {
        "files": files, "ramex2007": ramex2007, "forward": forward,
        "backForward": back_forward, "comparisonRows": rows,
        "comparisonMarkdown": "# Validação RAMEX Puro\n\n" + summary,
        "multidatasetMarkdown": "", "missing": [], "validation": validation,
    }


def validate_pure_outputs(pure: dict[str, Any] | None) -> None:
    if not pure:
        raise ValueError("Output RAMEX Puro incompleto: resultados puros não foram gerados.")
    required = {
        "ramex2007": "ficheiro ramex2007 JSON não encontrado",
        "forward": "ficheiro forward JSON não encontrado",
        "backForward": "ficheiro back_forward_formal JSON não encontrado",
        "validation": "ficheiro validacao_ramex_puro JSON não encontrado",
    }
    for key, message in required.items():
        if not pure.get(key):
            raise ValueError(f"Output RAMEX Puro incompleto: {message}")


def validate_forum_outputs(forum: dict[str, Any] | None) -> None:
    if not forum:
        raise ValueError("Output RAMEX-Forum incompleto: resultados RAMEX-Forum não foram gerados.")
    files = forum.get("files", {})
    required_files = {
        "metrics_json": "ficheiro ramex_forum_metrics.json não encontrado",
        "graph_png": "ficheiro ramex_forum_graph.png não encontrado",
        "simplified_png": "ficheiro ramex_forum_simplified.png não encontrado",
    }
    for key, message in required_files.items():
        if not files.get(key):
            raise ValueError(f"Output RAMEX-Forum incompleto: {message}")
    if not forum.get("metrics"):
        raise ValueError("Output RAMEX-Forum incompleto: métricas RAMEX-Forum não encontradas.")


def pure_response_payload(pure: dict[str, Any] | None) -> dict[str, Any] | None:
    if not pure:
        return None
    return {
        "ramex2007": pure.get("ramex2007"),
        "forward": pure.get("forward"),
        "back_forward_formal": pure.get("backForward"),
        "validation": pure.get("validation"),
        "files": pure.get("files", {}),
    }


def build_transition_matrix(graph: nx.DiGraph) -> dict[str, dict[str, float]]:
    nodes = sorted(graph.nodes())
    return {
        origin: {
            dest: float(graph[origin][dest].get("weight", 0)) if graph.has_edge(origin, dest) else 0.0
            for dest in nodes
        }
        for origin in nodes
    }


def run_pipeline(
    input_file: Path,
    output_dir: Path,
    dataset_type: str,
    progress_cb: ProgressCallback | None = None,
    log_cb: LogCallback | None = None,
    **kw,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    strat = kw.get("polytree_strategy", "top-k")
    analysis_type = kw.get("analysis_type", "pure")

    if analysis_type not in {"pure", "forum", "both"}:
        raise ValueError("Tipo de análise inválido. Use 'pure', 'forum' ou 'both'.")
    if strat not in {"top-k", "multiobjective"}:
        raise ValueError("Estratégia inválida. Use 'top-k' ou 'multiobjective'.")
    if any(kw.get(k, 1) <= 0 for k in ["top_k_per_node", "max_depth", "max_branching"]):
        raise ValueError("K, prof. e ramos devem ser > 0.")
    if not (0 < kw.get("preserve_weight_target", 0.7) <= 1):
        raise ValueError("preserve_weight_target deve estar entre (0, 1].")

    if progress_cb:
        progress_cb("parsing", "Leitura e parsing do dataset")
    seqs = normalize_dataset(input_file, dataset_type, kw.get("case_column"), kw.get("time_column"), kw.get("event_column"))
    if log_cb:
        log_cb(f"Dataset lido com {len(seqs)} sequências válidas")

    if progress_cb:
        progress_cb("sequencias", "Reconstrução de sequências")
    pairs = [(a, b) for s in seqs for a, b in zip(s, s[1:])]
    if not pairs:
        raise ValueError("Nenhuma transição encontrada nas sequências.")
    if log_cb:
        log_cb(f"{len(seqs)} sequências válidas reconstruídas")

    if progress_cb:
        progress_cb("pares", "Geração de pares A -> B")
    if log_cb:
        log_cb(f"{len(pairs)} pares gerados")

    if progress_cb:
        progress_cb("frequencias", "Cálculo de frequências absolutas")
    edges_df = build_pair_frequencies(seqs)

    if progress_cb:
        progress_cb("matriz", "Construção da matriz de adjacência")
    matrix_df = build_adjacency_matrix(edges_df)
    graph_edges_df = filter_edges(edges_df, kw.get("min_frequency"), kw.get("top_n"))

    if progress_cb:
        progress_cb("grafo", "Construção do grafo dirigido ponderado")
    graph = build_graph(graph_edges_df)
    ramex_graph, ramex_df, root = build_ramex_simplified(graph)
    if log_cb:
        log_cb(f"{len(edges_df)} transições distintas identificadas")
        log_cb(f"Grafo completo criado com {graph.number_of_nodes()} nós e {graph.number_of_edges()} arestas")

    min_w = kw.get("min_weight") or (kw.get("min_frequency") if kw.get("min_frequency", 0) > 0 else None)
    params = {k: kw.get(k) for k in ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "preserve_weight_target", "max_branching", "min_score", "max_depth"]}
    params.update({"strategy": strat, "top_k_per_node": kw.get("top_k_per_node", 2), "min_weight": min_w or 0})

    if strat == "multiobjective":
        g_poly, df_poly = build_ramex_polytree_multiobjective(graph, root, **params)
    else:
        g_poly, df_poly = build_ramex_polytree(graph, root, as_int(params.get("top_k_per_node"), 2), as_int(params.get("max_depth"), 5), min_w)

    files = {
        "pairs_csv": "pares_frequencias.csv", "matrix_csv": "matriz_adjacencia.csv",
        "graph_edges_csv": "grafo_edges.csv", "ramex_csv": "ramex_simplificado.csv",
        "polytree_csv": "ramex_polytree.csv", "polytree_json": "ramex_polytree.json",
        "graph_png": "grafo.png", "ramex_png": "ramex_simplificado.png", "polytree_png": "ramex_polytree.png",
    }

    edges_df.rename(columns={"From": "Source", "To": "Target", "Weight": "Frequency"}).to_csv(output_dir / files["pairs_csv"], index=False)
    matrix_df.to_csv(output_dir / files["matrix_csv"])
    graph_edges_df.to_csv(output_dir / files["graph_edges_csv"], index=False)
    ramex_df.to_csv(output_dir / files["ramex_csv"], index=False)
    df_poly[[c for c in ["From", "To", "Weight", "Level", "Strategy", "Score", "Reason", "ParentPath"] if c in df_poly]].to_csv(output_dir / files["polytree_csv"], index=False)
    (output_dir / files["polytree_json"]).write_text(
        json.dumps(polytree_to_json(graph, g_poly, df_poly, root, strat, params), indent=2), encoding="utf-8"
    )

    draw_graph(graph, output_dir / files["graph_png"])
    draw_graph(ramex_graph, output_dir / files["ramex_png"], root)
    draw_graph(g_poly, output_dir / files["polytree_png"], root)

    all_nodes = set(edges_df["From"]) | set(edges_df["To"])
    transition_matrix_data = {}
    if len(all_nodes) <= 10:
        transition_matrix_data = build_transition_matrix(graph)
        files["transition_matrix_json"] = "transition_matrix.json"
        (output_dir / files["transition_matrix_json"]).write_text(
            json.dumps(transition_matrix_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    n, e, tw = len(all_nodes), len(edges_df), float(edges_df["Weight"].sum())
    density = e / (n * (n - 1)) if n > 1 else 0
    metrics = {
        "nodes": n, "edges": e, "total_weight": tw,
        "ramex_edges": len(ramex_df), "ramex_weight": float(ramex_df["Weight"].sum()),
        "preserved_percentage": (float(ramex_df["Weight"].sum()) / tw * 100) if tw else 0,
        "density": density, "root": root, "sequences": len(seqs), "pairs": len(pairs),
        "dense": e > 1000 or (n >= 50 and density > 0.2),
    }

    pure: dict[str, Any] | None = None
    if analysis_type in {"pure", "both"}:
        pure = run_pure_ramex_outputs(
            output_dir, output_dir.name, output_dir / files["graph_edges_csv"],
            graph_edges_df, metrics, progress_cb=progress_cb, log_cb=log_cb,
        )
        files.update(pure["files"])

    forum: dict[str, Any] | None = None
    if analysis_type in {"forum", "both"}:
        if progress_cb:
            progress_cb("forum", "Execução RAMEX-Forum")
        forum = run_ramex_forum(graph_edges_df, output_dir / "ramex_forum")
        forum_files = forum.get("files", {})
        files.update({
            "ramex_forum_edges_csv": forum_files.get("edges_csv", "ramex_forum_edges.csv"),
            "ramex_forum_metrics_json": forum_files.get("metrics_json", "ramex_forum_metrics.json"),
            "ramex_forum_graph_png": forum_files.get("graph_png", "ramex_forum_graph.png"),
            "ramex_forum_simplified_png": forum_files.get("simplified_png", "ramex_forum_simplified.png"),
            "ramex_forum_report_md": forum_files.get("report_md", "ramex_forum_report.md"),
        })
        if log_cb:
            log_cb("RAMEX-Forum concluído com pesos relativos e análise de influência")

    if analysis_type == "both":
        validate_pure_outputs(pure)
        validate_forum_outputs(forum)
    elif analysis_type == "pure":
        validate_pure_outputs(pure)
    elif analysis_type == "forum":
        validate_forum_outputs(forum)

    if progress_cb:
        progress_cb("relatorio", "Geração de relatório técnico")

    pipeline_steps_map = {
        "forum": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo", "RAMEX-Forum"],
        "both": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo", "RAMEX 2007", "Forward", "Back-and-Forward formal", "Validação RAMEX puro", "RAMEX-Forum"],
        "pure": ["ficheiro recebido", "parsing", "sequencias", "pares", "matriz", "grafo", "RAMEX 2007", "Forward", "Back-and-Forward formal", "Validação RAMEX puro"],
    }
    pure_legacy = {k: pure[k] for k in ["ramex2007", "forward", "backForward", "comparisonRows", "comparisonMarkdown", "multidatasetMarkdown", "missing"]} if pure else None

    return {
        "status": "completed", "analysis_type": analysis_type, "metrics": metrics,
        "interpretation": interpret(metrics),
        "top_transitions": edges_to_records(edges_df.head(5)),
        "matrix": matrix_to_json(matrix_df),
        "graph_edges": edges_to_records(graph_edges_df),
        "ramex_edges": edges_to_records(ramex_df),
        "polytree": polytree_to_json(graph, g_poly, df_poly, root, strat, params),
        "polytree_edges": edges_to_records(df_poly),
        "files": files,
        "transition_matrix": transition_matrix_data,
        "pure": pure_response_payload(pure),
        "forum": forum,
        "pure_ramex": pure_legacy,
        "formal_polytree": pure["backForward"] if pure else None,
        "pure_validation": pure["validation"] if pure else None,
        "ramex_forum": forum,
        "pipeline_steps": pipeline_steps_map[analysis_type],
    }