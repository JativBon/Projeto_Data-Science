from pathlib import Path
import sys

import pandas as pd


COLUNAS_OBRIGATORIAS = ["Source", "Target", "Frequency"]


def load_pair_frequencies(file_path: str) -> pd.DataFrame:
    caminho = Path(file_path)
    if not caminho.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {caminho}")

    try:
        df_pairs = pd.read_csv(caminho)
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


def build_adjacency_matrix(df_pairs: pd.DataFrame) -> pd.DataFrame:
    nos = sorted(set(df_pairs["Source"]).union(set(df_pairs["Target"])))

    matriz = pd.DataFrame(0, index=nos, columns=nos, dtype=int)

    for _, linha in df_pairs.iterrows():
        source = str(linha["Source"])
        target = str(linha["Target"])
        frequency = int(linha["Frequency"])
        matriz.loc[source, target] = frequency

    return matriz


def export_adjacency_matrix(matrix_df: pd.DataFrame, output_file: str) -> None:
    caminho_saida = Path(output_file)
    matrix_df.to_csv(caminho_saida, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print("Uso: python 05_matriz_adjacencia.py <input_pairs_csv> <output_matrix_csv>")
        return 1

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    try:
        df_pairs = load_pair_frequencies(input_file)
        matrix_df = build_adjacency_matrix(df_pairs)
        export_adjacency_matrix(matrix_df, output_file)
    except (FileNotFoundError, ValueError, OSError) as exc:
        print(exc)
        return 1

    total_nos = len(matrix_df.index)
    total_arestas = int((matrix_df > 0).sum().sum())
    soma_frequencias = int(df_pairs["Frequency"].sum())

    print(f"Ficheiro lido: {input_file}")
    print(f"Ficheiro gerado: {output_file}")
    print(f"Numero total de nos: {total_nos}")
    print(f"Dimensao da matriz: {matrix_df.shape[0]} x {matrix_df.shape[1]}")
    print(f"Numero de arestas com peso > 0: {total_arestas}")
    print(f"Soma total das frequencias: {soma_frequencias}")

    print("\nTop 5 transicoes mais fortes:")
    for linha in df_pairs.sort_values(by="Frequency", ascending=False).head(5).itertuples(index=False):
        print(f"{linha.Source} -> {linha.Target} = {linha.Frequency}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
