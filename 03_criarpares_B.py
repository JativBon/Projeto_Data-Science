#Ler ficheiro excel dataset 03.xlsx e mostrar informação básica sobre os dados

import pandas as pd

# Ler o ficheiro Excel
df = pd.read_excel("dataset 03.xlsx")
print("Leitura concluida: dataset 03.xlsx")
print(f"Registos carregados: {len(df)}")
print(f"Colunas encontradas: {list(df.columns)}")

# Remove colunas auxiliares criadas pelo Excel (ex.: Unnamed: 1)
unnamed_cols = [col for col in df.columns if str(col).startswith("Unnamed")]
if unnamed_cols:
	df = df.drop(columns=unnamed_cols)
	print(f"Colunas removidas: {unnamed_cols}")

# Garantir que Order Date está no tipo datetime antes de ordenar
df["Order Date"] = pd.to_datetime(df["Order Date"], errors="coerce")
datas_invalidas = df["Order Date"].isna().sum()
if datas_invalidas:
	print(f"Aviso: {datas_invalidas} datas inválidas foram convertidas para NaT")

# Ordenar por cliente e tempo
df = df.sort_values(by=["Customer ID", "Order Date"])

print("\nDados ordenados por Customer ID e Order Date.")
print("Primeiras 5 linhas:")
print(df.head())

# Criar sequências por cliente (utilizar Category como evento)
sequencias = df.groupby("Customer ID")["Category"].apply(list)

print("\nExemplo de sequências:")
print(sequencias.head())

# Função para remover eventos repetidos consecutivos em cada sequência
def remover_repetidos(seq):
    nova = []
    for item in seq:
        if not nova or nova[-1] != item:
            nova.append(item)
    return nova

sequencias = sequencias.apply(remover_repetidos)

# Mostrar sequências após limpeza
print("\nSequências após limpeza de repetidos consecutivos:")
print(sequencias.head())

# Comparação antes e depois para um cliente
sequencias_brutas = df.groupby("Customer ID")["Category"].apply(list)

primeiro_cliente = sequencias.index[0]

print(f"\nCliente exemplo: {primeiro_cliente}")
print("Antes da limpeza:")
print(sequencias_brutas.loc[primeiro_cliente])

print("Depois da limpeza:")
print(sequencias.loc[primeiro_cliente])

# Remover sequências demasiado curtas
sequencias = sequencias[sequencias.apply(len) > 1]

print(f"\nTotal de sequências válidas: {len(sequencias)}")

# Estatísticas simples
tamanhos = sequencias.apply(len)
print(f"Tamanho médio das sequências: {tamanhos.mean():.2f}")
print(f"Tamanho mínimo: {tamanhos.min()}")
print(f"Tamanho máximo: {tamanhos.max()}")

# Converte para lista final
sequencias_final = sequencias.tolist()

print("\nExemplo da lista final de sequências:")
print(sequencias_final[:5])
print(f"Clientes distintos no dataset: {df['Customer ID'].nunique()}")

# Guarda as sequências válidas em CSV
df_seq = sequencias.reset_index()
df_seq.columns = ["Customer ID", "Sequence"]
df_seq.to_csv("sequencias_dataset03.csv", index=False)

print("\nFicheiro gerado com sucesso: sequencias_dataset03.csv")

# Guarda as sequências válidastambém em txt 
with open("sequencias_dataset03.txt", "w", encoding="utf-8") as f:
    for seq in sequencias:
        f.write(" ".join(seq) + "\n")

print("Ficheiro gerado com sucesso: sequencias_dataset03.txt")

# FASE B — Gerar pares A -> B

pares = []

for seq in sequencias:
    for i in range(len(seq) - 1):
        origem = seq[i]
        destino = seq[i + 1]
        pares.append((origem, destino))

print("\nTotal de pares gerados:", len(pares))

print("\nExemplo de pares:")
print(pares[:10])

df_pares = pd.DataFrame(pares, columns=["From", "To"])
df_pares.to_csv("pares_dataset03.csv", index=False)

print("Ficheiro gerado: pares_dataset03.csv")