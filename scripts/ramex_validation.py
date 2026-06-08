from __future__ import annotations

from typing import Any

import networkx as nx


def _total_weight(graph: nx.Graph) -> float:
    return float(sum(float(data.get("weight", data.get("Weight", 0.0))) for _, _, data in graph.edges(data=True)))


def _density(graph: nx.Graph) -> float:
    try:
        return float(nx.density(graph))
    except Exception:
        return 0.0


def _is_dag(graph: nx.Graph) -> bool:
    return bool(graph.is_directed() and nx.is_directed_acyclic_graph(graph))


def _reachable_from_root(graph: nx.DiGraph, root: Any) -> bool:
    if root not in graph:
        return False
    reachable = set(nx.descendants(graph, root)) | {root}
    return reachable == set(graph.nodes)


def _preserved_weight(selected_graph: nx.Graph, original_graph: nx.Graph | None) -> float | None:
    if original_graph is None:
        return None
    original_weight = _total_weight(original_graph)
    if original_weight <= 0:
        return 0.0
    return _total_weight(selected_graph) / original_weight * 100


def summarize_graph_metrics(G: nx.Graph, original_graph: nx.Graph | None = None) -> dict[str, Any]:
    nodes = G.number_of_nodes()
    edges = G.number_of_edges()
    in_degrees = [int(degree) for _, degree in G.in_degree()] if G.is_directed() else []
    out_degrees = [int(degree) for _, degree in G.out_degree()] if G.is_directed() else []
    degrees = [int(degree) for _, degree in G.degree()]
    preserved = _preserved_weight(G, original_graph)

    metrics: dict[str, Any] = {
        "nodes": nodes,
        "edges": edges,
        "total_weight": _total_weight(G),
        "average_degree": (sum(degrees) / nodes) if nodes else 0.0,
        "max_in_degree": max(in_degrees, default=0),
        "max_out_degree": max(out_degrees, default=0),
        "number_of_sources": sum(1 for _, degree in G.in_degree() if int(degree) == 0) if G.is_directed() else 0,
        "number_of_sinks": sum(1 for _, degree in G.out_degree() if int(degree) == 0) if G.is_directed() else 0,
        "density": _density(G),
    }
    if preserved is not None:
        metrics["preserved_weight_percentage"] = preserved
        metrics["preserved_weight_percent"] = preserved
    return metrics


def validate_observed_graph(G: nx.DiGraph) -> dict[str, Any]:
    is_dag = _is_dag(G)
    metrics = summarize_graph_metrics(G)
    return {
        **metrics,
        "is_dag": is_dag,
        "has_cycles": not is_dag,
        "message": "Grafo observado: pode conter ciclos e múltiplas entradas.",
    }


def validate_rooted_branching(G: nx.DiGraph, root: Any, original_graph: nx.DiGraph | None = None) -> dict[str, Any]:
    messages: list[str] = []
    root_exists = root in G
    nodes = G.number_of_nodes()
    edges = G.number_of_edges()
    expected_edges = max(nodes - 1, 0)
    is_dag = _is_dag(G)
    root_in_degree = int(G.in_degree(root)) if root_exists and G.is_directed() else None
    non_root_in_degrees = [int(degree) for node, degree in G.in_degree() if node != root] if G.is_directed() else []
    max_non_root_in_degree = max(non_root_in_degrees, default=0)
    max_in_degree = max((int(degree) for _, degree in G.in_degree()), default=0) if G.is_directed() else 0
    all_reachable_from_root = _reachable_from_root(G, root) if G.is_directed() else False
    edge_count_ok = edges == expected_edges

    if not root_exists:
        messages.append("A raiz não existe na estrutura selecionada.")
    if root_exists and root_in_degree != 0:
        messages.append("A raiz tem in_degree diferente de 0.")
    if max_non_root_in_degree > 1:
        messages.append("Existe pelo menos um nó não-raiz com in_degree superior a 1.")
    if not G.is_directed():
        messages.append("A estrutura selecionada não é um grafo dirigido.")
    if not is_dag:
        messages.append("A estrutura selecionada não é acíclica.")
    if not all_reachable_from_root:
        messages.append("Nem todos os nós selecionados são alcançáveis a partir da raiz.")
    if not edge_count_ok:
        messages.append("A estrutura não cumpre edges = nodes - 1.")

    is_valid = bool(root_exists and root_in_degree == 0 and max_non_root_in_degree <= 1 and is_dag and all_reachable_from_root and edge_count_ok)
    messages.append(
        "Rooted branching validado como arborescência dirigida."
        if is_valid
        else "Estrutura rooted branching inválida — requer revisão."
    )

    metrics = summarize_graph_metrics(G, original_graph)
    return {
        **metrics,
        "is_valid_rooted_branching": is_valid,
        "is_valid_arborescence": is_valid,
        "is_arborescence": is_valid,
        "root": root,
        "root_exists": root_exists,
        "nodes": nodes,
        "edges": edges,
        "expected_edges": expected_edges,
        "is_dag": is_dag,
        "all_reachable_from_root": all_reachable_from_root,
        "reachable_from_root": all_reachable_from_root,
        "root_in_degree": root_in_degree,
        "max_in_degree": max_in_degree,
        "max_non_root_in_degree": max_non_root_in_degree,
        "edge_count_ok": edge_count_ok,
        "total_selected_weight": _total_weight(G),
        "original_total_weight": _total_weight(original_graph) if original_graph is not None else 0.0,
        "preserved_weight_percentage": _preserved_weight(G, original_graph) if original_graph is not None else metrics.get("preserved_weight_percentage", 0.0),
        "validation_messages": messages,
    }


def validate_forward_tree(G: nx.DiGraph, root: Any, original_graph: nx.DiGraph | None = None) -> dict[str, Any]:
    messages: list[str] = []
    root_exists = root in G
    nodes = G.number_of_nodes()
    edges = G.number_of_edges()
    is_dag = _is_dag(G)
    all_reachable_from_root = _reachable_from_root(G, root) if G.is_directed() else False
    edge_count_ok = edges <= max(nodes - 1, 0)

    if not root_exists:
        messages.append("A raiz Forward não existe na estrutura selecionada.")
    if not all_reachable_from_root:
        messages.append("Nem todos os nós selecionados são alcançáveis pela expansão Forward.")
    if not is_dag:
        messages.append("A estrutura Forward contém ciclos dirigidos.")
    if not edge_count_ok:
        messages.append("A estrutura Forward excede nodes - 1 arestas.")

    is_valid = bool(root_exists and all_reachable_from_root and is_dag and edge_count_ok)
    messages.append(
        "Forward Heuristic validada como expansão dirigida a partir da raiz."
        if is_valid
        else "Estrutura Forward inválida — requer revisão."
    )

    metrics = summarize_graph_metrics(G, original_graph)
    return {
        **metrics,
        "is_valid_forward_tree": is_valid,
        "root": root,
        "root_exists": root_exists,
        "is_dag": is_dag,
        "is_acyclic": is_dag,
        "all_reachable_from_root": all_reachable_from_root,
        "reachable_from_root": all_reachable_from_root,
        "edge_count_ok": edge_count_ok,
        "expected_max_edges": max(nodes - 1, 0),
        "selected_nodes": nodes,
        "selected_edges": edges,
        "total_selected_weight": _total_weight(G),
        "original_total_weight": _total_weight(original_graph) if original_graph is not None else 0.0,
        "preserved_weight_percentage": _preserved_weight(G, original_graph) if original_graph is not None else metrics.get("preserved_weight_percentage", 0.0),
        "validation_messages": messages,
    }


def validate_polytree(G: nx.DiGraph, original_graph: nx.DiGraph | None = None) -> dict[str, Any]:
    messages: list[str] = []
    nodes = G.number_of_nodes()
    edges = G.number_of_edges()
    expected_edges = max(nodes - 1, 0)
    is_dag = _is_dag(G)
    undirected = G.to_undirected()
    undirected_is_tree = bool(nodes > 0 and nx.is_tree(undirected))
    edge_count_ok = edges == expected_edges
    max_in_degree = max((int(degree) for _, degree in G.in_degree()), default=0) if G.is_directed() else 0
    convergence_nodes = sorted(str(node) for node, degree in G.in_degree() if int(degree) > 1) if G.is_directed() else []

    if not is_dag:
        messages.append("A estrutura contém ciclos dirigidos.")
    if not undirected_is_tree:
        if nodes == 0:
            messages.append("A estrutura não contém nós.")
        elif not nx.is_connected(undirected):
            messages.append("O grafo não dirigido correspondente está desconexo.")
        else:
            messages.append("O grafo não dirigido correspondente contém ciclos.")
    if not edge_count_ok:
        messages.append("A estrutura não cumpre edges = nodes - 1.")

    is_valid = bool(is_dag and undirected_is_tree and edge_count_ok)
    messages.append(
        "Poly-tree formal validada: DAG cujo grafo não dirigido é uma árvore."
        if is_valid
        else "Estrutura Back-and-Forward inválida — requer revisão."
    )

    metrics = summarize_graph_metrics(G, original_graph)
    return {
        **metrics,
        "is_valid_polytree": is_valid,
        "is_polytree": is_valid,
        "is_dag": is_dag,
        "is_acyclic": is_dag,
        "undirected_is_tree": undirected_is_tree,
        "is_tree_undirected": undirected_is_tree,
        "nodes": nodes,
        "edges": edges,
        "expected_edges": expected_edges,
        "edge_count_ok": edge_count_ok,
        "max_in_degree": max_in_degree,
        "convergence_nodes": convergence_nodes,
        "total_selected_weight": _total_weight(G),
        "original_total_weight": _total_weight(original_graph) if original_graph is not None else 0.0,
        "preserved_weight_percentage": _preserved_weight(G, original_graph) if original_graph is not None else metrics.get("preserved_weight_percentage", 0.0),
        "validation_messages": messages,
    }
