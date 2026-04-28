from pathlib import Path
from typing import Any
import pandas as pd

DATASETS = {
    "Dataset 01": {"graph_edges": "grafo_edges_dataset01.csv", "ramex_edges": "ramex_dataset01.csv"},
    "Dataset 02": {"graph_edges": "grafo_edges_dataset02.csv", "ramex_edges": "ramex_dataset02.csv"},
    "Dataset 03": {"graph_edges": "grafo_edges_dataset03.csv", "ramex_edges": "ramex_dataset03.csv"},
}

GRAPH_COLUMNS = ["From", "To", "Weight"]
RAMEX_COLUMNS = ["From", "To", "Weight", "Level"]
OUTPUT_CSV = "validacao_comparativa.csv"
OUTPUT_TXT = "validacao_comparativa.txt"


def load_csv(file_path: str, req_cols: list[str]) -> tuple[pd.DataFrame | None, str | None]:
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        return None, f"Ficheiro inexistente ou vazio: {file_path}"

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        return None, f"Erro ao ler {file_path}: {exc}"

    if missing := [c for c in req_cols if c not in df.columns]:
        return None, f"Colunas em falta em {file_path}: {missing}"

    df["From"] = df["From"].astype(str).str.strip()
    df["To"] = df["To"].astype(str).str.strip()
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")

    df = df.dropna(subset=req_cols).query("Weight > 0").copy()
    if df.empty:
        return None, f"Sem arestas válidas com peso positivo em {file_path}"

    return df, None


def fmt_wt(w: float) -> str:
    return str(int(w)) if w.is_integer() else f"{w:.2f}"


def as_float(value: Any) -> float:
    return float(value)


def as_str(value: Any) -> str:
    return str(value)


def top_transitions(df: pd.DataFrame, top_n: int = 5) -> str:
    top = df.sort_values(by="Weight", ascending=False, kind="stable").head(top_n)
    return "; ".join(
        f"{as_str(row['From'])}->{as_str(row['To'])} ({fmt_wt(as_float(row['Weight']))})"
        for row in top.to_dict(orient="records")
    )


def interpret_dataset(name: str, nodes: int, edges: int, weight: float, r_edges: int, pct: float, dens: float) -> str:
    avg_w = weight / edges if edges else 0
    notes = []

    if nodes <= 10 and avg_w >= 10:
        notes.append("poucos nós e transições fortes; apresenta padrões sequenciais interpretáveis")
    elif nodes >= 100 and dens >= 0.20:
        notes.append("muitos nós e elevada densidade; grafo denso/disperso e com baixa legibilidade visual")
    elif nodes >= 100 and avg_w <= 1.5:
        notes.append("muitos nós e poucas repetições; sequência pouco recorrente")
    elif dens < 0.02:
        notes.append("grafo esparso; poucas ligações face ao número de nós")
    else:
        notes.append("estrutura intermédia; requer leitura conjunta dos pesos e da densidade")

    if pct < 20: notes.append("baixa percentagem RAMEX; a estrutura simplificada preserva apenas parte do comportamento")
    elif pct >= 50: notes.append("alta percentagem RAMEX; a estrutura principal representa bem o dataset")
    else: notes.append("percentagem RAMEX moderada; a estrutura simplificada resume uma parte relevante do grafo")

    if r_edges == 0:
        notes.append("não foi obtida estrutura RAMEX com arestas selecionadas")

    return f"{name}: " + "; ".join(notes) + "."


def analyze_dataset(name: str, graph_file: str, ramex_file: str) -> tuple[dict | None, list[str]]:
    warnings = []
    g_df, err_g = load_csv(graph_file, GRAPH_COLUMNS)
    if err_g:
        warnings.append(f"{name}: {err_g}")
        return None, warnings
    if g_df is None:
        warnings.append(f"{name}: leitura do grafo falhou sem detalhe adicional.")
        return None, warnings

    r_df, err_r = load_csv(ramex_file, RAMEX_COLUMNS)
    if err_r:
        warnings.append(f"{name}: {err_r}")
        r_df = pd.DataFrame(columns=RAMEX_COLUMNS)
    elif r_df is None:
        r_df = pd.DataFrame(columns=RAMEX_COLUMNS)

    n_nodes = len(set(g_df["From"]) | set(g_df["To"]))
    n_edges, tot_w = len(g_df), float(g_df["Weight"].sum())
    r_edges, r_w = len(r_df), float(r_df["Weight"].sum()) if not r_df.empty else 0.0

    pct = (r_w / tot_w * 100) if tot_w > 0 else 0.0
    dens = n_edges / (n_nodes * (n_nodes - 1)) if n_nodes > 1 else 0.0

    return {
        "Dataset": name, "Nos_Grafo": n_nodes, "Arestas_Grafo": n_edges, "Soma_Pesos_Grafo": tot_w,
        "Arestas_RAMEX": r_edges, "Soma_Pesos_RAMEX": r_w, "Percentagem_Peso_Preservado": pct,
        "Densidade_Aproximada": dens, "Top_5_Transicoes": top_transitions(g_df),
        "Interpretacao": interpret_dataset(name, n_nodes, n_edges, tot_w, r_edges, pct, dens)
    }, warnings


def build_conclusion(results: list[dict], warnings: list[str]) -> str:
    if not results:
        return "Nao foi possivel gerar conclusao comparativa porque nenhum dataset foi validado com sucesso."

    by_name = {r["Dataset"] for r in results}
    parts = []

    if "Dataset 03" in by_name:
        parts.append("O Dataset 03 apresenta maior potencial para extracao de padroes sequenciais interpretaveis, por possuir poucos nos, transicoes recorrentes e uma estrutura RAMEX simplificada compreensivel.")
    if "Dataset 01" in by_name:
        parts.append("O Dataset 01 revela elevada dispersao e densidade, exigindo filtragem para tornar a leitura do grafo mais clara.")
    if "Dataset 02" in by_name:
        parts.append("O Dataset 02 apresenta muitas transicoes unicas, sugerindo baixa repeticao de padroes.")
    if warnings:
        parts.append("Alguns ficheiros apresentaram avisos ou estavam ausentes, pelo que a comparação deve ser lida apenas com os datasets disponíveis.")

    return " ".join(parts)


def write_report(results: list[dict], warnings: list[str], conclusion: str, out_file: str) -> None:
    lines = ["VALIDACAO COMPARATIVA DA FRAMEWORK\n" + "=" * 42 + "\n"]
    if warnings:
        lines.append("Avisos:\n" + "\n".join(f"- {w}" for w in warnings) + "\n")

    for r in results:
        lines.append(
            f"{r['Dataset']}\n{'-' * len(r['Dataset'])}\n"
            f"Número de nós no grafo: {r['Nos_Grafo']}\n"
            f"Número de arestas no grafo: {r['Arestas_Grafo']}\n"
            f"Soma total dos pesos: {fmt_wt(r['Soma_Pesos_Grafo'])}\n"
            f"Arestas RAMEX selecionadas: {r['Arestas_RAMEX']}\n"
            f"Soma dos pesos RAMEX: {fmt_wt(r['Soma_Pesos_RAMEX'])}\n"
            f"Percentagem de peso preservado: {r['Percentagem_Peso_Preservado']:.2f}%\n"
            f"Densidade aproximada do grafo: {r['Densidade_Aproximada']:.4f}\n"
            f"Top 5 transições mais fortes: {r['Top_5_Transicoes']}\n"
            f"Interpretação: {r['Interpretacao']}\n"
        )

    lines.append(f"Conclusão comparativa final\n{'-' * 29}\n{conclusion}\n")
    Path(out_file).write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    results, warnings = [], []
    for name, files in DATASETS.items():
        res, warns = analyze_dataset(name, files["graph_edges"], files["ramex_edges"])
        warnings.extend(warns)
        if res:
            results.append(res)

    cols = ["Dataset", "Nos_Grafo", "Arestas_Grafo", "Soma_Pesos_Grafo", "Arestas_RAMEX", "Soma_Pesos_RAMEX", 
            "Percentagem_Peso_Preservado", "Densidade_Aproximada", "Top_5_Transicoes", "Interpretacao"]

    if results:
        df = pd.DataFrame(results)
        df[["Soma_Pesos_Grafo", "Soma_Pesos_RAMEX", "Percentagem_Peso_Preservado"]] = df[["Soma_Pesos_Grafo", "Soma_Pesos_RAMEX", "Percentagem_Peso_Preservado"]].round(2)
        df["Densidade_Aproximada"] = df["Densidade_Aproximada"].round(6)
    else:
        df = pd.DataFrame(columns=cols)

    df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8")
    
    conclusion = build_conclusion(results, warnings)
    write_report(results, warnings, conclusion, OUTPUT_TXT)

    print(f"Ficheiro CSV gerado: {OUTPUT_CSV}\nFicheiro TXT gerado: {OUTPUT_TXT}")
    if warnings:
        print("\nAvisos:\n" + "\n".join(f"- {w}" for w in warnings))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())