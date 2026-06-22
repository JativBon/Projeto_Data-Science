from pathlib import Path
import sys

import pandas as pd


COLUNAS_OBRIGATORIAS = ["Source", "Target", "Frequency"]


def load_pair_frequencies(file_path: str) -> pd.DataFrame:
    caminho = Path(file_path)
    if not caminho.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {caminho}")

    try:
        df_pairs = pd.read_csv(caminho, encoding="utf-8")
    except OSError as exc:
        raise OSError(f"Erro ao ler o ficheiro CSV: {exc}") from exc

    colunas_em_falta = [coluna for coluna in COLUNAS_OBRIGATORIAS if coluna not in df_pairs.columns]
    if colunas_em_falta:
        raise ValueError(f"Colunas obrigatorias em falta: {colunas_em_falta}")

    df_pairs = df_pairs[COLUNAS_OBRIGATORIAS].copy()

    for coluna in ["Source", "Target"]:
        df_pairs[coluna] = df_pairs[coluna].astype("string").str.strip()
        df_pairs[coluna] = df_pairs[coluna].replace("", pd.NA)

    df_pairs["Frequency"] = pd.to_numeric(df_pairs["Frequency"], errors="coerce")

    linhas_invalidas = df_pairs["Source"].isna() | df_pairs["Target"].isna() | df_pairs["Frequency"].isna()
    if linhas_invalidas.any():
        total_invalidas = int(linhas_invalidas.sum())
        raise ValueError(
            f"O ficheiro contem {total_invalidas} linhas invalidas nas colunas Source, Target ou Frequency."
        )

    df_pairs["Source"] = df_pairs["Source"].astype(str)
    df_pairs["Target"] = df_pairs["Target"].astype(str)
    df_pairs["Frequency"] = df_pairs["Frequency"].astype(int)

    frequencias_negativas = df_pairs["Frequency"] < 0
    if frequencias_negativas.any():
        total_negativas = int(frequencias_negativas.sum())
        raise ValueError(f"O ficheiro contem {total_negativas} frequencias negativas, o que nao e permitido.")

    return df_pairs


def aggregate_pair_frequencies(df_pairs: pd.DataFrame) -> pd.DataFrame:
    return (
        df_pairs.groupby(["Source", "Target"], as_index=False)["Frequency"]
        .sum()
        .sort_values(by="Frequency", ascending=False, kind="stable")
        .reset_index(drop=True)
    )


def build_adjacency_matrix(df_pairs: pd.DataFrame) -> pd.DataFrame:
    nos = sorted(set(df_pairs["Source"]).union(set(df_pairs["Target"])))

    matriz = pd.DataFrame(0, index=nos, columns=nos, dtype=int)

    for linha in df_pairs.itertuples(index=False):
        matriz.loc[str(linha.Source), str(linha.Target)] = int(linha.Frequency)

    return matriz


def infer_output_path(input_file: str) -> str:
    caminho_entrada = Path(input_file)
    stem = caminho_entrada.stem

    if stem.startswith("pares_frequencias_"):
        nome_saida = f"matriz_adjacencia_{stem.removeprefix('pares_frequencias_')}.csv"
    elif stem.startswith("frequencias_pares_"):
        nome_saida = f"matriz_adjacencia_{stem.removeprefix('frequencias_pares_')}.csv"
    else:
        nome_saida = f"matriz_{stem}.csv"

    return str(caminho_entrada.with_name(nome_saida))


def export_adjacency_matrix(matrix_df: pd.DataFrame, output_file: str) -> None:
    caminho_saida = Path(output_file)
    matrix_df.to_csv(caminho_saida, encoding="utf-8")


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print("Uso: python 05_matriz_adjacencia.py <input_pairs_csv> [output_matrix_csv]")
        return 1

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) == 3 else infer_output_path(input_file)

    try:
        df_pairs = load_pair_frequencies(input_file)
        df_pairs_agregado = aggregate_pair_frequencies(df_pairs)
        matrix_df = build_adjacency_matrix(df_pairs_agregado)
        export_adjacency_matrix(matrix_df, output_file)
    except (FileNotFoundError, ValueError, OSError) as exc:
        print(exc)
        return 1

    total_nos = len(matrix_df.index)
    total_arestas = int((matrix_df > 0).sum().sum())
    soma_frequencias = int(df_pairs_agregado["Frequency"].sum())

    print(f"Ficheiro lido: {input_file}")
    print(f"Ficheiro gerado: {output_file}")
    print(f"Numero total de nos: {total_nos}")
    print(f"Dimensao da matriz: {matrix_df.shape[0]} x {matrix_df.shape[1]}")
    print(f"Numero de arestas com peso > 0: {total_arestas}")
    print(f"Soma total das frequencias: {soma_frequencias}")

    print("\nTop 5 transicoes mais fortes:")
    for linha in df_pairs_agregado.head(5).itertuples(index=False):
        print(f"{linha.Source} -> {linha.Target} = {linha.Frequency}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
