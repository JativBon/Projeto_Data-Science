# Ler ficheiro dataset 01.txt e converter cada linha numa sequência
import pandas as pd

with open("dataset 01.txt", "r", encoding="utf-8") as f:
    linhas = [linha.strip() for linha in f if linha.strip()]

print("Leitura concluida: dataset 01.txt")
print(f"Total de linhas lidas: {len(linhas)}")

# A primeira linha parece indicar o número de sequências
cabecalho = linhas[0]
print(f"Primeira linha (cabecalho): {cabecalho}")

# As restantes linhas são tratadas como sequências
linhas_sequencias = linhas[1:]

sequencias_01 = []
ids_01 = []

for i, linha in enumerate(linhas_sequencias, start=1):
    eventos = linha.split()
    if len(eventos) > 1:
        ids_01.append(f"S{i:03d}")
        sequencias_01.append(eventos)

print(f"Total de sequências válidas: {len(sequencias_01)}")
print("Exemplo de sequências:")
for i in range(min(5, len(sequencias_01))):
    print(ids_01[i], "->", sequencias_01[i])

# Estatísticas simples
tamanhos_01 = [len(seq) for seq in sequencias_01]
print(f"Tamanho médio das sequências: {sum(tamanhos_01)/len(tamanhos_01):.2f}")
print(f"Tamanho mínimo: {min(tamanhos_01)}")
print(f"Tamanho máximo: {max(tamanhos_01)}")

# Guardar em CSV
df_seq_01 = pd.DataFrame({
    "Sequence ID": ids_01,
    "Sequence": sequencias_01
})
df_seq_01.to_csv("sequencias_dataset01.csv", index=False)

# Guardar em TXT
with open("sequencias_dataset01_limpo.txt", "w", encoding="utf-8") as f:
    for seq in sequencias_01:
        f.write(" ".join(seq) + "\n")

print("Ficheiros gerados com sucesso: sequencias_dataset01.csv e sequencias_dataset01_limpo.txt")