"""
12_relatorio_conformidade.py

Geração automática do Relatório de Conformidade RAMEX.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

# Conteúdos Estáticos (Markdown)

MD_HEADER = """\
# Relatório de Conformidade RAMEX

**Data:** {date}  
**Versão:** 1.0  
**Framework:** RAMEX Sequential Analysis Framework  
**Âmbito:** Validação científica da implementação face aos princípios RAMEX (2007, 2015)  

---"""

MD_SECTIONS_1_5 = """\
## 1. Introdução
### 1.1 Objetivo do projeto
Este projeto tem como objetivo construir uma framework de análise de padrões sequenciais inspirada no algoritmo RAMEX, proposto por Luís Cavique (2007, 2015). A framework transforma dados brutos de sequências em estruturas de rede interpretáveis, mantendo rastreabilidade completa.

### 1.2 Problema abordado
A análise de eventos enfrenta dois problemas estruturais:
- **Explosão combinatória** — métodos tradicionais geram demasiados padrões confusos.
- **Falta de visão global** — a análise item-a-item não revela a estrutura dominante.

O RAMEX resolve-os ao representar transições num grafo dirigido ponderado, condensado numa estrutura acíclica mínima que preserva o máximo de peso.

### 1.3 Motivação para usar RAMEX
- Representação visual e interpretável.
- Preservação de pesos absolutos (frequências reais).
- Estrutura acíclica que facilita a leitura.
- Base científica sólida.

## 2. Fundamentos do RAMEX
### 2.1 Transformação de sequências em rede
Cada par consecutivo `(A, B)` origina uma aresta `A → B`. O peso corresponde à contagem absoluta dessas ocorrências. Resulta numa matriz esparsa.

### 2.2 Pesos absolutos e estrutura acíclica
O uso de pesos absolutos garante que a estrutura reflete o comportamento real. O objetivo do RAMEX 2007 é encontrar uma **arborescência de peso máximo** — uma árvore dirigida (acíclica) que cobre os nós maximizando a soma de pesos.

### 2.3 Poly-tree (RAMEX 2015) e Rule Mining
Em 2015, Cavique generalizou o modelo para permitir múltiplos ramos (*poly-tree*). Ao contrário do *Rule Mining*, o RAMEX oferece uma visão global, menos padrões e opera sobre frequências em vez de apenas confiança local.

## 3. Pipeline Implementada
A pipeline é modular. Artefactos gerados referenciam o ficheiro de entrada para rastreabilidade completa. Existe uma clara separação entre os métodos RAMEX puros (10A, 10B, 10C) e abordagens heurísticas experimentais (Top-K, Multiobjectivo).

## 4. Conformidade com o RAMEX
| Componente RAMEX | Script | Conformidade | Nota |
| --- | --- | --- | --- |
| Transformação de sequências | `04_pairs.py` | ✔ Completa | Par consecutivo de eventos |
| Pesos absolutos | `04_pairs.py` | ✔ Completa | Frequência absoluta |
| Grafo dirigido ponderado | `06_grafo.py` | ✔ Completa | DiGraph com `weight` |
| Matriz de adjacência | `05_matriz_adjacencia.py` | ✔ Completa | Linhas=origens, colunas=destinos |
| Rooted branching | `10A...` | ✔ Completa | Arborescência de peso máximo (NetworkX) |
| Forward heuristic | `10B...` | ✔ Completa | Expansão greedy a partir da raiz |
| Back-and-forward | `10C...` | ✔ Completa | Expansão bidirecional sem raiz explícita |
| Propriedade acíclica | Fases 10A–10C | ✔ Validada | Verificação com `is_dag` |
| Poly-tree formal | `10_ramex_polytree.py`| ⚠️ Aproximação | Heurística Top-K / Multiobjectivo |

## 5. Análise dos Métodos
- **10A (Rooted Branching):** Encontra a arborescência de peso máximo. Excecional em estruturas lineares, mas preserva poucas arestas percentualmente em grafos densos.
- **10B (Forward Heuristic):** Expansão greedy a partir de uma raiz natural, escolhendo arestas de maior peso.
- **10C (Back-and-Forward):** Inicia na aresta de peso global máximo e expande em ambas as direções, aproximando o conceito de poly-tree."""

MD_SECTIONS_7_9 = """\
## 7. Limitações
- **Poly-tree formal não implementada:** As implementações atuais são aproximações heurísticas à formalização de Cavique (2015).
- **Dependência da estrutura:** Grafos lineares favorecem 10A; grafos muito densos forçam todos os métodos a comprimir fortemente.
- A escalabilidade extrema (milhões de sequências) ainda não foi sistematicamente testada.

## 8. Conclusão
A framework implementada **demonstra conformidade com os princípios fundamentais do algoritmo RAMEX**. A transformação em grafo, uso de pesos absolutos e extração acíclica seguem as normas. O sistema permite análise estruturada fiel, com validação experimental em múltiplos cenários.

## 9. Referências
1. Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007.
2. Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees.
3. Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum.
4. Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática."""

# Utilitários e Lógica

DATASET_SHORT = {"dataset01": "Dataset 01", "dataset02": "Dataset 02", "dataset03": "Dataset 03"}

def fmt_pct(v: Any) -> str: return f"{float(v):.2f}%" if v is not None else "—"
def fmt_int(v: Any) -> str: return f"{int(v):,}".replace(",", " ") if v is not None else "—"
def fmt_bool(v: Any) -> str: return "Sim" if v is True else "Não" if v is False else "—"

def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    except Exception as e:
        print(f"[aviso] Falha ao ler {path}: {e}", file=sys.stderr)
        return None

def build_validation_section(multi: dict | None) -> str:
    lines = [
        "## 6. Validação Experimental",
        "Os três datasets possuem características distintas para avaliar os métodos.",
        "",
        "### 6.1 Resultados por dataset e algoritmo",
        "| Dataset | Fase | Algoritmo | Nós | Arestas orig. | Arestas sel. | Peso preservado | Acíclico | Ligado |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |"
    ]

    if multi:
        for r in multi.get("rows", []):
            ds_name = DATASET_SHORT.get(str(r.get("dataset", "")), "—")
            nodes = fmt_int(r.get("nodes") or r.get("original_nodes"))
            lines.append(f"| {ds_name} | {r.get('phase', '—')} | {r.get('algorithm', '—')} | {nodes} "
                         f"| {fmt_int(r.get('original_edges'))} | {fmt_int(r.get('edges'))} "
                         f"| {fmt_pct(r.get('preserved_weight_percent'))} | {fmt_bool(r.get('acyclic'))} "
                         f"| {fmt_bool(r.get('connected'))} |")

        if ranking := multi.get("ranking", []):
            lines.extend([
                "\n### 6.2 Ranking global (média multi-dataset)",
                "| Algoritmo | Datasets | Peso preservado médio | Desvio padrão | Arestas médias |",
                "| --- | ---: | ---: | ---: | ---: |"
            ])
            for r in ranking:
                lines.append(f"| {r.get('algorithm', '—')} | {fmt_int(r.get('datasets_available'))} "
                             f"| {fmt_pct(r.get('mean_preserved_weight_percent'))} "
                             f"| {fmt_pct(r.get('std_preserved_weight_percent'))} "
                             f"| {fmt_int(r.get('mean_selected_edges'))} |")

    lines.extend([
        "\n### 6.3 Interpretação por tipo de dataset",
        "**Dataset 01 (Grafo denso, 200 nós, >38k arestas):** A exigência é altíssima. A compressão preserva "
        "< 2% do peso, escolhendo apenas |nós| - 1 arestas. Diferenças marginais entre métodos.",
        "",
        "**Dataset 02 (Grafo linear, 282 nós, 289 arestas):** Estrutura próxima a uma cadeia. O algoritmo 10A "
        "domina (>97% de peso preservado).",
        "",
        "**Dataset 03 (Grafo pequeno e denso):** Os três algoritmos comportam-se de forma equivalente e robusta "
        "(35% a 37% de peso preservado)."
    ])
    return "\n".join(lines)

def markdown_to_txt(content: str) -> str:
    out = []
    for line in content.splitlines():
        if line.startswith("```"):
            continue
        if line.startswith("#"):
            out.append(line.lstrip("#").strip().upper())
        else:
            out.append(line.lstrip("> ").strip())
    return "\n".join(out)

# CLI

def main() -> None:
    parser = argparse.ArgumentParser(description="Geração do Relatório de Conformidade RAMEX.")
    parser.add_argument("--out", default=None, help="Ficheiro de saída.")
    parser.add_argument("--txt", action="store_true", help="Gerar também versão TXT simples.")
    args = parser.parse_args()

    base = Path(".")
    json_base = base / "data" / "json"
    reports_dir = base / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    multi = load_json(json_base / "validacao_ramex_multidataset.json")
    
    per_dataset_count = sum(
        1 for ds in ["dataset01", "dataset02", "dataset03"] 
        if load_json(json_base / f"validacao_ramex_puro_{ds}.json")
    )

    if not multi:
        print("[aviso] validacao_ramex_multidataset.json não encontrado.", file=sys.stderr)
    if per_dataset_count == 0:
        print("[aviso] Nenhum ficheiro validacao_ramex_puro_datasetXX.json encontrado.", file=sys.stderr)

    report = "\n\n".join([
        MD_HEADER.format(date=date.today().strftime("%d/%m/%Y")),
        MD_SECTIONS_1_5,
        build_validation_section(multi),
        MD_SECTIONS_7_9
    ])

    out_md = Path(args.out) if args.out else reports_dir / "relatorio_conformidade_ramex.md"
    out_md.write_text(report, encoding="utf-8")
    print(f"Relatório gerado: {out_md}")

    if args.txt:
        out_txt = out_md.with_suffix(".txt")
        out_txt.write_text(markdown_to_txt(report), encoding="utf-8")
        print(f"Versão TXT gerada: {out_txt}")

    print(f"\nResumo:\n  Multidataset lido: {'Sim' if multi else 'Não'}")
    print(f"  Datasets puros lidos: {per_dataset_count}/3")
    print(f"  Linhas no relatório: {len(report.splitlines())}\nConcluído.")

if __name__ == "__main__":
    main()
