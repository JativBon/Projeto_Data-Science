# Relatório de Conformidade RAMEX

**Data:** 26/04/2026  
**Versão:** 1.0  
**Framework:** RAMEX Sequential Analysis Framework  
**Âmbito:** Validação científica da implementação face aos princípios RAMEX (2007, 2015)  

---

## 1. Introdução

### 1.1 Objetivo do projeto

Este projeto tem como objetivo construir uma framework de análise de padrões sequenciais inspirada no algoritmo RAMEX, proposto por Luís Cavique (2007, 2015). A framework transforma dados brutos de sequências em estruturas de rede interpretáveis, mantendo rastreabilidade completa.

### 1.2 Problema abordado

A análise de eventos enfrenta dois problemas estruturais:

- **Explosão combinatória** — métodos tradicionais geram demasiados padrões confusos.
- **Falta de visão global** — a análise item-a-item não revela a estrutura dominante.

O RAMEX resolve-os ao representar transições num grafo dirigido ponderado, condensado numa estrutura acíclica mínima que preserva o máximo de peso.

### 1.3 Motivação para usar RAMEX

- Representação visual e interpretável.
- Preservação de pesos absolutos (frequências reais).
- Estrutura acíclica que facilita a leitura.
- Base científica sólida.

## 2. Fundamentos do RAMEX

### 2.1 Transformação de sequências em rede

Cada par consecutivo `(A, B)` origina uma aresta `A → B`. O peso corresponde à contagem absoluta dessas ocorrências. Resulta numa matriz esparsa.

### 2.2 Pesos absolutos e estrutura acíclica

O uso de pesos absolutos garante que a estrutura reflete o comportamento real. O objetivo do RAMEX 2007 é encontrar uma **arborescência de peso máximo** — uma árvore dirigida (acíclica) que cobre os nós maximizando a soma de pesos.

### 2.3 Poly-tree (RAMEX 2015) e Rule Mining

Em 2015, Cavique generalizou o modelo para permitir múltiplos ramos (*poly-tree*). Ao contrário do *Rule Mining*, o RAMEX oferece uma visão global, menos padrões e opera sobre frequências em vez de apenas confiança local.

## 3. Pipeline Implementada

A pipeline é modular. Artefactos gerados referenciam o ficheiro de entrada para rastreabilidade completa. Existe uma clara separação entre os métodos RAMEX puros (10A, 10B, 10C) e abordagens heurísticas experimentais (Top-K, Multiobjectivo).

## 4. Conformidade com o RAMEX

| Componente RAMEX | Script | Conformidade | Nota |
| --- | --- | --- | --- |
| Transformação de sequências | `04_pairs.py` | ✔ Completa | Par consecutivo de eventos |
| Pesos absolutos | `04_pairs.py` | ✔ Completa | Frequência absoluta |
| Grafo dirigido ponderado | `06_grafo.py` | ✔ Completa | DiGraph com `weight` |
| Matriz de adjacência | `05_matriz_adjacencia.py` | ✔ Completa | Linhas=origens, colunas=destinos |
| Rooted branching | `10A...` | ✔ Completa | Arborescência de peso máximo (NetworkX) |
| Forward heuristic | `10B...` | ✔ Completa | Expansão greedy a partir da raiz |
| Back-and-forward | `10C...` | ✔ Completa | Expansão bidirecional sem raiz explícita |
| Propriedade acíclica | Fases 10A–10C | ✔ Validada | Verificação com `is_dag` |
| Poly-tree formal | `10_ramex_polytree.py` | ⚠️ Aproximação | Heurística Top-K / Multiobjectivo |

## 5. Análise dos Métodos

- **10A (Rooted Branching):** Encontra a arborescência de peso máximo. Excecional em estruturas lineares, mas preserva poucas arestas percentualmente em grafos densos.
- **10B (Forward Heuristic):** Expansão greedy a partir de uma raiz natural, escolhendo arestas de maior peso.
- **10C (Back-and-Forward):** Inicia na aresta de peso global máximo e expande em ambas as direções, aproximando o conceito de poly-tree.

## 6. Validação Experimental

Os três datasets possuem características distintas para avaliar os métodos.

### 6.1 Resultados por dataset e algoritmo

| Dataset | Fase | Algoritmo | Nós | Arestas orig. | Arestas sel. | Peso preservado | Acíclico | Ligado |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Dataset 01 | 10A | RAMEX 2007 Rooted Branching | 200 | 38 815 | 199 | 1.37% | Sim | — |
| Dataset 01 | 10B | RAMEX Forward Heuristic | 200 | 38 815 | 199 | 1.32% | Sim | — |
| Dataset 01 | 10C | RAMEX Back-and-Forward Heuristic | 200 | 38 815 | 199 | 1.42% | Sim | Sim |
| Dataset 02 | 10A | RAMEX 2007 Rooted Branching | 282 | 289 | 281 | 97.23% | Sim | — |
| Dataset 02 | 10B | RAMEX Forward Heuristic | 17 | 272 | 16 | 5.88% | Sim | — |
| Dataset 02 | 10C | RAMEX Back-and-Forward Heuristic | 49 | 272 | 48 | 17.65% | Sim | Sim |
| Dataset 03 | 10A | RAMEX 2007 Rooted Branching | 4 | 12 | 3 | 34.94% | Sim | — |
| Dataset 03 | 10B | RAMEX Forward Heuristic | 4 | 12 | 3 | 34.94% | Sim | — |
| Dataset 03 | 10C | RAMEX Back-and-Forward Heuristic | 4 | 12 | 3 | 36.93% | Sim | Sim |

### 6.2 Ranking global (média multi-dataset)

| Algoritmo | Datasets | Peso preservado médio | Desvio padrão | Arestas médias |
| --- | ---: | ---: | ---: | ---: |
| RAMEX 2007 Rooted Branching | 3 | 44.51% | 39.72% | 161 |
| RAMEX Back-and-Forward Heuristic | 3 | 18.67% | 14.52% | 83 |
| RAMEX Forward Heuristic | 3 | 14.05% | 14.89% | 72 |

### 6.3 Interpretação por tipo de dataset

**Dataset 01 (Grafo denso, 200 nós, >38k arestas):** A exigência é altíssima. A compressão preserva < 2% do peso, escolhendo apenas |nós| - 1 arestas. Diferenças marginais entre métodos.

**Dataset 02 (Grafo linear, 282 nós, 289 arestas):** Estrutura próxima a uma cadeia. O algoritmo 10A domina (>97% de peso preservado).

**Dataset 03 (Grafo pequeno e denso):** Os três algoritmos comportam-se de forma equivalente e robusta (35% a 37% de peso preservado).

## 7. Limitações

- **Poly-tree formal não implementada:** As implementações atuais são aproximações heurísticas à formalização de Cavique (2015).
- **Dependência da estrutura:** Grafos lineares favorecem 10A; grafos muito densos forçam todos os métodos a comprimir fortemente.
- A escalabilidade extrema (milhões de sequências) ainda não foi sistematicamente testada.

## 8. Conclusão

A framework implementada **demonstra conformidade com os princípios fundamentais do algoritmo RAMEX**. A transformação em grafo, uso de pesos absolutos e extração acíclica seguem as normas. O sistema permite análise estruturada fiel, com validação experimental em múltiplos cenários.

## 9. Referências

1. Cavique, L. (2007). A Network Algorithm to Discover Sequential Patterns. EPIA 2007.
2. Cavique, L. (2015). Ramex: A Sequence Mining Algorithm Using Poly-trees.
3. Tiple, P., Cavique, L., & Marques, N. C. (2017). Ramex-Forum.
4. Cavique, L. (2021). Ciência dos Dados: Bases de Dados versus Aprendizagem Automática.
