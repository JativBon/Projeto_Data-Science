from collections import Counter
from pathlib import Path
import csv
import sys


def load_sequences(file_path: str) -> list[list[str]]:
    caminho = Path(file_path)
    if not caminho.exists():
        sugestoes = sorted(
            ficheiro.name
            for ficheiro in caminho.parent.glob("sequencias_dataset*.txt")
            if ficheiro.is_file()
        )
        mensagem = f"Ficheiro nao encontrado: {caminho}"
        if sugestoes:
            mensagem += f". Ficheiros disponiveis: {', '.join(sugestoes)}"
        raise FileNotFoundError(mensagem)

    sequencias: list[list[str]] = []

    with caminho.open("r", encoding="utf-8") as ficheiro:
        for numero_linha, linha in enumerate(ficheiro, start=1):
            conteudo = linha.strip()
            if not conteudo:
                continue

            eventos = conteudo.split()
            if not eventos:
                print(f"Aviso: linha {numero_linha} ignorada por nao conter eventos validos.")
                continue

            sequencias.append(eventos)

    return sequencias


def generate_pairs(sequences: list[list[str]]) -> list[tuple[str, str]]:
    pares: list[tuple[str, str]] = []

    for sequencia in sequences:
        if len(sequencia) < 2:
            continue

        for indice in range(len(sequencia) - 1):
            pares.append((sequencia[indice], sequencia[indice + 1]))

    return pares


def count_frequencies(pairs: list[tuple[str, str]]) -> Counter[tuple[str, str]]:
    return Counter(pairs)


def infer_output_path(input_path: str) -> str:
    caminho_entrada = Path(input_path)
    stem = caminho_entrada.stem

    if stem.startswith("sequencias_"):
        nome_saida = f"pares_frequencias_{stem.removeprefix('sequencias_')}.csv"
    else:
        nome_saida = f"pares_frequencias_{stem}.csv"

    return str(caminho_entrada.with_name(nome_saida))


def export_csv(freq_dict: Counter[tuple[str, str]], output_path: str = "pares_frequencias.csv") -> None:
    caminho_saida = Path(output_path)

    with caminho_saida.open("w", encoding="utf-8", newline="") as ficheiro_csv:
        writer = csv.writer(ficheiro_csv)
        writer.writerow(["Source", "Target", "Frequency"])

        for (source, target), frequency in freq_dict.most_common():
            writer.writerow([source, target, frequency])


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print("Uso: python 04_pairs.py <input_txt> [output_csv]")
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) == 3 else infer_output_path(input_path)

    try:
        sequences = load_sequences(input_path)
    except FileNotFoundError as exc:
        print(exc)
        return 1
    except OSError as exc:
        print(f"Erro ao ler o ficheiro de entrada: {exc}")
        return 1

    sequencias_validas = [sequencia for sequencia in sequences if len(sequencia) >= 2]
    sequencias_ignoradas = len(sequences) - len(sequencias_validas)

    pairs = generate_pairs(sequences)
    freq_dict = count_frequencies(pairs)

    try:
        export_csv(freq_dict, output_path)
    except OSError as exc:
        print(f"Erro ao escrever o ficheiro CSV: {exc}")
        return 1

    print(f"Ficheiro lido: {input_path}")
    print(f"Ficheiro gerado: {output_path}")
    print(f"Total de sequencias processadas: {len(sequences)}")
    print(f"Sequencias validas para pares: {len(sequencias_validas)}")
    print(f"Sequencias ignoradas (tamanho < 2): {sequencias_ignoradas}")
    print(f"Total de pares gerados: {len(pairs)}")
    print(f"Numero de pares unicos: {len(freq_dict)}")

    print("\nTop 5 pares mais frequentes:")
    for (source, target), frequency in freq_dict.most_common(5):
        print(f"{source} -> {target} = {frequency}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
