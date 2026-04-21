# Ler ficheiro excel dataset 03.xlsx e mostrar informacao basica sobre os dados

from math import isnan
from pathlib import Path

import pandas as pd


COLUNAS_OBRIGATORIAS = ["Customer ID", "Order Date", "Category"]


# Funcao para remover eventos repetidos consecutivos em cada sequencia
def remover_repetidos(seq):
    nova = []
    for item in seq:
        if not nova or nova[-1] != item:
            nova.append(item)
    return nova


def normalizar_valor_texto(valor: object) -> str | None:
    if valor is None or valor is pd.NA or valor is pd.NaT:
        return None

    if isinstance(valor, str):
        valor_limpo = valor.strip()
        return valor_limpo or None

    if isinstance(valor, float) and isnan(valor):
        return None

    return str(valor).strip() or None


def ler_dataset_excel(caminho: Path) -> pd.DataFrame:
    if not caminho.exists():
        raise FileNotFoundError(f"Ficheiro nao encontrado: {caminho}")

    try:
        return pd.read_excel(caminho)
    except ImportError as exc:
        raise ImportError(
            "Nao foi possivel ler o ficheiro Excel. Instale a dependencia 'openpyxl'."
        ) from exc


def normalizar_texto_essencial(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for coluna in ["Customer ID", "Category"]:
        df[coluna] = df[coluna].apply(normalizar_valor_texto)

    return df


# Ler o ficheiro Excel
caminho_dataset = Path("dataset 03.xlsx")
df = ler_dataset_excel(caminho_dataset)

print("Leitura concluida: dataset 03.xlsx")
print(f"Registos carregados: {len(df)}")
print(f"Colunas encontradas: {list(df.columns)}")

# Remove colunas auxiliares criadas pelo Excel (ex.: Unnamed: 1)
unnamed_cols = [col for col in df.columns if str(col).startswith("Unnamed")]
if unnamed_cols:
    df = df.drop(columns=unnamed_cols)
    print(f"Colunas removidas: {unnamed_cols}")

colunas_em_falta = [col for col in COLUNAS_OBRIGATORIAS if col not in df.columns]
if colunas_em_falta:
    raise ValueError(f"Colunas obrigatorias em falta no dataset 03: {colunas_em_falta}")

df = normalizar_texto_essencial(df)

# Garantir que Order Date esta no tipo datetime antes de ordenar
df["Order Date"] = pd.to_datetime(df["Order Date"], errors="coerce")

datas_invalidas = int(df["Order Date"].isna().sum())
customers_invalidos = int(df["Customer ID"].isna().sum())
categorias_invalidas = int(df["Category"].isna().sum())

if datas_invalidas:
    print(f"Aviso: {datas_invalidas} datas invalidas foram convertidas para NaT")

if customers_invalidos:
    print(f"Aviso: {customers_invalidos} registos sem Customer ID valido foram encontrados")

if categorias_invalidas:
    print(f"Aviso: {categorias_invalidas} registos sem Category valida foram encontrados")

linhas_invalidas = df[COLUNAS_OBRIGATORIAS].isna().any(axis=1)
total_invalidas = int(linhas_invalidas.sum())

if total_invalidas:
    print(
        f"Aviso: {total_invalidas} registos sem dados essenciais foram removidos "
        "antes de construir as sequencias."
    )

df = df.loc[~linhas_invalidas].copy()

if df.empty:
    raise ValueError("Nao restaram registos validos apos a limpeza do dataset 03.")

df["_source_order"] = range(len(df))

# Ordenar por cliente e tempo, preservando a ordem original em empates na mesma data
df = df.sort_values(by=["Customer ID", "Order Date", "_source_order"], kind="stable")

eventos_mesmo_dia = (
    df.groupby(["Customer ID", "Order Date"])
    .agg(total_eventos=("Category", "size"), categorias_distintas=("Category", "nunique"))
    .reset_index()
)

empates_mesmo_dia = eventos_mesmo_dia[eventos_mesmo_dia["total_eventos"] > 1]
empates_categorias_distintas = empates_mesmo_dia[empates_mesmo_dia["categorias_distintas"] > 1]

if not empates_mesmo_dia.empty:
    print(
        f"Aviso: {len(empates_mesmo_dia)} combinacoes cliente-data tem mais de um evento; "
        "a ordem relativa foi mantida pela ordem original do ficheiro."
    )

if not empates_categorias_distintas.empty:
    print(
        f"Aviso: {len(empates_categorias_distintas)} combinacoes cliente-data tem categorias diferentes "
        "na mesma data, o que introduz ambiguidade temporal ao nivel do dia."
    )

print("\nDados ordenados por Customer ID e Order Date.")
print("Primeiras 5 linhas:")
print(df.drop(columns="_source_order").head())

# Criar sequencias por cliente (utilizar Category como evento)
sequencias_brutas = df.groupby("Customer ID", sort=False)["Category"].apply(list)

print("\nExemplo de sequencias:")
print(sequencias_brutas.head())

sequencias = sequencias_brutas.apply(remover_repetidos)
clientes_com_limpeza = int((sequencias_brutas != sequencias).sum())

# Mostrar sequencias apos limpeza
print("\nSequencias apos limpeza de repetidos consecutivos:")
print(sequencias.head())

print(f"\nClientes com repetidos consecutivos removidos: {clientes_com_limpeza}")

# Comparacao antes e depois para um cliente
primeiro_cliente = sequencias.index[0]

print(f"\nCliente exemplo: {primeiro_cliente}")
print("Antes da limpeza:")
print(sequencias_brutas.loc[primeiro_cliente])

print("Depois da limpeza:")
print(sequencias.loc[primeiro_cliente])

# Remover sequencias demasiado curtas
sequencias_curtas = sequencias[sequencias.apply(len) <= 1]
if not sequencias_curtas.empty:
    print(
        f"\nAviso: {len(sequencias_curtas)} sequencias com menos de 2 eventos foram removidas."
    )

sequencias = sequencias[sequencias.apply(len) > 1]

if sequencias.empty:
    raise ValueError("Nao restaram sequencias validas para exportacao no dataset 03.")

print(f"\nTotal de sequencias validas: {len(sequencias)}")

# Estatisticas simples
tamanhos = sequencias.apply(len)
print(f"Tamanho medio das sequencias: {tamanhos.mean():.2f}")
print(f"Tamanho minimo: {tamanhos.min()}")
print(f"Tamanho maximo: {tamanhos.max()}")

# Converte para lista final
sequencias_final = sequencias.tolist()
ids_03 = [f"S{i:03d}" for i in range(1, len(sequencias_final) + 1)]
sequencias_serializadas_03 = [" ".join(seq) for seq in sequencias_final]

print("\nExemplo da lista final de sequencias:")
print(sequencias_final[:5])
print(f"Clientes distintos no dataset validado: {df['Customer ID'].nunique()}")

# Guarda as sequencias validas em CSV
df_seq = pd.DataFrame({
    "Sequence ID": ids_03,
    "Sequence": sequencias_serializadas_03,
})
df_seq.to_csv("sequencias_dataset03.csv", index=False)

print("\nFicheiro gerado com sucesso: sequencias_dataset03.csv")

# Guarda as sequencias validas tambem em txt
with open("sequencias_dataset03.txt", "w", encoding="utf-8") as ficheiro_saida:
    for seq in sequencias:
        ficheiro_saida.write(" ".join(seq) + "\n")

print("Ficheiro gerado com sucesso: sequencias_dataset03.txt")
