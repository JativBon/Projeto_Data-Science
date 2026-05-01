# FASES_FRAMEWORK

Este ficheiro regista os testes, decisões e resultados técnicos por fase.
A abordagem segue a lógica RAMEX descrita por Luís Cavique: condensar sequências em estruturas de rede/grafo e extrair padrões globais de forma incremental.

A validação é feita por fases, com comparação entre datasets antes da integração final.

## 2/04/2026 Validação fase a fase começando por 01_dataset.py

O que foi alterado e porquê

Removemos a assunção fixa de que a primeira linha era cabeçalho e substituímos por uma decisão inferida a partir do conteúdo real.
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

Resultado: a decisão sobre a primeira linha é coerente com os logs.

Como ficou "python 02_dataset.py":

leu corretamente a estrutura do ficheiro;
identificou o cabeçalho ['p', '40', '289'];
leu 289 eventos;
0 linhas inválidas;
reconstruiu 17 sequências válidas com comprimento 17.

Decisão técnica: o valor 40 é tratado como metadado auxiliar, não como número de casos.

Como ficou "python 03_dataset.py":

leu o Excel;
removeu coluna auxiliar Unnamed: 1;
ordenou por Customer ID e Order Date;
detetou ambiguidades temporais reais;
construiu sequências;
removeu repetidos consecutivos;
gerou 50 sequências válidas.

Observação: os avisos reportam limitações reais do dataset:

“mais de um evento na mesma combinação cliente-data”
“categorias diferentes na mesma data”

O script reporta limitações do dataset em vez de as omitir.

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

## Observações

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

## Observação

O pipeline NÃO é simétrico
Dataset 03 foi limpo semanticamente
Dataset 02 ficou mais bruto

## 05/04/2026 Criação de pares completa "04_pairs.py"

Testes:
python -m py_compile 04_pairs.py

python 04_pairs.py sequencias_dataset01_limpo.txt pares_frequencias_dataset01.csv
python 04_pairs.py sequencias_dataset02_limpo.txt pares_frequencias_dataset02.csv
python 04_pairs.py sequencias_dataset03.txt pares_frequencias_dataset03.csv

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

Observação:
comportamento pouco repetitivo
grafo muito disperso

Leitura + técnica

Resultado: dataset com ruído estruturado e padrões fracos.

## Dataset 02 (IDs únicos / comportamento linear)

Pares únicos: 272
Total pares: 272

Interpretação
Todos os pares aparecem 1 vez

Resultado: não há pares repetidos.

Leitura + técnica

Este dataset: tem sequências determinísticas sem repetição

Observação:
análise de padrões
aprendizagem

## Dataset 03 (categorias / comportamento real)

Pares únicos: 12
Total pares: 352

Interpretação
Poucos pares únicos
Frequências muito altas (75, 74, …)

Resultado: adequado para análise RAMEX.

Leitura técnica

Este dataset é: altamente estruturado com padrões fortes

## Níveis de complexidade observados

| Dataset | Tipo           | Padrões   |
| ------- | -------------- | --------- |
| 02      | Granular (IDs) |  Nenhum   |
| 01      | Semi-aleatório |  Fracos   |
| 03      | Semântico      |  Fortes   |

## Síntese técnica

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

Observação: este caso representa uma rede muito conectada, onde os padrões locais existem mas não dominam claramente o sistema.

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

Observação: este caso sustenta a limitação metodológica em eventos muito específicos e pouco repetidos.

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
- boa legibilidade para grafo e análise RAMEX.

Resultado: dataset mais adequado para demonstrar valor interpretativo.

## COMPARAÇÃO GLOBAL

| Dataset | Nós | Arestas | Soma freq. | Leitura          |
| ------- | --: | ------: | ---------: | ---------------- |
| 01      | 200 |  38 815 |    139 834 | muito denso      |
| 02      | 281 |     272 |        272 | muito esparso    |
| 03      |   4 |      12 |        352 | compacto e forte |

Resultado observado: os três datasets apresentam comportamentos distintos úteis para comparação.

- Dataset 01: espaço de estados reduzido mas muito explorado;
- Dataset 02: espaço de estados alargado e pouca repetição;
- Dataset 03: espaço de estados pequeno e padrões muito recorrentes.

Observação: a natureza da representação dos dados influencia diretamente a estrutura da matriz e a qualidade
dos padrões extraídos.

## Observações finais

A pipeline neste momento está consistente:

01_dataset.py, 02_dataset.py, 03_dataset.py → normalização
04_pairs.py → pares e frequências
05_matriz_adjacencia.py → matriz

no dataset 02, soma das frequências = nº de arestas, confirmando frequência 1;
no dataset 03, poucas arestas e frequência alta, coerente com categorias agregadas;
no dataset 01, grande volume total e grande cobertura, coerente com 10 000 sequências.

Observações para relatório:

1 - No relatório, destacar que a matriz de adjacência permite passar de uma visão sequencial para uma visão relacional/estrutural dos dados.
2 - No dataset 01, como a matriz é quase cheia, o grafo pode ficar visualmente caótico.
Convém no 06_grafo.py prever:

- filtro por frequência mínima;
- top N arestas mais fortes ou ambos.

## 24/04/2026 ## Grafo dirigido ponderado

Esta fase cria o "06_grafo.py". Depois da matriz, é necessário prever grafo com filtro por frequência mínima e/ou top N arestas, sobretudo porque o Dataset 01 fica visualmente caótico.

Decisão técnica: a matriz confirma o contrato esperado, com primeira coluna sem nome como índice e restantes colunas como destinos. O script deve incluir "argparse", conversão numérica robusta, export de arestas finais e desenho adaptativo para grafos pequenos versus grandes. O primeiro teste usa o dataset 03 por ser o caso compacto.

O script faz:

- lê matriz de adjacência CSV com primeira coluna como índice;
- cria networkx.DiGraph() com pesos em weight;
- aplica --min-frequency e depois --top-n, quando ambos existem;
- exporta PNG do grafo;
- exporta CSV das arestas finais em grafo_edges_`dataset`.csv;
- imprime ficheiro lido, nós, arestas, soma dos pesos, top 10 e ficheiros gerados;
- valida ficheiro inexistente, matriz vazia, valores não numéricos e argumentos inválidos;
- avisa quando o grafo continua demasiado denso.

Para validar sintaxe:

python -m py_compile 06_grafo.py

Testes:

python 06_grafo.py matriz_adjacencia_dataset01.csv grafo_dataset01.png
python 06_grafo.py matriz_adjacencia_dataset02.csv grafo_dataset02.png
python 06_grafo.py matriz_adjacencia_dataset03.csv grafo_dataset03.png

Para o Dataset 01, recomendamos testar também com filtros, porque o grafo completo é muito denso:

python 06_grafo.py matriz_adjacencia_dataset01.csv grafo_dataset01_filtrado.png --min-frequency 5
python 06_grafo.py matriz_adjacencia_dataset01.csv grafo_dataset01_top50.png --top-n 50
python 06_grafo.py matriz_adjacencia_dataset01.csv grafo_dataset01_min5_top50.png --min-frequency 5 --top-n 50

## 25/04/2026 ## Ramex Simplificado

Esta fase faz o pedido: lê From, To, Weight, valida colunas, escolhe raiz, constrói uma estrutura simplificada sem ciclos, exporta CSV com From, To, Weight, Level e gera o PNG.

Validar sintaxe:

python -m py_compile 07_ramex_simplificado.py

Testes:

python 07_ramex_simplificado.py grafo_edges_dataset01.csv ramex_dataset01.csv ramex_dataset01.png
python 07_ramex_simplificado.py grafo_edges_dataset02.csv ramex_dataset02.csv ramex_dataset02.png
python 07_ramex_simplificado.py grafo_edges_dataset03.csv ramex_dataset03.csv ramex_dataset03.png

## 26/04/2026 ## Relatório Intermédio

Para executar:

python 08_validacao_comparativa.py

A conclusão final também fica escrita no .txt, destacando o Dataset 03 como o mais interpretável para padrões sequenciais, o Dataset 01 como denso/disperso e o Dataset 02 como pouco recorrente.

## Menu interativo

Teste:

python 09_framework.py

1. Executar preparacao dos datasets
2. Gerar pares/frequencias
3. Gerar matrizes de adjacencia
4. Gerar grafos
5. Gerar RAMEX simplificado
6. Executar validação comparativa
7. Executar pipeline completa
8. Sair

Implementar a fase backend do RAMEX completo com aproximação poly-tree.

CONTEXTO:
A framework RAMEX já está funcional com:

- normalização de datasets;
- geração de pares;
- frequências;
- matriz de adjacência;
- grafo dirigido ponderado;
- RAMEX simplificado;
- validação comparativa;
- frontend com upload;
- aba “Sobre o RAMEX”.

Adicionar a fase final 10_ramex_polytree.py

Implementámos a fase nova em 10_ramex_polytree.py.

Comando principal:

python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --top-k-per-node 2 --max-depth 5
Gera:

ramex_polytree_dataset03.csv
ramex_polytree_dataset03.png
ramex_polytree_dataset03.json
Validação feita:

python -m py_compile 10_ramex_polytree.py
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --top-k-per-node 2 --max-depth 5
Resultado do Dataset 03:

Raiz escolhida: Tecnologia
Nós poly-tree: 4
Arestas poly-tree: 10
Soma dos pesos originais: 352
Soma dos pesos preservados: 238
Percentagem de peso preservado: 67.61%
Também testei o Dataset 01 com profundidade controlada:

python 10_ramex_polytree.py grafo_edges_dataset01.csv ramex_polytree_dataset01_test.csv ramex_polytree_dataset01_test.png --top-k-per-node 2 --max-depth 3

## 25/04/2026 ## Melhoria da Heurística na Poly-tree

Implementar a Poly-tree com uma heurística multiobjetivo, em vez de escolher só “top K por nó”.

A ideia é seleccionar ramos que maximizem:

peso + cobertura + diversidade + coerência sequencial + legibilidade

Heurística proposta para testes

```text
Score(edge) =
  α * peso_normalizado
  β * probabilidade_transição
  γ * ganho_cobertura
  δ * centralidade_destino
  ε * penalização_redundância
  ζ * penalização_complexidade
```

A versão inicial escolhia arestas por frequência. A versão melhorada utilisa uma heurística multiobjetivo que equilibra peso, probabilidade local, cobertura, centralidade e legibilidade. Assim, não preserva apenas as transições mais frequentes, mas também as mais informativas para representar a estrutura global do dataset.

O que ficou implementado:

--strategy top-k continua a ser a estratégia por defeito.
Nova estratégia --strategy multiobjective.
Novos parâmetros: --alpha, --beta, --gamma, --delta, --epsilon, --zeta, --preserve-weight-target, --max-branching, --min-score.
Score multiobjetivo com peso normalizado, probabilidade local, cobertura, centralidade, redundância e complexidade.
Root selection melhorado com centralidade como desempate.
Exportação CSV com Score, Strategy e Reason.
JSON enriquecido com parameters, scoring_formula e métricas novas.
Métricas adicionais: cobertura por nível, branching médio, profundidade máxima, nós repetidos, score médio, densidade antes/depois, redução de arestas e interpretability_score.

Comentários finais no script a explicar top-k vs multiobjective.
README atualizado com explicação da nova heurística.

## Problema de diferenciação entre Top-K e Multiobjetivo

Causa identificada: a estratégia multiobjetivo ainda expandia nó a nó e depois cortava candidatos por nó, o que em grafos pequenos a aproxima muito do Top-K. A correção proposta é selecionar por fronteira/nível, onde todos os candidatos competem pelo score composto.

Os testes de linha de comandos já mostram diferença real: Top-K gerou 10 arestas e 59,38% de peso preservado; Multiobjetivo gerou 11 arestas e 65,62%, com scores compostos e reasons dinâmicos.

Correção aplicada: a Poly-tree diferencia as estratégias.

O que mudou:

top-k continua default e seleciona por Weight descendente.
multiobjective agora seleciona por fronteira/nível, calcula score para todos os candidatos disponíveis e ordena por Score, não por peso.
CSV/JSON passam a exportar claramente:
From, To, Weight, Level, Strategy, Score, Reason, ParentPath
Reason agora é dinâmico: peso/probabilidade, cobertura global, centralidade, redundância, etc.
Backend de upload usa mesmo a estratégia escolhida no frontend.
Frontend e PDF passam a aproveitar Score, Reason e Strategy vindos do JSON/CSV.
PDF mostra aviso se for multiobjetivo sem scores.
README atualizado com a diferença Top-K vs Multiobjetivo e a nota sobre datasets pequenos/densos.
Teste Dataset 03:

Top-K: 10 arestas, 59.38% peso preservado, score médio 0.3173.
Multiobjetivo: 11 arestas, 65.62% peso preservado, score médio 0.3531.
A Multiobjetivo inclui arestas diferentes, por exemplo Tecnologia -> Limpeza, e reasons como boa cobertura global e destino central no grafo

### Ponto pendente

O frontend já está a passar/mostrar a estratégia Multiobjetivo, mas o backend ainda não está a calcular ou devolver os scores reais. A tabela continua com Score e Reason como “Não disponível”, o que confirma isso mesmo.

Correção aplicada: na aba Upload, o PDF deixou de usar apenas result.polytree_edges cru e passou a fundir esses dados com result.polytree.edges, onde vêm score e reason.

## Dataset 04 sintético para comparar Top-K e Multiobjetivo

Objetivo: comparar as duas heurísticas em cenário controlado.

A heurística Top-K seleciona as transições com maior frequência por nó, privilegiando a cobertura máxima do comportamento observado. No dataset analisado, esta abordagem preserva 67,61% do peso total do grafo, resultando numa estrutura relativamente completa, mas potencialmente redundante.

Por outro lado, a heurística multiobjetivo introduz um critério composto, integrando peso, probabilidade local, cobertura global, centralidade e penalizações estruturais. Esta abordagem resulta numa estrutura ligeiramente mais compacta (9 arestas) e com menor peso preservado (64,49%), mas com maior coerência estrutural e interpretabilidade.

A análise demonstra que, para datasets pequenos e densos, como o dataset 03 (4 nós e densidade máxima), ambas as heurísticas produzem resultados semelhantes, uma vez que praticamente todas as transições são relevantes. No entanto, a heurística multiobjetivo acrescenta valor ao introduzir explicabilidade e ao reduzir redundâncias, tornando-se particularmente vantajosa em cenários de maior dimensão e complexidade.

Conclui-se que a escolha da heurística deve ser orientada pelo objetivo da análise: exploração e cobertura (Top-K) versus interpretação e síntese estrutural (multiobjetivo).

## Estado das fases

Fase 10A — RAMEX 2007 Rooted Branching - Done
Fase 10B — RAMEX Forward Heuristic - Done
Fase 10C — RAMEX Back-and-Forward Heuristic - Done
Fase 10D — Validação com exemplos dos artigos - Done
Fase 10E — Métricas científicas RAMEX - Done
Fase 11 — Integração frontend RAMEX puro - Done
Fase 12 — Relatório: conformidade RAMEX
Fase 13 — Inovação: Stability Mode
Fase 14 — Inovação: Explainable RAMEX
Fase 15 — Investigação futura: Hyper-RAMEX

## Fase 10A

A experiência com Top-K e multiobjetivo abriu várias opções, mas a prioridade passa a ser o RAMEX puro.

Decisão técnica: implementar a fase 10A com tentativa NetworkX e fallback greedy marcado. Isto mantém fidelidade ao rooted branching sem tornar o script frágil. Para CSVs sem SOURCE, o script deve avisar e escolher uma raiz real quando necessário.

## Fase 10B — RAMEX Forward Heuristic

Objetivo: implementar a heurística Forward descrita para quando existe uma raiz conhecida, mantendo a 10A como base RAMEX 2007.

Decisão técnica: criar a fase 10B isolada, no mesmo estilo da 10A: CLI simples, validações claras, CSV/JSON/PNG e sem tocar no frontend. O primeiro teste usa o Dataset 03.

Observação: validar também nos restantes datasets.

Criei 10B_ramex_forward_heuristic.py com a heurística Forward independente, utilisei CSV From,To,Weight, raiz obrigatória, expansão por maior peso para novos nós, prevenção de ciclos, exportação CSV/JSON/PNG e logs.

## Fase 10C — RAMEX Back-and-Forward Heuristic

Esta fase 10C, foi criada como script isolado, aproveitando o padrão de validação/exportação das fases 10A/10B, mas com a lógica própria Back-and-Forward: núcleo pela aresta mais forte e expansão nos dois sentidos.

## Fase 10D — Validação comparativa RAMEX puro

Objetivo: comparar formalmente:

RAMEX 2007 Rooted Branching
RAMEX Forward Heuristic
RAMEX Back-and-Forward Heuristic

## FASE 10D1: teste RAMEX puro nos datasets 01, 02 e 03

VALIDAÇÃO MULTI-DATASET RAMEX PURO

Dataset 01 (muito denso)
→ Back-and-Forward apresenta melhor resultado
Dataset 02 (esparso)
→ diferenças menores, Forward pode ser competitivo
Dataset 03 (pequeno e completo)
→ diferenças pequenas

O desempenho relativo das heurísticas RAMEX depende fortemente da estrutura do dataset, nomeadamente da densidade e da diversidade de transições.

## TESTES

Para cada dataset:

RAMEX 2007

python 10A_ramex_2007_rooted_branching.py grafo_edges_dataset01.csv ramex2007_dataset01.csv ramex2007_dataset01.png
python 10A_ramex_2007_rooted_branching.py grafo_edges_dataset02.csv ramex2007_dataset02.csv ramex2007_dataset02.png

Forward (ATENÇÃO → precisa de root!)

python 10B_ramex_forward_heuristic.py grafo_edges_dataset01.csv ramex_forward_dataset01.csv ramex_forward_dataset01.png --root `ROOT`
python 10B_ramex_forward_heuristic.py grafo_edges_dataset02.csv ramex_forward_dataset02.csv ramex_forward_dataset02.png --root `ROOT`

Back-and-Forward
python 10C_ramex_back_forward_heuristic.py grafo_edges_dataset01.csv ramex_back_forward_dataset01.csv ramex_back_forward_dataset01.png
python 10C_ramex_back_forward_heuristic.py grafo_edges_dataset02.csv ramex_back_forward_dataset02.csv ramex_back_forward_dataset02.png

Depois corre as validações:
python 10D_validacao_ramex_puro.py dataset01
python 10D_validacao_ramex_puro.py dataset02
python 10D_validacao_ramex_puro.py dataset03

python 10D1_validacao_ramex_multidataset.py

## Fase 11 — Frontend RAMEX Puro

Objetivo:
Integrar no frontend uma área dedicada ao RAMEX puro, distinguindo abordagens RAMEX puras das heurísticas experimentais anteriores.

Análise técnica consolidada

1. Coerência estrutural entre métodos

Os três métodos produziram:

Estruturas acíclicas ✔️
Respeito por in-degree ≤ 1 ✔️
Mesma base de dados (grafo completo de 4 nós) ✔️

Todos os métodos implementados respeitam as propriedades fundamentais do RAMEX, nomeadamente a geração de estruturas acíclicas e dirigidas, garantindo consistência estrutural entre abordagens.

1. Diferença funcional real
RAMEX 2007 (Rooted Branching)
Estrutura em estrela
Root explícito (Tecnologia)
Maximização direta do peso

comportamento:

privilegia relações diretas com a raiz

Forward Heuristic
Estrutura praticamente idêntica ao 2007
Também centrada na raiz

comportamento:

aproximação greedy ao rooted branching

Back-and-Forward
Estrutura não centrada numa única raiz
Expansão em dois sentidos
Introduz ligação intermédia (ex: Limpeza → Mercearia)

comportamento:

captura relações estruturais que não passam pela raiz

1. Diferença conceptual relevante

Observação: existe uma diferença conceptual relevante:

Rooted vs Poly-tree
2007 + Forward
modelo hierárquico
dependência de um ponto inicial
Back-and-Forward
modelo relacional
não depende de raiz única
aproxima-se da realidade dos dados

1. Interpretação quantitativa

| Método | Peso | Estrutura |
| ------ | ---- | ---------- |
| RAMEX 2007 | 34.94% | árvore centrada |
| Forward | 34.94% | árvore centrada |
| Back-and-Forward | 36.93% | estrutura distribuída |

diferença:

+2% de peso com estrutura mais rica

1. Interpretação técnica

A heurística Back-and-Forward consegue preservar mais informação global ao permitir a integração de relações não diretamente ligadas à raiz, evidenciando a limitação das abordagens estritamente enraizadas na representação de padrões sequenciais complexos.

1. Porque a diferença ainda é reduzida

Observação:

Dataset tem:
4 nós
densidade 1.0

logo:

praticamente todas as transições são relevantes

A reduzida dimensão e elevada densidade do dataset limitam a diferenciação entre métodos, uma vez que a maioria das transições apresenta relevância estrutural.

1. Hipótese para datasets mais complexos

A diferença entre abordagens tende a aumentar com a complexidade estrutural do grafo, sendo expectável que a heurística Back-and-Forward apresente vantagens mais significativas em datasets com maior número de nós, menor densidade e maior heterogeneidade de padrões.

1. Conclusão para relatório

Comparação entre abordagens RAMEX puras

A análise comparativa entre o RAMEX 2007 Rooted Branching, a Forward Heuristic e a Back-and-Forward Heuristic evidencia diferenças estruturais relevantes, apesar da proximidade dos resultados numéricos.

As abordagens baseadas em raiz (RAMEX 2007 e Forward) produzem estruturas hierárquicas centradas num único nó inicial, privilegiando relações diretas e simplificando a interpretação. No entanto, esta simplificação pode limitar a capacidade de capturar relações indiretas entre eventos.

Por sua vez, a Back-and-Forward Heuristic permite expansão em ambos os sentidos, resultando numa estrutura mais distribuída e capaz de integrar relações intermédias. Esta abordagem apresenta maior capacidade de preservação de informação global, refletida num peso total superior.

Apesar da diferença quantitativa ser reduzida neste dataset específico, devido à sua dimensão limitada e elevada densidade, a abordagem Back-and-Forward demonstra maior potencial para representar padrões sequenciais complexos, aproximando-se melhor do conceito de Poly-tree RAMEX.

Conclusão prática

Estado atual da validação:

implementação fiel ✔️
diferenciação entre métodos ✔️
leitura estrutural ✔️
base científica ✔️

## ARRANQUE DO ARTEFATO ##

Caminho backend: (.venv) PS C:\Users\joaqu\Documents\Projeto - Data Sciense\backend-ramex> 

..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

Caminho frontend: (.venv) PS C:\Users\joaqu\Documents\Projeto - Data Sciense\frontend-ramex>

npm.cmd run dev -- -p 3000
