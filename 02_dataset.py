# Ler ficheiro dataset 02.txt e reconstruir sequências por case_id
import pandas as pd

registos = []
cabecalho = None

with open("dataset 02.txt", "r", encoding="utf-8") as f:
    for linha in f:
        linha = linha.strip()
        if not linha:
            continue

        partes = linha.split()

        if partes[0] == "p":
            cabecalho = partes
        elif partes[0] == "e":
            # Estrutura esperada: e case_id ordem evento flag
            case_id = partes[1]
            ordem = int(partes[2])
            evento = partes[3]
            flag = partes[4] if len(partes) > 4 else None

            registos.append({
                "Case ID": case_id,
                "Order": ordem,
                "Event": evento,
                "Flag": flag
            })

print("Leitura concluida: dataset 02.txt")
print(f"Cabeçalho encontrado: {cabecalho}")
print(f"Total de eventos lidos: {len(registos)}")

df_02 = pd.DataFrame(registos)

# Ordenar por caso e ordem
df_02 = df_02.sort_values(by=["Case ID", "Order"])

print("\nPrimeiros 5 eventos:")
print(df_02.head())

# Criar sequências por caso
sequencias_02 = df_02.groupby("Case ID")["Event"].apply(list)

print("\nExemplo de sequências:")
print(sequencias_02.head())

# Remover sequências demasiado curtas
sequencias_02 = sequencias_02[sequencias_02.apply(len) > 1]

print(f"\nTotal de sequências válidas: {len(sequencias_02)}")

# Estatísticas simples
tamanhos_02 = sequencias_02.apply(len)
print(f"Tamanho médio das sequências: {tamanhos_02.mean():.2f}")
print(f"Tamanho mínimo: {tamanhos_02.min()}")
print(f"Tamanho máximo: {tamanhos_02.max()}")

# Converter para lista final
sequencias_final_02 = sequencias_02.tolist()

print("\nExemplo da lista final de sequências:")
print(sequencias_final_02[:5])

# Guardar em CSV
df_seq_02 = sequencias_02.reset_index()
df_seq_02.columns = ["Case ID", "Sequence"]
df_seq_02.to_csv("sequencias_dataset02.csv", index=False)

# Guardar em TXT
with open("sequencias_dataset02_limpo.txt", "w", encoding="utf-8") as f:
    for seq in sequencias_02:
        f.write(" ".join(seq) + "\n")

print("\nFicheiros gerados com sucesso: sequencias_dataset02.csv e sequencias_dataset02_limpo.txt")