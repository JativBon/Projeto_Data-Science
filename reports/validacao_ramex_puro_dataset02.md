# Validacao Comparativa RAMEX Puro - dataset02

## 1. Resumo da comparacao

Esta validacao compara as fases RAMEX puras implementadas na framework: RAMEX 2007 Rooted Branching, RAMEX Forward Heuristic e RAMEX Back-and-Forward Heuristic.

Os resultados demonstram que nao existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transicoes.

Tipo estrutural do dataset: **grafo quase linear / sequencial**.

Em grafos quase lineares, o RAMEX 2007 Rooted Branching pode preservar uma percentagem muito elevada do peso, porque a estrutura sequencial já está fortemente definida.

| Fase | Algoritmo | Metodo | Nos selecionados | Arestas selecionadas | Soma pesos selecionados | Peso preservado (%) | Aciclico | Conectado | Raiz ou aresta inicial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10A | RAMEX 2007 Rooted Branching | maximum_weight_rooted_branching | 283 | 282 | 283.00 | 92.48 | True | True | SOURCE |
| 10B | RAMEX Forward Heuristic | ramex_forward_heuristic | 17 | 16 | 16.00 | 5.88 | True | Nao disponivel | 45 |
| 10C | RAMEX Back-and-Forward Heuristic | ramex_back_forward_heuristic | 17 | 16 | 16.00 | 5.88 | True | True | 10838 -> 11168 (1.0) |

## 2. Diferencas entre metodos

- **Rooted Branching:** representa a versao base inspirada no RAMEX 2007, procurando uma arvore dirigida enraizada que preserve peso sob restricoes de branching.
- **Forward:** expande a partir de uma raiz conhecida, escolhendo iterativamente transicoes fortes para novos nos.
- **Back-and-Forward:** nao depende de uma raiz explicita; parte da aresta mais forte e expande para sucessores e antecessores, aproximando-se melhor da ideia de Poly-tree RAMEX.

A heuristica Forward tende a produzir uma estrutura simples e enraizada, adequada quando existe um no inicial conhecido. A heuristica Back-and-Forward nao depende de uma raiz explicita e permite expansao em ambos os sentidos, aproximando-se melhor da ideia de Poly-tree RAMEX. O Rooted Branching representa a versao base inspirada no RAMEX 2007.

## 3. Metodo com maior peso preservado

O metodo com maior percentagem de peso preservado foi: **RAMEX 2007 Rooted Branching (92.48%)**.

## 4. Metodo mais simples

Os metodos mais simples, considerando o menor numero de arestas selecionadas, sao: **RAMEX Forward Heuristic (16 arestas), RAMEX Back-and-Forward Heuristic (16 arestas)**.

## 5. Metodo mais proximo da Poly-tree RAMEX

O metodo mais proximo da ideia de Poly-tree RAMEX e: **RAMEX Back-and-Forward Heuristic**, por permitir expansao nos dois sentidos a partir da relacao inicial mais forte.

## 6. Conclusao final

A comparacao permite observar o compromisso entre simplicidade, enraizamento e preservacao estrutural. A escolha do metodo deve depender da natureza do dataset e do objetivo da analise, evitando assumir que um algoritmo e universalmente superior.
