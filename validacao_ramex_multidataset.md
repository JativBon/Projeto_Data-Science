# Validação RAMEX Puro — Multi Dataset

## 1. Resumo Global

Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transições.

- Algoritmo com maior media de peso preservado: **RAMEX 2007 Rooted Branching (44.51% de media)**.
- Nota: a média global deve ser interpretada com cautela, pois pode ser influenciada por datasets com estrutura muito específica.
- Algoritmo com maior numero de vitorias por peso preservado: **RAMEX Back-and-Forward Heuristic**.
- Metodo(s) mais simples: **RAMEX 2007 Rooted Branching, RAMEX Back-and-Forward Heuristic, RAMEX Forward Heuristic**.
- Algoritmo mais estruturado: **RAMEX Back-and-Forward Heuristic**.

### Ranking global por algoritmo

| algorithm | datasets_available | mean_preserved_weight_percent | std_preserved_weight_percent | mean_selected_edges | vitorias |
| --- | --- | --- | --- | --- | --- |
| RAMEX 2007 Rooted Branching | 3 | 44.51 | 39.72 | 161.00 | 1 |
| RAMEX Back-and-Forward Heuristic | 3 | 18.67 | 14.52 | 83.33 | 2 |
| RAMEX Forward Heuristic | 3 | 14.05 | 14.89 | 72.67 | 0 |

### Resultados agregados

| dataset | algorithm | nodes | edges | selected_weight | preserved_weight_percent | acyclic | connected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dataset01 | RAMEX 2007 Rooted Branching | 200 | 199 | 1909.00 | 1.37 | True | Nao disponivel |
| dataset01 | RAMEX Forward Heuristic | 200 | 199 | 1842.00 | 1.32 | True | Nao disponivel |
| dataset01 | RAMEX Back-and-Forward Heuristic | 200 | 199 | 1981.00 | 1.42 | True | True |
| dataset02 | RAMEX 2007 Rooted Branching | 282 | 281 | 281.00 | 97.23 | True | Nao disponivel |
| dataset02 | RAMEX Forward Heuristic | 17 | 16 | 16.00 | 5.88 | True | Nao disponivel |
| dataset02 | RAMEX Back-and-Forward Heuristic | 49 | 48 | 48.00 | 17.65 | True | True |
| dataset03 | RAMEX 2007 Rooted Branching | 4 | 3 | 123.00 | 34.94 | True | Nao disponivel |
| dataset03 | RAMEX Forward Heuristic | 4 | 3 | 123.00 | 34.94 | True | Nao disponivel |
| dataset03 | RAMEX Back-and-Forward Heuristic | 4 | 3 | 130.00 | 36.93 | True | True |

## 2. Comparação por Dataset

### dataset01

- Melhor metodo por peso preservado: **RAMEX Back-and-Forward Heuristic (1.42%)**.
- Tipo estrutural do dataset: **grafo denso / altamente conectado**.
- Metodos mais simples: **RAMEX 2007 Rooted Branching (199 arestas), RAMEX Forward Heuristic (199 arestas), RAMEX Back-and-Forward Heuristic (199 arestas)**.
- Metodo mais estrutural: **RAMEX Back-and-Forward Heuristic**.
- Comportamento observado: Em grafos densos, todos os métodos são obrigados a condensar uma grande quantidade de transições numa estrutura acíclica reduzida. A percentagem de peso preservado tende a ser baixa.

### dataset02

- Melhor metodo por peso preservado: **RAMEX 2007 Rooted Branching (97.23%)**.
- Tipo estrutural do dataset: **grafo quase linear / sequencial**.
- Metodos mais simples: **RAMEX Forward Heuristic (16 arestas)**.
- Metodo mais estrutural: **RAMEX Back-and-Forward Heuristic**.
- Comportamento observado: Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.

### dataset03

- Melhor metodo por peso preservado: **RAMEX Back-and-Forward Heuristic (36.93%)**.
- Tipo estrutural do dataset: **grafo pequeno e completo**.
- Metodos mais simples: **RAMEX 2007 Rooted Branching (3 arestas), RAMEX Forward Heuristic (3 arestas), RAMEX Back-and-Forward Heuristic (3 arestas)**.
- Metodo mais estrutural: **RAMEX Back-and-Forward Heuristic**.
- Comportamento observado: Em grafos pequenos e totalmente conectados, a diferença entre métodos tende a ser reduzida.


## 3. Conclusão Científica

A analise multi-dataset evidencia que o desempenho dos algoritmos RAMEX depende fortemente da estrutura dos dados. Em grafos densos, as restricoes de aciclicidade obrigam todos os metodos a condensar fortemente a rede. Em grafos quase lineares, o RAMEX 2007 preserva grande parte da informacao. A Back-and-Forward Heuristic mostrou-se vantajosa em cenarios com relacoes intermedias relevantes.
