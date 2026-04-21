# FASES_FRAMEWORK

NOTAS: Este ficheiro serve para acompanhar os testes de implementação fase a fase.
Isto faz sentido porque o artigo de professor Luís Cavique e os textos sobre Ramex apontam para uma lógica de condensação de sequências
em estruturas de rede/grafo e depois extração de padrões mais globais, não logo para uma implementação monolítica.

Portanto, vamos validar ambos os datasets em todas as fases e no final iremos montar tudo numa única Framework.

## 2/04/2026 Validação fase a fase começando por 01_dataset.py

O que foi alterado e porquê

Removemos a assunção fixa de que a primeira linha era cabeçalho e substituimos por uma decisão inferida a partir do conteúdo real.
Mantivemos a intenção original do script: ler o dataset 01, construir sequências, gerar IDs e exportar CSV/TXT.
Adicionámos validação explícita para ficheiro inexistente, ficheiro vazio e linhas não numéricas.
Passámos a registar e reportar linhas inválidas, em vez de as ignorar silenciosamente.
Mantivemos o esquema de saída compatível com o projeto: Sequence ID e Sequence no CSV, e uma sequência por linha no TXT.
Preservámos a lógica simples e académica do projeto, sem introduzir abstrações desnecessárias.

Riscos que ainda permanecem
A regra de inferência da primeira linha é robusta para este dataset real, mas continua heurística, se no futuro surgir um ficheiro com um “cabeçalho” puramente numérico e multi-token, será ambíguo.
O CSV continua a guardar a sequência como representação textual de lista Python, porque isso já é o padrão usado também nos datasets 02 e 03. É compatível com o projeto atual, mas não é o formato mais normalizado para integração automática.
O script assume que os eventos do dataset 01 devem permanecer como strings numéricas. Isso é coerente com o restante projeto, mas convém manter essa convenção quando chegarmos à framework única.

## 04/04/2026 Validar o 02_dataset.py para estar em linha com o 01_dataset.py

O que foi alterado e porquê
Passei a ler Case ID, Order e Flag como inteiros.

Motivo: evitar ordenação lexicográfica incorreta e garantir consistência temporal real.
Mantive Event como string numérica.

Motivo: preservar compatibilidade com o formato usado nos outputs dos datasets 01 e 03.
Adicionei parsing robusto da linha p.

Motivo: distinguir cabeçalho válido, cabeçalhos duplicados e cabeçalhos malformados.
Adicionei validação estrutural das linhas e.

Motivo: apanhar linhas com campos a menos, a mais, ou com valores não numéricos.
Adicionei validação por caso para:

ordens menores que 1;
ordens duplicadas;
lacunas na sequência de Order.
Motivo: garantir que a sequência reconstruída pode ser usada com segurança nas fases seguintes.
Corrigi a ordenação para ser numérica e estável.

Motivo: o bug mais relevante do script atual era a ordem errada dos casos no output.
Mantive os mesmos ficheiros de saída:

sequencias_dataset02.csv
sequencias_dataset02_limpo.txt
Motivo: não quebrar compatibilidade com o resto do projeto.
Riscos remanescentes
O significado exato de meta_1 = 40 no cabeçalho p 40 289 continua ambíguo. Sabemos que não é o número de casos reais, mas não é possível inferir com segurança o seu papel só a partir deste ficheiro.
O campo Flag é sempre 1 neste dataset real. Se noutro ficheiro da mesma família esse campo passar a variar, será preciso decidir se influencia ou não a reconstrução das sequências.
O CSV continua a guardar a sequência como lista textual Python, porque esse já é o padrão do projeto. É compatível agora, mas na futura framework poderá valer a pena normalizar melhor a serialização.

## 04/04/2026 - Validar os dataset para normalização por dataset dos diferentes dados (01_dataset.py, 02_dataset.py e 03_dataset.py)

Os três scripts já estavam corretos no parsing específico dos seus datasets, mas ainda não estavam homogéneos no contrato de saída.

Leitura do estado atual
01_dataset.py

Como ficou "python 01_dataset.py":

leu 10 000 linhas não vazias;
concluiu que a primeira linha não é cabeçalho e faz parte dos dados;
gerou 10 000 sequências válidas;
0 linhas inválidas;
comprimentos das sequências parecem coerentes.

Isto é um excelente sinal.
O mais importante aqui era validar o pressuposto da primeira linha e pelos logs, a decisão tomada faz sentido.

Como ficou "python 02_dataset.py":

leu corretamente a estrutura do ficheiro;
identificou o cabeçalho ['p', '40', '289'];
leu 289 eventos;
0 linhas inválidas;
reconstruiu 17 sequências válidas com comprimento 17.

Aqui há um ponto importante: o script foi estruturado para não assumir cegamente que 40 era o número de casos. Trata esse valor como metadado auxiliar, o que mostra robustez.

Como ficou "python 03_dataset.py":

leu o Excel;
removeu coluna auxiliar Unnamed: 1;
ordenou por Customer ID e Order Date;
detetou ambiguidades temporais reais;
construiu sequências;
removeu repetidos consecutivos;
gerou 50 sequências válidas.

Os avisos que apareceram aqui são bons sinais:

“mais de um evento na mesma combinação cliente-data”
“categorias diferentes na mesma data”

Isto mostra que o script está a diagnosticar limitações do dataset, em vez de as esconder.

## ANÁLISE COMPARATIVA - Natureza dos Dados

| Dataset    | Tipo de dados     | Significado                        |
| ---------- | ----------------- | ---------------------------------- |
| Dataset 01 | Transações brutas | Dados originais (clientes + tempo) |
| Dataset 02 | Numérico (IDs)    | Eventos identificados              |
| Dataset 03 | Categórico        | Classes de produtos                |

Primeiro ponto chave:

Dataset 02 → baixo nível semântico
Dataset 03 → alto nível semântico

## Problema estrutural (outputs não são homogéneos)

| Característica       | Dataset 02     | Dataset 03           |
| -------------------- | -------------- | -------------------- |
| Tipo de evento       | Numérico (IDs) | Categórico (strings) |
| Semântica            | Baixa          | Alta                 |
| Repetição            | Baixa          | Alta                 |
| Densidade de padrões | Baixa          | Alta                 |

## NOTA IMPORTANTE

Os datasets apresentam naturezas distintas:
o dataset 02 representa eventos identificados (baixa semântica),
enquanto o dataset 03 representa categorias de consumo (alta semântica),
o que influencia diretamente a densidade dos padrões extraídos.

## Transformações aplicadas

| Etapa                          | Dataset 01 → 02 | Dataset 01 → 03  |
| ------------------------------ | --------------- | ---------------- |
| Ordenação temporal             | ✔               | ✔                |
| Agrupamento por cliente        | ✔               | ✔                |
| Conversão de valores           | IDs mantidos    | IDs → categorias |
| Remoção repetidos consecutivos | ❌              | ✔                |

## NOTA

O pipeline NÃO é simétrico
Dataset 03 foi limpo semânticamente
Dataset 02 ficou mais bruto

## 05/04/2026 Criação de pares completa "04_pairs.py"

Testes:
python -m py_compile 04_pairs.py

python 04_pairs.py sequencias_dataset01_limpo.txt pares_frequencias_dataset01.csv
python 04_pairs.py sequencias_dataset02_limpo.txt pares_frequencias_dataset02.csv
python 04_pairs.py sequencias_dataset03.txt pares_frequencias_dataset03.csv

## Visão Global

| Dataset | Seq   | Pares  | Pares únicos | Repetição     |
| ------- | ----- | ------ | ------------ | ------------- |
| 01      | 10000 | 139834 | 38815        |  Média        |
| 02      | 17    | 272    | 272          |  Nenhuma      |
| 03      | 50    | 352    | 12           |  Muito alta   |

## Análise por dataset

## Visão global dos resultados

| Dataset | Seq   | Pares  | Pares únicos | Repetição   |
| ------- | ----- | ------ | ------------ | ----------- |
| 01      | 10000 | 139834 | 38815        | Média       |
| 02      | 17    | 272    | 272          | Nenhuma     |
| 03      | 50    | 352    | 12           | Muito alta  |

## Dataset 01 (massivo / comportamento aleatório controlado)

Pares únicos: 38815
Total pares: 139834

Interpretação
Muitos pares únicos → alta variabilidade
Frequência baixa por par (máx ~15)

Isto indica:
comportamento pouco repetitivo
grafo muito disperso

Leitura + técnica

Este dataset é: tem muito ruído estruturado com padrões fracos

## Dataset 02 (IDs únicos / comportamento linear)

Pares únicos: 272
Total pares: 272

Interpretação
Todos os pares aparecem 1 vez

Isto é extremamente importante: Não há qualquer padrão repetido

Leitura + técnica

Este dataset: tem sequências determinísticas sem repetição

Isto limita fortemente:
análise de padrões
aprendizagem

## Dataset 03 (categorias / comportamento real)

Pares únicos: 12
Total pares: 352

Interpretação
Poucos pares únicos
Frequências muito altas (75, 74, …)

Isto é perfeito

Leitura técnica

Este dataset é: altamente estruturado com padrões fortes

## Mais Importante ainda (vários níveis de complexidade)

| Dataset | Tipo           | Padrões   |
| ------- | -------------- | --------- |
| 02      | Granular (IDs) |  Nenhum   |
| 01      | Semi-aleatório |  Fracos   |
| 03      | Semântico      |  Fortes   |

## Os resultados demonstram que a qualidade e a natureza dos dados influenciam diretamente a capacidade de extração de padrões

Enquanto datasets baseados em identificadores únicos apresentam baixa repetição e consequentemente, reduzida capacidade de generalização, datasets com abstração semântica permitem identificar padrões frequentes e relações significativas entre eventos.

## CONCLUSÃO PARA O RAMEX

Dataset 02

- Grafo ≈ cadeia
- Ramex pouco útil

Dataset 01

- Grafo disperso
- Ramex encontra poucos caminhos relevantes

Dataset 03

- Grafo denso
- Ramex encontra caminhos fortes

## 14/04/2026 Matriz Adjacência (transformar pares em matriz)

Testes
python 05_matriz_adjacencia.py <input_pairs_csv> <output_matrix_csv>

python 05_matriz_adjacencia.py pares_frequencias_dataset01.csv matriz_adjacencia_dataset01.csv
python 05_matriz_adjacencia.py pares_frequencias_dataset02.csv matriz_adjacencia_dataset02.csv
python 05_matriz_adjacencia.py pares_frequencias_dataset03.csv matriz_adjacencia_dataset03.csv

Exemplo com o dataset 03:

Saída validada:

ficheiro lido: pares_frequencias_dataset03.csv
ficheiro gerado: matriz_adjacencia_dataset03_generica.csv
número total de nós: 4
dimensão da matriz: 4 x 4
número de arestas com peso > 0: 12
soma total das frequências: 352
Top 5:

Tecnologia -> Mercearia = 75
Mercearia -> Tecnologia = 74
Limpeza -> Mercearia = 29
Tecnologia -> Higiene = 26
Higiene -> Tecnologia = 24
Confirmação explícita de que funciona para os 3 datasets

Leitura dos 3 testes

Dataset 01
200 nós
200 × 200
38 815 arestas
139 834 transições totais

Isto vai mostrar um grafo muito denso. Como os eventos estão no intervalo 1–200, quase todos os nós participam em muitas transições.
A densidade é muito alta: 38 815 arestas em 40 000 posições possíveis da matriz, ou seja, cerca de 97% das ligações possíveis estão preenchidas.

Interpretação
Este dataset tem:

- muita cobertura do espaço de estados;
- padrões fracos individualmente;
- comportamento quase aleatório, mas com repetição suficiente para gerar frequências.

É bom para mostrar um caso de rede muito conectada, onde os padrões locais existem mas não dominam claramente o sistema.

Dataset 02
281 nós
281 × 281
272 arestas
272 transições totais

Aqui o número de arestas coincide com a soma das frequências, porque todas as frequências são 1. Isso confirma o que já tínhamos visto: não há repetição de pares.

Interpretação
Este dataset produz um grafo:

- muito esparso;
- próximo de cadeias de eventos;
- com fraca capacidade para mineração de padrões frequentes.

É ótimo para sustentar uma conclusão metodológica: quando os eventos são muito específicos e pouco repetidos, a matriz e o grafo existem, mas a extração de conhecimento frequente torna-se limitada.

Dataset 03
4 nós
4 × 4
12 arestas
352 transições totais

Este é o caso mais forte do ponto de vista analítico. Com apenas 4 categorias, temos uma matriz pequena, muito legível e com frequências elevadas.

Interpretação
Este dataset gera:

- uma estrutura muito compacta;
- forte recorrência de padrões;
- excelente legibilidade para grafo e análise tipo Ramex.

É claramente o dataset mais forte para demonstrar valor interpretativo.

## COMPARAÇÃO GLOBAL

| Dataset | Nós | Arestas | Soma freq. | Leitura          |
| ------- | --: | ------: | ---------: | ---------------- |
| 01      | 200 |  38 815 |    139 834 | muito denso      |
| 02      | 281 |     272 |        272 | muito esparso    |
| 03      |   4 |      12 |        352 | compacto e forte |

O que isto prova: Temos agora três comportamentos distintos, o que é ótimo para o relatório:

- Dataset 01: espaço de estados reduzido mas muito explorado;
- Dataset 02: espaço de estados alargado e pouca repetição;
- Dataset 03: espaço de estados pequeno e padrões muito recorrentes.

NOTA: Isto dá-nos uma narrativa muito forte sobre como a natureza da representação dos dados, influência diretamente a estrutura da matriz e a qualidade
dos padrões extraídos.

## NOTA FINAL

A pipeline neste momento está consistente:

01_dataset.py, 02_dataset.py, 03_dataset.py → normalização
04_pairs.py → pares e frequências
05_matriz_adjacencia.py → matriz

no dataset 02, soma das frequências = nº de arestas, confirmando frequência 1;
no dataset 03, poucas arestas e frequência alta, coerente com categorias agregadas;
no dataset 01, grande volume total e grande cobertura, coerente com 10 000 sequências.

DEIXO AINDA 2 OBSERVAÇÕES BASTANTE UTEIS

1 - No relatório, temos que destacar que a matriz de adjacência permite passar de uma visão sequêncial para uma visão relacional/estrutural dos dados.
2 - No dataset 01, como a matriz é quase cheia, o grafo pode ficar visualmente caótico.
Convém no 06_grafo.py prever:

- filtro por frequência mínima;
- top N arestas mais fortes ou ambos.
