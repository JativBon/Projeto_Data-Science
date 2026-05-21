# Ler ficheiro dataset 02.txt e reconstruir sequencias por case_id
from pathlib import Path
from typing import TypedDict, cast

import pandas as pd


class CabecalhoDataset02(TypedDict):
    raw: list[str]
    meta_1: int
    meta_2: int


RegistoDataset02 = TypedDict(
    "RegistoDataset02",
    {"Case ID": int, "Order": int, "Event": str, "Flag": int},
)


def ler_dataset_02(caminho: Path) -> tuple[CabecalhoDataset02, list[RegistoDataset02], list[tuple[int, str, str]]]:
    if not caminho.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {caminho}")

    registos: list[RegistoDataset02] = []
    linhas_invalidas: list[tuple[int, str, str]] = []
    cabecalho: CabecalhoDataset02 | None = None

    with caminho.open("r", encoding="utf-8") as ficheiro:
        for numero_linha, linha in enumerate(ficheiro, start=1):
            conteudo = linha.strip()
            if not conteudo:
                continue

            partes = conteudo.split()
            tipo_linha = partes[0]

            if tipo_linha == "p":
                if cabecalho is not None:
                    linhas_invalidas.append((numero_linha, conteudo, "cabecalho adicional encontrado"))
                    continue

                if len(partes) != 3 or not partes[1].isdigit() or not partes[2].isdigit():
                    linhas_invalidas.append((numero_linha, conteudo, "cabecalho p malformado"))
                    continue

                cabecalho = {
                    "raw": partes,
                    "meta_1": int(partes[1]),
                    "meta_2": int(partes[2]),
                }
                continue

            if tipo_linha == "e":
                if len(partes) != 5:
                    linhas_invalidas.append((numero_linha, conteudo, "linha e malformada"))
                    continue

                case_id, ordem, evento, flag = partes[1:5]

                if not (case_id.isdigit() and ordem.isdigit() and evento.isdigit() and flag.isdigit()):
                    linhas_invalidas.append((numero_linha, conteudo, "linha e com valores nao numericos"))
                    continue

                registos.append({
                    "Case ID": int(case_id),
                    "Order": int(ordem),
                    "Event": evento,
                    "Flag": int(flag),
                })
                continue

            linhas_invalidas.append((numero_linha, conteudo, "tipo de linha desconhecido"))

    if cabecalho is None:
        raise ValueError("Nao foi encontrada nenhuma linha de cabecalho iniciada por 'p'.")

    if not registos:
        raise ValueError("Nao foi encontrado nenhum evento valido no dataset 02.")

    return cabecalho, registos, linhas_invalidas


def validar_consistencia(df_eventos: pd.DataFrame) -> tuple[list[int], list[int], list[int]]:
    casos_ordem_invalida: list[int] = []
    casos_ordem_duplicada: list[int] = []
    casos_com_lacunas: list[int] = []

    for case_id, grupo in df_eventos.groupby("Case ID", sort=True):
        case_id_int = int(str(case_id))
        ordens = [int(cast(int | str, ordem)) for ordem in grupo["Order"].tolist()]

        if any(ordem < 1 for ordem in ordens):
            casos_ordem_invalida.append(case_id_int)

        if len(ordens) != len(set(ordens)):
            casos_ordem_duplicada.append(case_id_int)

        ordens_esperadas = list(range(min(ordens), max(ordens) + 1))
        if ordens != ordens_esperadas:
            casos_com_lacunas.append(case_id_int)

    return casos_ordem_invalida, casos_ordem_duplicada, casos_com_lacunas


CSV_DIR = Path("data/csv")
PROCESSED_DIR = Path("data/processed")
CSV_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

caminho_dataset = Path("data/raw/dataset 02.txt")
cabecalho, registos, linhas_invalidas = ler_dataset_02(caminho_dataset)

print("Leitura concluida: dataset 02.txt")
print(f"Cabecalho encontrado: {cabecalho['raw']}")
print(f"Total de eventos lidos: {len(registos)}")
print(f"Total de linhas invalidas: {len(linhas_invalidas)}")

if linhas_invalidas:
    print("Exemplo de linhas invalidas:")
    for numero_linha, linha, motivo in linhas_invalidas[:5]:
        print(f"Linha {numero_linha}: {motivo} -> {linha}")

df_02 = pd.DataFrame(registos)

# Ordenar por caso e ordem numerica
df_02 = df_02.sort_values(by=["Case ID", "Order"], kind="stable").reset_index(drop=True)

casos_ordem_invalida, casos_ordem_duplicada, casos_com_lacunas = validar_consistencia(df_02)

print("\nPrimeiros 5 eventos:")
print(df_02.head())

print(
    "\nInterpretacao do cabecalho: linha de metadados; "
    f"meta_2={cabecalho['meta_2']} coincide com o total de eventos lidos."
)

if cabecalho["meta_2"] != len(df_02):
    print("Aviso: o valor meta_2 do cabecalho nao coincide com o total de eventos lidos.")

if cabecalho["meta_1"] != df_02["Case ID"].nunique():
    print(
        "Aviso: o valor meta_1 do cabecalho nao coincide com o numero real de casos; "
        "sera tratado apenas como metadado auxiliar."
    )

if casos_ordem_invalida:
    print(f"Aviso: casos com ordens inferiores a 1: {casos_ordem_invalida}")

if casos_ordem_duplicada:
    print(f"Aviso: casos com ordens duplicadas: {casos_ordem_duplicada}")

if casos_com_lacunas:
    print(f"Aviso: casos com lacunas na sequencia de ordens: {casos_com_lacunas}")

# Criar sequencias por caso
sequencias_02 = df_02.groupby("Case ID", sort=False)["Event"].apply(list)

print("\nExemplo de sequencias:")
print(sequencias_02.head())

# Remover sequencias demasiado curtas
sequencias_curtas = sequencias_02[sequencias_02.apply(len) < 2]
if not sequencias_curtas.empty:
    print(
        f"\nAviso: {len(sequencias_curtas)} sequencias com menos de 2 eventos foram removidas."
    )

sequencias_02 = sequencias_02[sequencias_02.apply(len) > 1]

print(f"\nTotal de sequencias validas: {len(sequencias_02)}")

# Estatisticas simples
tamanhos_02 = sequencias_02.apply(len)
print(f"Tamanho medio das sequencias: {tamanhos_02.mean():.2f}")
print(f"Tamanho minimo: {tamanhos_02.min()}")
print(f"Tamanho maximo: {tamanhos_02.max()}")

# Converter para lista final
sequencias_final_02 = sequencias_02.tolist()
ids_02 = [f"S{i:03d}" for i in range(1, len(sequencias_final_02) + 1)]
sequencias_serializadas_02 = [" ".join(seq) for seq in sequencias_final_02]

print("\nExemplo da lista final de sequencias:")
print(sequencias_final_02[:5])

# Guardar em CSV
df_seq_02 = pd.DataFrame({
    "Sequence ID": ids_02,
    "Sequence": sequencias_serializadas_02,
})
df_seq_02.to_csv(CSV_DIR / "sequencias_dataset02.csv", index=False)

# Guardar em TXT
with (PROCESSED_DIR / "sequencias_dataset02_limpo.txt").open("w", encoding="utf-8") as ficheiro_saida:
    for seq in sequencias_final_02:
        ficheiro_saida.write(" ".join(seq) + "\n")

print("\nFicheiros gerados com sucesso: data/csv/sequencias_dataset02.csv e data/processed/sequencias_dataset02_limpo.txt")
