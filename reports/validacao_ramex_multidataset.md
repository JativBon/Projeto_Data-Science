# Validação RAMEX Puro — Multi Dataset

## 1. Resumo Global

Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transições.

- Algoritmo com maior media de peso preservado: **RAMEX 2007 Rooted Branching (45.10% de media)**.
- Nota: a média global deve ser interpretada com cautela, pois pode ser influenciada por datasets com estrutura muito específica.
- Algoritmo com maior numero de vitorias por peso preservado: **RAMEX 2007 Rooted Branching**.
- Metodo(s) mais simples: **RAMEX Back-and-Forward Heuristic, RAMEX Forward Heuristic**.
- Algoritmo mais estruturado: **RAMEX 2007 Rooted Branching**.

### Ranking global por algoritmo

| algorithm | datasets_available | mean_preserved_weight_percent | std_preserved_weight_percent | mean_selected_edges | vitorias |
| --- | --- | --- | --- | --- | --- |
| RAMEX 2007 Rooted Branching | 3 | 45.10 | 35.70 | 162.67 | 2 |
| RAMEX Back-and-Forward Heuristic | 3 | 14.74 | 15.79 | 72.67 | 1 |
| RAMEX Forward Heuristic | 3 | 14.05 | 14.89 | 72.67 | 0 |

### Resultados agregados

| dataset | algorithm | nodes | edges | selected_weight | preserved_weight_percent | acyclic | connected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dataset01 | RAMEX 2007 Rooted Branching | 202 | 201 | 10068.00 | 6.33 | True | True |
| dataset01 | RAMEX Forward Heuristic | 200 | 199 | 1842.00 | 1.32 | True | Nao disponivel |
| dataset01 | RAMEX Back-and-Forward Heuristic | 200 | 199 | 1981.00 | 1.42 | True | True |
| dataset02 | RAMEX 2007 Rooted Branching | 283 | 282 | 283.00 | 92.48 | True | True |
| dataset02 | RAMEX Forward Heuristic | 17 | 16 | 16.00 | 5.88 | True | Nao disponivel |
| dataset02 | RAMEX Back-and-Forward Heuristic | 17 | 16 | 16.00 | 5.88 | True | True |
| dataset03 | RAMEX 2007 Rooted Branching | 6 | 5 | 165.00 | 36.50 | True | True |
| dataset03 | RAMEX Forward Heuristic | 4 | 3 | 123.00 | 34.94 | True | Nao disponivel |
| dataset03 | RAMEX Back-and-Forward Heuristic | 4 | 3 | 130.00 | 36.93 | True | True |

## 2. Comparação por Dataset

### dataset01

- Melhor metodo por peso preservado: **RAMEX 2007 Rooted Branching (6.33%)**.
- Tipo estrutural do dataset: **grafo denso / altamente conectado**.
- Metodos mais simples: **RAMEX Forward Heuristic (199 arestas), RAMEX Back-and-Forward Heuristic (199 arestas)**.
- Metodo mais estrutural: **RAMEX 2007 Rooted Branching**.
- Comportamento observado: Em grafos densos, todos os métodos são obrigados a condensar uma grande quantidade de transições numa estrutura acíclica reduzida. A percentagem de peso preservado tende a ser baixa.

### dataset02

- Melhor metodo por peso preservado: **RAMEX 2007 Rooted Branching (92.48%)**.
- Tipo estrutural do dataset: **grafo quase linear / sequencial**.
- Metodos mais simples: **RAMEX Forward Heuristic (16 arestas), RAMEX Back-and-Forward Heuristic (16 arestas)**.
- Metodo mais estrutural: **RAMEX 2007 Rooted Branching**.
- Comportamento observado: Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.

### dataset03

- Melhor metodo por peso preservado: **RAMEX Back-and-Forward Heuristic (36.93%)**.
- Tipo estrutural do dataset: **grafo de estrutura intermédia**.
- Metodos mais simples: **RAMEX Forward Heuristic (3 arestas), RAMEX Back-and-Forward Heuristic (3 arestas)**.
- Metodo mais estrutural: **RAMEX 2007 Rooted Branching**.
- Comportamento observado: Em grafos de estrutura intermédia, a interpretação deve equilibrar cobertura de peso, simplicidade e preservação estrutural.


## 3. Conclusão Científica

A analise multi-dataset evidencia que o desempenho dos algoritmos RAMEX depende fortemente da estrutura dos dados. Em grafos densos, as restricoes de aciclicidade obrigam todos os metodos a condensar fortemente a rede. Em grafos quase lineares, o RAMEX 2007 preserva grande parte da informacao. A Back-and-Forward Heuristic mostrou-se vantajosa em cenarios com relacoes intermedias relevantes.
