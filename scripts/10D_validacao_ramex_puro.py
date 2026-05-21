from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd  # type: ignore

EXPECTED_FILES = [
    ("10A", "ramex2007_{dataset}.json"),
    ("10B", "ramex_forward_{dataset}.json"),
    ("10C", "ramex_back_forward_{dataset}.json"),
]
CSV_DIR = Path("data/csv")
JSON_DIR = Path("data/json")
REPORTS_DIR = Path("reports")

INTERPRETATIONS = {
    "grafo denso / altamente conectado": "Em grafos densos, todos os métodos são obrigados a condensar uma grande quantidade de transições numa estrutura acíclica reduzida. Por isso, a percentagem de peso preservado tende a ser baixa e as diferenças entre métodos podem ser marginais.",
    "grafo quase linear / sequencial": "Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.",
    "grafo pequeno e completo": "Em grafos pequenos e totalmente conectados, a diferença entre métodos tende a ser reduzida, uma vez que quase todas as transições são estruturalmente relevantes.",
}


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
    parser = argparse.ArgumentParser(description="Validacao comparativa das fases RAMEX puras: 10A, 10B e 10C.")
    parser.add_argument("dataset_name", help="Nome do dataset, por exemplo dataset03.")
    return parser.parse_args()


def describe_anchor(payload: dict) -> str:
    if "root" in payload:
        return str(payload["root"])
    if edge := payload.get("initial_edge"):
        if isinstance(edge, dict):
            return f"{edge.get('from', 'Nao disponivel')} -> {edge.get('to', 'Nao disponivel')} ({edge.get('weight', 'Nao disponivel')})"
    return "Nao disponivel"


def extract_method(payload: dict, phase: str) -> str:
    if method := payload.get("method"):
        return str(method)
    return {"10B": "ramex_forward_heuristic", "10C": "ramex_back_forward_heuristic"}.get(phase, "Nao disponivel")


def extract_observations(payload: dict, phase: str) -> str:
    warnings = payload.get("warnings", [])
    notes = [str(w) for w in warnings] if isinstance(warnings, list) else []
    
    phase_notes = {
        "10A": "Versao base inspirada no RAMEX 2007 com rooted branching.",
        "10B": "Heuristica simples enraizada numa raiz conhecida.",
        "10C": "Heuristica sem raiz explicita, com expansao forward e backward."
    }
    if phase in phase_notes:
        notes.append(phase_notes[phase])
        
    return " | ".join(notes) if notes else "Sem observacoes."


def collect_results(dataset_name: str) -> tuple[list[dict], list[str], list[dict]]:
    rows, warnings, raw_payloads = [], [], []

    for phase, template in EXPECTED_FILES:
        path = JSON_DIR / template.format(dataset=dataset_name)
        if not path.exists():
            warnings.append(f"Ficheiro nao encontrado: {path}")
            continue
        if path.stat().st_size == 0:
            warnings.append(f"Ficheiro vazio: {path}")
            continue

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            metrics = payload.get("metrics") or {}
            
            rows.append({
                "Fase": phase,
                "Ficheiro": str(path),
                "Algoritmo": payload.get("algorithm", "Nao disponivel"),
                "Metodo": extract_method(payload, phase),
                "Nos originais": metrics.get("original_nodes"),
                "Arestas originais": metrics.get("original_edges"),
                "Nos selecionados": metrics.get("selected_nodes"),
                "Arestas selecionadas": metrics.get("selected_edges"),
                "Soma pesos originais": metrics.get("original_weight_sum"),
                "Soma pesos selecionados": metrics.get("selected_weight_sum"),
                "Peso preservado (%)": metrics.get("preserved_weight_percent"),
                "Aciclico": metrics.get("is_acyclic"),
                "Conectado": metrics.get("is_connected"),
                "Raiz ou aresta inicial": describe_anchor(payload),
                "Observacoes": extract_observations(payload, phase),
            })
            raw_payloads.append({"phase": phase, "file": str(path), "payload": payload})
        except Exception as exc:
            warnings.append(f"JSON invalido em {path}: {exc}")

    return rows, warnings, raw_payloads


def classify_dataset_structure(rows: list[dict]) -> str:
    if not rows:
        return "grafo de estrutura intermédia"

    nodes, edges = safe_float(rows[0].get("Nos originais")), safe_float(rows[0].get("Arestas originais"))
    ramex2007 = next((r for r in rows if r.get("Fase") == "10A"), {})
    preserved = safe_float(ramex2007.get("Peso preservado (%)")) or 0.0

    if nodes and nodes > 1 and edges is not None:
        density = edges / (nodes * (nodes - 1))
        if nodes <= 10 and density > 0.7:
            return "grafo pequeno e completo"
        if density < 0.05 and preserved > 80:
            return "grafo quase linear / sequencial"
        if density > 0.7:
            return "grafo denso / altamente conectado"
            
    return "grafo de estrutura intermédia"


def make_md_table(rows: list[dict]) -> str:
    if not rows:
        return "Nao existem resultados validos para comparar."

    cols = ["Fase", "Algoritmo", "Metodo", "Nos selecionados", "Arestas selecionadas", 
            "Soma pesos selecionados", "Peso preservado (%)", "Aciclico", "Conectado", "Raiz ou aresta inicial"]

    lines = [f"| {' | '.join(cols)} |", f"| {' | '.join(['---'] * len(cols))} |"]
    lines.extend(f"| {' | '.join(fmt(r.get(c)) for c in cols)} |" for r in rows)
    return "\n".join(lines)


def build_markdown(dataset_name: str, rows: list[dict], warnings: list[str]) -> str:
    valid_pres = [r for r in rows if isinstance(r.get("Peso preservado (%)"), (int, float))]
    highest = max(valid_pres, key=lambda r: (r["Peso preservado (%)"], r["Fase"])) if valid_pres else None

    valid_edges = [r for r in rows if isinstance(r.get("Arestas selecionadas"), (int, float))]
    min_edges = min((r["Arestas selecionadas"] for r in valid_edges), default=None)
    simplest = [r for r in valid_edges if r["Arestas selecionadas"] == min_edges]

    polytree = next((r for r in rows if r.get("Fase") == "10C"), None)
    struct_type = classify_dataset_structure(rows)

    highest_txt = f"{highest['Algoritmo']} ({highest['Peso preservado (%)']:.2f}%)" if highest else "Nao disponivel"
    simplest_txt = ", ".join(f"{r['Algoritmo']} ({r['Arestas selecionadas']} arestas)" for r in simplest) if simplest else "Nao disponivel"
    polytree_txt = polytree["Algoritmo"] if polytree else "Nao disponivel"
    default_interpretation = "Em grafos de estrutura intermédia, a leitura deve equilibrar peso preservado, simplicidade e capacidade de representar relações estruturais relevantes."

    md = [
        f"# Validacao Comparativa RAMEX Puro - {dataset_name}\n",
        "## 1. Resumo da comparacao\n",
        "Esta validacao compara as fases RAMEX puras implementadas na framework: RAMEX 2007 Rooted Branching, RAMEX Forward Heuristic e RAMEX Back-and-Forward Heuristic.\n",
        "Os resultados demonstram que nao existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transicoes.\n",
        f"Tipo estrutural do dataset: **{struct_type}**.\n",
        f"{INTERPRETATIONS.get(struct_type, default_interpretation)}\n",
        make_md_table(rows),
        "\n## 2. Diferencas entre metodos\n",
        "- **Rooted Branching:** representa a versao base inspirada no RAMEX 2007, procurando uma arvore dirigida enraizada que preserve peso sob restricoes de branching.",
        "- **Forward:** expande a partir de uma raiz conhecida, escolhendo iterativamente transicoes fortes para novos nos.",
        "- **Back-and-Forward:** nao depende de uma raiz explicita; parte da aresta mais forte e expande para sucessores e antecessores, aproximando-se melhor da ideia de Poly-tree RAMEX.\n",
        "A heuristica Forward tende a produzir uma estrutura simples e enraizada, adequada quando existe um no inicial conhecido. A heuristica Back-and-Forward nao depende de uma raiz explicita e permite expansao em ambos os sentidos, aproximando-se melhor da ideia de Poly-tree RAMEX. O Rooted Branching representa a versao base inspirada no RAMEX 2007.\n",
        "## 3. Metodo com maior peso preservado\n",
        f"O metodo com maior percentagem de peso preservado foi: **{highest_txt}**.\n",
        "## 4. Metodo mais simples\n",
        f"Os metodos mais simples, considerando o menor numero de arestas selecionadas, sao: **{simplest_txt}**.\n",
        "## 5. Metodo mais proximo da Poly-tree RAMEX\n",
        f"O metodo mais proximo da ideia de Poly-tree RAMEX e: **{polytree_txt}**, por permitir expansao nos dois sentidos a partir da relacao inicial mais forte.\n",
        "## 6. Conclusao final\n",
        "A comparacao permite observar o compromisso entre simplicidade, enraizamento e preservacao estrutural. A escolha do metodo deve depender da natureza do dataset e do objetivo da analise, evitando assumir que um algoritmo e universalmente superior.\n"
    ]

    if warnings:
        md.append("## Avisos\n" + "\n".join(f"- {w}" for w in warnings) + "\n")

    return "\n".join(md)


def export_outputs(dataset: str, rows: list[dict], warnings: list[str], raw_payloads: list[dict]) -> tuple[Path, Path, Path]:
    formatted_rows = [{k: fmt(v) for k, v in r.items()} for r in rows]
    
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    out_csv = CSV_DIR / f"validacao_ramex_puro_{dataset}.csv"
    out_md = REPORTS_DIR / f"validacao_ramex_puro_{dataset}.md"
    out_json = JSON_DIR / f"validacao_ramex_puro_{dataset}.json"

    pd.DataFrame(formatted_rows).to_csv(out_csv, index=False, encoding="utf-8")
    out_md.write_text(build_markdown(dataset, rows, warnings), encoding="utf-8")
    
    summary = {"dataset": dataset, "rows": formatted_rows, "warnings": warnings, "source_payloads": raw_payloads}
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    
    return out_csv, out_md, out_json


def main() -> None:
    args = parse_arguments()
    try:
        rows, warnings, raw_payloads = collect_results(args.dataset_name)
        if not rows:
            raise ValueError("Nao existem JSONs validos para comparar.")
            
        outputs = export_outputs(args.dataset_name, rows, warnings, raw_payloads)
        
        print(f"Dataset analisado: {args.dataset_name}\nResultados validos encontrados: {len(rows)}")
        if warnings:
            print("Avisos:\n" + "\n".join(f"- {w}" for w in warnings))
        print(f"CSV gerado: {outputs[0]}\nMarkdown gerado: {outputs[1]}\nJSON gerado: {outputs[2]}")
        
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
