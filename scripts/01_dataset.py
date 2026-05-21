# Ler ficheiro dataset 01.txt e converter cada linha numa sequencia
from pathlib import Path

import pandas as pd


def ler_linhas_nao_vazias(caminho: Path) -> list[tuple[int, str]]:
    if not caminho.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {caminho}")

    linhas: list[tuple[int, str]] = []

    with caminho.open("r", encoding="utf-8") as ficheiro:
        for numero_linha, linha in enumerate(ficheiro, start=1):
            conteudo = linha.strip()
            if conteudo:
                linhas.append((numero_linha, conteudo))

    if not linhas:
        raise ValueError(f"O ficheiro {caminho.name} nao contem linhas com dados.")

    return linhas


def decidir_primeira_linha(linhas: list[tuple[int, str]]) -> tuple[int, str]:
    primeira_linha = linhas[0][1]
    tokens = primeira_linha.split()

    if len(tokens) == 1 and tokens[0].isdigit():
        contador = int(tokens[0])
        if contador == len(linhas) - 1:
            return 1, (
                "Primeira linha interpretada como contador de sequencias, "
                "porque contem apenas um numero igual ao total de linhas seguintes."
            )

    if not all(token.isdigit() for token in tokens):
        return 1, (
            "Primeira linha interpretada como cabecalho textual, "
            "porque contem valores nao numericos."
        )

    return 0, (
        "Primeira linha mantida como dados, porque segue o mesmo formato numerico "
        "das restantes sequencias."
    )


CSV_DIR = Path("data/csv")
PROCESSED_DIR = Path("data/processed")
CSV_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

caminho_dataset = Path("data/raw/dataset 01.txt")
linhas_lidas = ler_linhas_nao_vazias(caminho_dataset)

print("Leitura concluida: dataset 01.txt")
print(f"Total de linhas lidas (nao vazias): {len(linhas_lidas)}")

inicio_dados, decisao_primeira_linha = decidir_primeira_linha(linhas_lidas)
print(decisao_primeira_linha)
print(f"Primeira linha observada: {linhas_lidas[0][1]}")

linhas_sequencias = linhas_lidas[inicio_dados:]

sequencias_01: list[list[str]] = []
ids_01: list[str] = []
linhas_invalidas: list[tuple[int, str, str]] = []

for numero_linha, linha in linhas_sequencias:
    eventos = linha.split()

    if not eventos:
        linhas_invalidas.append((numero_linha, linha, "linha vazia apos limpeza"))
        continue

    if not all(evento.isdigit() for evento in eventos):
        linhas_invalidas.append((numero_linha, linha, "linha com valores nao numericos"))
        continue

    sequencias_01.append(eventos)

if not sequencias_01:
    raise ValueError("Nenhuma sequencia valida foi encontrada no dataset 01.")

sequencias_curtas = [seq for seq in sequencias_01 if len(seq) < 2]
if sequencias_curtas:
    print(
        f"Aviso: {len(sequencias_curtas)} sequencias com menos de 2 eventos foram removidas."
    )

sequencias_01 = [seq for seq in sequencias_01 if len(seq) > 1]
ids_01 = [f"S{i:03d}" for i in range(1, len(sequencias_01) + 1)]

if not sequencias_01:
    raise ValueError("Nao restaram sequencias validas para exportacao no dataset 01.")

print(f"Total de sequencias validas: {len(sequencias_01)}")
print(f"Total de linhas invalidas: {len(linhas_invalidas)}")

if linhas_invalidas:
    print("Exemplo de linhas invalidas:")
    for numero_linha, linha, motivo in linhas_invalidas[:5]:
        print(f"Linha {numero_linha}: {motivo} -> {linha}")

print("Exemplo de sequencias:")
for i in range(min(5, len(sequencias_01))):
    print(ids_01[i], "->", sequencias_01[i])

# Estatisticas simples
tamanhos_01 = [len(seq) for seq in sequencias_01]
print(f"Tamanho medio das sequencias: {sum(tamanhos_01) / len(tamanhos_01):.2f}")
print(f"Tamanho minimo: {min(tamanhos_01)}")
print(f"Tamanho maximo: {max(tamanhos_01)}")

sequencias_final_01 = sequencias_01
sequencias_serializadas_01 = [" ".join(seq) for seq in sequencias_final_01]

print("\nExemplo da lista final de sequencias:")
print(sequencias_final_01[:5])

# Guardar em CSV
df_seq_01 = pd.DataFrame({
    "Sequence ID": ids_01,
    "Sequence": sequencias_serializadas_01,
})
df_seq_01.to_csv(CSV_DIR / "sequencias_dataset01.csv", index=False)

# Guardar em TXT
with (PROCESSED_DIR / "sequencias_dataset01_limpo.txt").open("w", encoding="utf-8") as ficheiro_saida:
    for seq in sequencias_final_01:
        ficheiro_saida.write(" ".join(seq) + "\n")

print("Ficheiros gerados com sucesso: data/csv/sequencias_dataset01.csv e data/processed/sequencias_dataset01_limpo.txt")
