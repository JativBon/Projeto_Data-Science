#Ler ficheiro excel dataset 03.xlsx e mostrar informação básica sobre os dados

import pandas as pd
from collections import Counter
import networkx as nx
import matplotlib.pyplot as plt

# FASE A — Ler e processar o dataset para criar sequências por cliente
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
df_seq.to_csv("sequencias_dataset03.csv", index=False, encoding="utf-8")

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
df_pares.to_csv("pares_dataset03.csv", index=False, encoding="utf-8")

print("Ficheiro gerado: pares_dataset03.csv")

# FASE C — Contar frequência dos pares

frequencias = Counter(pares)

print("\nTotal de transições distintas:", len(frequencias))

print("\nTop 10 transições mais frequentes:")
for (origem, destino), freq in frequencias.most_common(10):
    print(f"{origem} -> {destino} = {freq}")

# Guardar frequências em CSV
df_freq = pd.DataFrame(
    [(origem, destino, freq) for (origem, destino), freq in frequencias.items()],
    columns=["From", "To", "Frequency"]
)

df_freq = df_freq.sort_values(by="Frequency", ascending=False)
df_freq.to_csv("frequencias_pares_dataset03.csv", index=False, encoding="utf-8")

print("Ficheiro gerado: frequencias_pares_dataset03.csv")    

# FASE D — Matriz de adjacência

# Obter lista ordenada de todos os eventos únicos
eventos = sorted(set([origem for origem, destino in frequencias.keys()] +
                     [destino for origem, destino in frequencias.keys()]))

# Criar matriz de adjacência com zeros
matriz_adjacencia = pd.DataFrame(0, index=eventos, columns=eventos)

# Preencher matriz com as frequências das transições
for (origem, destino), freq in frequencias.items():
    matriz_adjacencia.loc[origem, destino] = freq

print("\nMatriz de adjacência:")
print(matriz_adjacencia)

# Guardar matriz em CSV
matriz_adjacencia.to_csv("matriz_adjacencia_dataset03.csv", encoding="utf-8")

print("\nFicheiro gerado: matriz_adjacencia_dataset03.csv")

# FASE E — Grafo dirigido ponderado
# =========================

import networkx as nx
import matplotlib.pyplot as plt

# Criar grafo dirigido
G = nx.DiGraph()

# Adicionar arestas com peso
for (origem, destino), freq in frequencias.items():
    G.add_edge(origem, destino, weight=freq)

print("\nNós do grafo:")
print(list(G.nodes()))

print("\nArestas do grafo com pesos:")
for origem, destino, dados in G.edges(data=True):
    print(f"{origem} -> {destino} = {dados['weight']}")

# Desenhar grafo
plt.figure(figsize=(10, 8))
pos = nx.spring_layout(G, seed=42)

nx.draw(
    G,
    pos,
    with_labels=True,
    node_size=3000,
    font_size=10,
    arrows=True
)

# Labels dos pesos
edge_labels = nx.get_edge_attributes(G, "weight")
nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=9)

plt.title("Grafo dirigido ponderado - Dataset 03")
plt.tight_layout()
plt.savefig("grafo_dataset03.png", dpi=300)
plt.show()

print("\nFicheiro gerado: grafo_dataset03.png")

# Grafo filtrado - apenas transições fortes
G_forte = nx.DiGraph()

limiar = 20

for (origem, destino), freq in frequencias.items():
    if freq >= limiar:
        G_forte.add_edge(origem, destino, weight=freq)

plt.figure(figsize=(10, 8))
pos = nx.spring_layout(G_forte, seed=42)

nx.draw(
    G_forte,
    pos,
    with_labels=True,
    node_size=3000,
    font_size=10,
    arrows=True
)

edge_labels = nx.get_edge_attributes(G_forte, "weight")
nx.draw_networkx_edge_labels(G_forte, pos, edge_labels=edge_labels, font_size=9)

plt.title(f"Grafo filtrado - transições com frequência >= {limiar}")
plt.tight_layout()
plt.savefig("grafo_dataset03_filtrado.png", dpi=300)
plt.show()

print("Ficheiro gerado: grafo_dataset03_filtrado.png")

# FASE F — Estrutura principal (Ramex simplificado)

# Criar grafo dirigido completo com pesos
G = nx.DiGraph()
for (origem, destino), freq in frequencias.items():
    G.add_edge(origem, destino, weight=freq)

# Escolher raiz: nó com maior soma dos pesos de saída
soma_saida = {}
for no in G.nodes():
    soma_saida[no] = sum(dados["weight"] for _, _, dados in G.out_edges(no, data=True))

raiz = max(soma_saida, key=soma_saida.get)

print(f"\nRaiz escolhida para o Ramex simplificado: {raiz}")
print("Soma dos pesos de saída por nó:")
for no, valor in soma_saida.items():
    print(f"{no}: {valor}")

# Heurística Forward
G_ramex = nx.DiGraph()
visitados = set([raiz])
G_ramex.add_node(raiz)

while len(visitados) < len(G.nodes()):
    melhor_aresta = None
    melhor_peso = -1

    for origem in visitados:
        for _, destino, dados in G.out_edges(origem, data=True):
            if destino not in visitados:
                peso = dados["weight"]
                if peso > melhor_peso:
                    melhor_peso = peso
                    melhor_aresta = (origem, destino, peso)

    # se não houver saída para nós não visitados, termina
    if melhor_aresta is None:
        break

    origem, destino, peso = melhor_aresta
    G_ramex.add_edge(origem, destino, weight=peso)
    visitados.add(destino)

print("\nArestas escolhidas pelo Ramex simplificado:")
for origem, destino, dados in G_ramex.edges(data=True):
    print(f"{origem} -> {destino} = {dados['weight']}")

# Desenhar grafo
plt.figure(figsize=(10, 8))
pos = nx.spring_layout(G_ramex, seed=42)

nx.draw(
    G_ramex,
    pos,
    with_labels=True,
    node_size=3000,
    font_size=10,
    arrows=True
)

edge_labels = nx.get_edge_attributes(G_ramex, "weight")
nx.draw_networkx_edge_labels(G_ramex, pos, edge_labels=edge_labels, font_size=10)

plt.title("Ramex simplificado - Forward Heuristic")
plt.savefig("grafo_ramex_simplificado_forward.png", dpi=300, bbox_inches="tight")
plt.show()

print("\nFicheiro gerado: grafo_ramex_simplificado_forward.png")