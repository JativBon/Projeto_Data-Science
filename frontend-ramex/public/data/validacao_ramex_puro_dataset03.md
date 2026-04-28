# Validacao Comparativa RAMEX Puro - dataset03

## 1. Resumo da comparação

Esta validação compara as fases RAMEX puras implementadas na framework: RAMEX 2007 Rooted Branching, RAMEX Forward Heuristic e RAMEX Back-and-Forward Heuristic.

Os resultados demonstram que não existe um algoritmo universalmente superior. O desempenho das abordagens RAMEX depende da estrutura do grafo, nomeadamente da sua densidade, linearidade e diversidade de transições.

Tipo estrutural do dataset: **grafo pequeno e completo**.

Em grafos pequenos e totalmente conectados, a diferença entre métodos tende a ser reduzida, uma vez que quase todas as transições são estruturalmente relevantes.

| Fase | Algoritmo | Método | Nós selecionados | Arestas selecionadas | Soma pesos selecionados | Peso preservado (%) | Aciclico | Conectado | Raiz ou aresta inicial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10A | RAMEX 2007 Rooted Branching | networkx_arborescence | 4 | 3 | 123.00 | 34.94 | True | Não disponível | Tecnologia |
| 10B | RAMEX Forward Heuristic | ramex_forward_heuristic | 4 | 3 | 123.00 | 34.94 | True | Não disponível | Tecnologia |
| 10C | RAMEX Back-and-Forward Heuristic | ramex_back_forward_heuristic | 4 | 3 | 130.00 | 36.93 | True | True | Tecnologia -> Mercearia (75.0) |

## 2. Diferencas entre metodos

- **Rooted Branching:** representa a versão base inspirada no RAMEX 2007, procurando uma árvore dirigida enraizada que preserve peso sob restrições de branching.
- **Forward:** expande a partir de uma raiz conhecida, escolhendo iterativamente transições fortes para novos nós.
- **Back-and-Forward:** não depende de uma raiz explícita, parte da aresta mais forte e expande para sucessores e antecessores, aproximando-se melhor da ideia de Poly-tree RAMEX.

A heuristica Forward tende a produzir uma estrutura simples e enraizada, adequada quando existe um nó inicial conhecido. A heuristica Back-and-Forward não depende de uma raiz explicita e permite expansão em ambos os sentidos, aproximando-se melhor da ideia de Poly-tree RAMEX. O Rooted Branching representa a versão base inspirada no RAMEX 2007.

## 3. Método com maior peso preservado

O método com maior percentagem de peso preservado foi: **RAMEX Back-and-Forward Heuristic (36.93%)**.

## 4. Método mais simples

Os métodos mais simples, considerando o menor número de arestas selecionadas, são: **RAMEX 2007 Rooted Branching (3 arestas), RAMEX Forward Heuristic (3 arestas), RAMEX Back-and-Forward Heuristic (3 arestas)**.

## 5. Método mais próximo da Poly-tree RAMEX

O método mais próximo da ideia de Poly-tree RAMEX é: **RAMEX Back-and-Forward Heuristic**, por permitir expansão nos dois sentidos a partir da relação inicial mais forte.

## 6. Conclusão final

A comparação permite observar o compromisso entre simplicidade, enraizamento e preservação estrutural. A escolha do método deve depender da natureza do dataset e do objetivo da análise, evitando assumir que um algoritmo e universalmente superior.
