from __future__ import annotations

from pathlib import Path
import argparse
import json
import statistics
import sys
from typing import Any

import pandas as pd  # type: ignore


DEFAULT_DATASETS = ["dataset01", "dataset02", "dataset03"]
EXPECTED_FILES = [
    ("10A", "RAMEX 2007 Rooted Branching", "ramex2007_{dataset}.json"),
    ("10B", "RAMEX Forward Heuristic", "ramex_forward_{dataset}.json"),
    ("10C", "RAMEX Back-and-Forward Heuristic", "ramex_back_forward_{dataset}.json"),
]
CSV_DIR = Path("data/csv")
JSON_DIR = Path("data/json")
REPORTS_DIR = Path("reports")

def safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def fmt(value: Any, decimals: int = 2) -> str:
    if value is None:
        return "Nao disponivel"
    return f"{value:.{decimals}f}" if isinstance(value, float) else str(value)

def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validacao multi-dataset das fases RAMEX puras.")
    parser.add_argument("datasets", nargs="*", default=DEFAULT_DATASETS, help="Datasets a comparar.")
    return parser.parse_args()

def collect_rows(datasets: list[str]) -> tuple[list[dict], list[str], dict[str, list[str]]]:
    rows, warnings = [], []
    found_files = {ds: [] for ds in datasets}

    for dataset in datasets:
        for phase, fallback_algo, template in EXPECTED_FILES:
            path = JSON_DIR / template.format(dataset=dataset)
            if not path.exists():
                warnings.append(f"{dataset}: Ficheiro nao encontrado: {path}")
                continue
            if path.stat().st_size == 0:
                warnings.append(f"{dataset}: Ficheiro vazio: {path}")
                continue

            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                metrics = payload.get("metrics") or {}
                rows.append({
                    "dataset": dataset,
                    "phase": phase,
                    "algorithm": str(payload.get("algorithm") or fallback_algo),
                    "source_file": str(path),
                    "nodes": metrics.get("selected_nodes"),
                    "edges": metrics.get("selected_edges"),
                    "original_nodes": metrics.get("original_nodes"),
                    "original_edges": metrics.get("original_edges"),
                    "weight_sum": metrics.get("original_weight_sum"),
                    "selected_weight": metrics.get("selected_weight_sum"),
                    "preserved_weight_percent": metrics.get("preserved_weight_percent"),
                    "acyclic": metrics.get("is_acyclic"),
                    "connected": metrics.get("is_connected"),
                })
                found_files[dataset].append(str(path))
            except json.JSONDecodeError as exc:
                warnings.append(f"{dataset}: JSON invalido em {path}: {exc}")

    return rows, warnings, found_files

def best_by_weight(rows: list[dict]) -> dict | None:
    valid = [r for r in rows if safe_float(r.get("preserved_weight_percent")) is not None]
    if not valid: return None
    return max(valid, key=lambda r: (safe_float(r["preserved_weight_percent"]), -ord(str(r["algorithm"])[0])))

def simplest_methods(rows: list[dict]) -> list[dict]:
    valid = [(r, e) for r in rows if (e := safe_float(r.get("edges"))) is not None]
    if not valid: return []
    min_edges = min(e for _, e in valid)
    return [r for r, e in valid if e == min_edges]

def structural_method(rows: list[dict]) -> dict | None:
    valid = [r for r in rows if safe_float(r.get("nodes")) is not None]
    if not valid: return None
    return min(valid, key=lambda r: (
        -(1 if r.get("connected") else 0),
        -(safe_float(r["nodes"]) or 0),
        -(safe_float(r.get("edges")) or 0),
        str(r["algorithm"])
    ))

def aggregate_by_algorithm(rows: list[dict]) -> list[dict]:
    grouped = {}
    for row in rows:
        grouped.setdefault(str(row["algorithm"]), []).append(row)

    ranking = []
    for algo, items in grouped.items():
        pres_vals = [v for r in items if (v := safe_float(r.get("preserved_weight_percent"))) is not None]
        edge_vals = [v for r in items if (v := safe_float(r.get("edges"))) is not None]
        
        ranking.append({
            "algorithm": algo,
            "datasets_available": len(items),
            "mean_preserved_weight_percent": statistics.mean(pres_vals) if pres_vals else None,
            "std_preserved_weight_percent": statistics.pstdev(pres_vals) if len(pres_vals) > 1 else (0 if pres_vals else None),
            "mean_selected_edges": statistics.mean(edge_vals) if edge_vals else None,
        })

    ranking.sort(key=lambda x: (-(x["mean_preserved_weight_percent"] or -1), x["algorithm"]))
    return ranking

def classify_dataset_structure(dataset_rows: list[dict]) -> str:
    if not dataset_rows: return "grafo de estrutura intermédia"
    
    nodes = safe_float(dataset_rows[0].get("original_nodes"))
    edges = safe_float(dataset_rows[0].get("original_edges"))
    ramex2007 = next((r for r in dataset_rows if r.get("phase") == "10A"), {})
    preserved = safe_float(ramex2007.get("preserved_weight_percent")) or 0

    density = edges / (nodes * (nodes - 1)) if nodes and nodes > 1 and edges else None

    if density is not None and nodes is not None:
        if nodes <= 10 and density > 0.7: return "grafo pequeno e completo"
        if density < 0.05 and preserved > 80: return "grafo quase linear / sequencial"
        if density > 0.7: return "grafo denso / altamente conectado"
        
    return "grafo de estrutura intermédia"

def structural_interpretation(struct_type: str) -> str:
    interpretations = {
        "grafo denso / altamente conectado": "Em grafos densos, todos os métodos são obrigados a condensar uma grande quantidade de transições numa estrutura acíclica reduzida. A percentagem de peso preservado tende a ser baixa.",
        "grafo quase linear / sequencial": "Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.",
        "grafo pequeno e completo": "Em grafos pequenos e totalmente conectados, a diferença entre métodos tende a ser reduzida."
    }
    return interpretations.get(struct_type, "Em grafos de estrutura intermédia, a interpretação deve equilibrar cobertura de peso, simplicidade e preservação estrutural.")

def make_md_table(columns: list[str], data: list[dict]) -> str:
    if not data: return "Nao existem resultados validos."
    lines = [
        f"| {' | '.join(columns)} |",
        f"| {' | '.join(['---'] * len(columns))} |"
    ]
    lines.extend(f"| {' | '.join(fmt(row.get(col)) for col in columns)} |" for row in data)
    return "\n".join(lines)

def build_markdown(rows: list[dict], datasets: list[str], warnings: list[str]) -> str:
    ranking = aggregate_by_algorithm(rows)
    winners = {ds: best_by_weight([r for r in rows if r["dataset"] == ds]) for ds in datasets}
    
    counts = {}
    for w in winners.values():
        if w: counts[str(w["algorithm"])] = counts.get(str(w["algorithm"]), 0) + 1
    consistent_algo = max(counts.items(), key=lambda i: (i[1], i[0]))[0] if counts else "Nao disponivel"

    best_global = f"{ranking[0]['algorithm']} ({fmt(ranking[0].get('mean_preserved_weight_percent'))}% de media)" if ranking else "Nao disponivel"
    simplest = ", ".join(sorted({str(r["algorithm"]) for r in simplest_methods(rows)})) or "Nao disponivel"
    struct_global = structural_method(rows)
    struct_text = struct_global["algorithm"] if struct_global else "Nao disponivel"

    md = [
        "# Validação RAMEX Puro — Multi Dataset\n\n## 1. Resumo Global\n",
        "Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transições.\n",
        f"- Algoritmo com maior media de peso preservado: **{best_global}**.",
        "- Nota: a média global deve ser interpretada com cautela, pois pode ser influenciada por datasets com estrutura muito específica.",
        f"- Algoritmo com maior numero de vitorias por peso preservado: **{consistent_algo}**.",
        f"- Metodo(s) mais simples: **{simplest}**.",
        f"- Algoritmo mais estruturado: **{struct_text}**.\n",
        "### Ranking global por algoritmo\n",
        make_md_table(["algorithm", "datasets_available", "mean_preserved_weight_percent", "std_preserved_weight_percent", "mean_selected_edges", "vitorias"], 
                      [{**r, "vitorias": counts.get(r["algorithm"], 0)} for r in ranking]),
        "\n### Resultados agregados\n\n" + make_md_table(["dataset", "algorithm", "nodes", "edges", "selected_weight", "preserved_weight_percent", "acyclic", "connected"], rows),
        "\n## 2. Comparação por Dataset\n"
    ]

    for ds in datasets:
        ds_rows = [r for r in rows if r["dataset"] == ds]
        if not ds_rows:
            md.append(f"### {ds}\nNao foram encontrados resultados validos para este dataset.\n")
            continue

        best = best_by_weight(ds_rows)
        struct_type = classify_dataset_structure(ds_rows)
        md.append(f"### {ds}\n")
        md.append(f"- Melhor metodo por peso preservado: **{best['algorithm']} ({fmt(best.get('preserved_weight_percent'))}%)**." if best else "- Melhor metodo: Nao disponivel.")
        md.append(f"- Tipo estrutural do dataset: **{struct_type}**.")
        md.append(f"- Metodos mais simples: **{', '.join(r['algorithm'] + f' ({r.get('edges')} arestas)' for r in simplest_methods(ds_rows))}**.")
        
        struct_meth = structural_method(ds_rows)
        md.append(f"- Metodo mais estrutural: **{struct_meth['algorithm'] if struct_meth else 'Nao disponivel'}**.")
        md.append(f"- Comportamento observado: {structural_interpretation(struct_type)}\n")

    md.append("\n## 3. Conclusão Científica\n")
    md.append("A analise multi-dataset evidencia que o desempenho dos algoritmos RAMEX depende fortemente da estrutura dos dados. Em grafos densos, as restricoes de aciclicidade obrigam todos os metodos a condensar fortemente a rede. Em grafos quase lineares, o RAMEX 2007 preserva grande parte da informacao. A Back-and-Forward Heuristic mostrou-se vantajosa em cenarios com relacoes intermedias relevantes.\n")

    if warnings:
        md.append("## Avisos\n" + "\n".join(f"- {w}" for w in warnings) + "\n")

    return "\n".join(md)

def export_outputs(rows: list[dict], datasets: list[str], warnings: list[str], found_files: dict[str, list[str]]) -> tuple[Path, Path, Path, dict]:
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    out_csv = CSV_DIR / "validacao_ramex_multidataset.csv"
    out_json = JSON_DIR / "validacao_ramex_multidataset.json"
    out_md = REPORTS_DIR / "validacao_ramex_multidataset.md"

    pd.DataFrame(rows).to_csv(out_csv, index=False, encoding="utf-8", columns=[
        "dataset", "algorithm", "nodes", "edges", "weight_sum", "selected_weight", "preserved_weight_percent", "acyclic", "connected"
    ])

    winners = {ds: best_by_weight([r for r in rows if r["dataset"] == ds]) for ds in datasets}
    counts = {}
    for w in winners.values():
        if w: counts[str(w["algorithm"])] = counts.get(str(w["algorithm"]), 0) + 1
    consistent_algo = max(counts.items(), key=lambda i: (i[1], i[0]))[0] if counts else "Nao disponivel"

    summary = {
        "datasets": datasets, "rows": rows, "ranking": aggregate_by_algorithm(rows),
        "winners_by_dataset": winners, "most_consistent_algorithm": consistent_algo,
        "algorithm_with_most_weight_wins": consistent_algo, "consistency_counts": counts,
        "warnings": warnings, "found_files": found_files,
    }
    
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    out_md.write_text(build_markdown(rows, datasets, warnings), encoding="utf-8")
    
    return out_csv, out_json, out_md, summary

def main() -> None:
    args = parse_arguments()
    try:
        rows, warnings, found_files = collect_rows(args.datasets)
        if not rows: raise ValueError("Nao existem JSONs validos para comparar.")
        
        out_csv, out_json, out_md, summary = export_outputs(rows, args.datasets, warnings, found_files)
        
        print(f"Datasets processados: {', '.join(args.datasets)}\nFicheiros encontrados:")
        for ds, files in found_files.items():
            print(f"- {ds}: {', '.join(files) if files else 'nenhum ficheiro valido encontrado'}")

        print(f"\nAlgoritmos comparados: {', '.join(sorted({str(r['algorithm']) for r in rows}))}")
        print("\nMelhor algoritmo por dataset:")
        for ds in args.datasets:
            winner = summary["winners_by_dataset"].get(ds)
            print(f"- {ds}: {f'{winner['algorithm']} ({fmt(winner.get('preserved_weight_percent'))}%)' if winner else 'Nao disponivel'}")

        print(f"\nAlgoritmo com maior media global: {summary['ranking'][0]['algorithm'] if summary['ranking'] else 'Nao disponivel'}")
        print(f"Algoritmo com maior numero de vitorias: {summary['algorithm_with_most_weight_wins']}")

        if warnings:
            print("\nAvisos:\n" + "\n".join(f"- {w}" for w in warnings))

        print(f"\nFicheiros gerados:\n- {out_csv}\n- {out_json}\n- {out_md}")
        
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

if __name__ == "__main__":
    main()
