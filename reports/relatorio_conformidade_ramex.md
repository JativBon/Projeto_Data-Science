# Relatório de Conformidade RAMEX

**Data:** 26/04/2026  
**Versão:** 1.1  
**Framework:** RAMEX Sequential Analysis Framework  
**Âmbito:** validação científica da implementação face aos princípios RAMEX 2007, RAMEX 2015 e extensões RAMEX-Forum  

---

## 1. Introdução

### 1.1 Objetivo do projeto

Este projeto tem como objetivo construir uma framework de análise de padrões sequenciais inspirada no algoritmo RAMEX, proposto por Luís Cavique. A framework transforma dados sequenciais em redes dirigidas ponderadas, permite a análise estrutural das transições observadas e extrai estruturas RAMEX condensadas, interpretáveis e visualmente claras.

O trabalho realizado não substitui o projecto anterior, mas evolui a sua implementação. A auditoria técnica mostrou que a base modular existente era reaproveitável, desde que fossem clarificadas as diferenças entre a rede observada completa, os métodos heurísticos exploratórios e as estruturas RAMEX formais.

### 1.2 Problema abordado

A análise de sequências enfrenta dois problemas principais:

- **explosão combinatória**, porque métodos tradicionais podem produzir muitos padrões locais e difíceis de interpretar;
- **perda de visão global**, porque a leitura item-a-item não revela facilmente a estrutura dominante das sequências.

O RAMEX responde a estes problemas através da transformação das sequências numa rede de transições e da extracção de uma estrutura condensada. Essa estrutura não deve ser confundida com o grafo observado completo. O grafo observado representa todas as transições reconstruídas; a estrutura RAMEX final representa uma selecção interpretável dessas transições.

### 1.3 Motivação para usar RAMEX

A motivação científica do projecto assenta em quatro pontos:

- representar sequências como uma rede dirigida ponderada;
- usar pesos absolutos, mantendo a frequência real das transições;
- reduzir a complexidade visual e estrutural por extracção de árvores, branchings ou poly-trees;
- gerar artefactos interpretáveis, comparáveis e verificáveis.

Esta leitura está alinhada com Cavique (2007), onde o RAMEX é apresentado como um algoritmo baseado em rede para descobrir padrões sequenciais, reduzindo complexidade e facilitando a visualização; com Cavique (2015), onde a estrutura de poly-tree é usada para obter uma visão holística das sequências; e com Tiple et al. (2016/2017), onde o Ramex-Forum introduz novas visualizações para padrões sequenciais complexos.

## 2. Desenho

### 2.1 Transformação de sequências em rede observada

Cada par consecutivo de eventos `(A, B)` origina uma aresta dirigida `A -> B`. O peso da aresta corresponde à frequência absoluta dessa transição nas sequências analisadas. O resultado desta fase é o **grafo observado completo**, isto é, a rede original de transições reconstruída a partir dos dados.

Este grafo observado pode ser denso, conter ciclos, múltiplas entradas no mesmo nó e elevado número de cruzamentos em visualizações directas. Por esse motivo, deve ser apresentado como camada diagnóstica e não como resultado RAMEX final.

### 2.2 Algoritmos implementados

#### Grafo observado completo

O grafo observado completo representa a rede original de transições extraída dos dados. A sua função é preservar a informação observacional e permitir diagnóstico estrutural: número de nós, número de arestas, densidade, peso total, ciclos e distribuição de entradas/saídas.

Este artefacto não é uma árvore RAMEX. Pode conter ciclos e múltiplas entradas, pelo que não deve ser descrito como RAMEX final nem usado como Sankey RAMEX final.

#### RAMEX 2007 formal

O RAMEX 2007 formal é o eixo principal da implementação. O procedimento adoptado segue a leitura de Cavique (2007): as sequências são transformadas numa rede dirigida ponderada e, sobre essa rede, é aplicada uma selecção máxima ponderada para extrair uma arborescência dirigida.

Na implementação, esta fase corresponde ao método de **Maximum Weight Rooted Branching**. A estrutura final deve cumprir as propriedades de uma arborescência:

- existência de uma raiz explícita;
- `in_degree` da raiz igual a 0;
- cada nó não-raiz com `in_degree <= 1`;
- grafo dirigido acíclico;
- todos os nós seleccionados alcançáveis a partir da raiz;
- número de arestas igual ao número de nós menos um.

Quando estas condições não se verificam, a estrutura não deve ser apresentada como RAMEX 2007 final. Deve ser classificada como estrutura inválida que requer revisão.

#### Forward Heuristic

A Forward Heuristic é uma heurística RAMEX 2015 aplicável quando existe uma raiz conhecida ou inferida. A expansão parte dessa raiz e selecciona transições dominantes em direcção aos nós ainda não incluídos.

Esta abordagem é útil quando a sequência tem um ponto inicial claro. No entanto, deve ser distinguida do RAMEX 2007 formal: é uma heurística de expansão a partir de raiz, não a implementação principal de Maximum Weight Rooted Branching.

#### Back-and-Forward Poly-tree formal

A abordagem Back-and-Forward formal é usada quando não existe uma raiz clara. Em vez de partir de um único nó inicial, a construção começa numa relação dominante e expande em ambos os sentidos, procurando obter uma estrutura global com forma de poly-tree.

No projecto corrigido, a poly-tree formal é validada como um DAG cujo grafo não dirigido correspondente é uma árvore. Esta condição é central para alinhar a implementação com Cavique (2015), onde a poly-tree permite uma leitura holística das sequências sem reduzir a análise a um único caminho linear.

Uma poly-tree formal pode ter nós com `in_degree > 1`. Estes nós são tratados como nós de convergência e devem ser destacados nas visualizações.

#### RAMEX simplificado experimental

O RAMEX simplificado desenvolvido nas fases iniciais é mantido como baseline experimental. O seu papel é histórico e comparativo: ajuda a mostrar a evolução do projecto e permite comparar heurísticas simples com as abordagens formais.

Este método não deve ser apresentado como implementação formal principal do RAMEX 2007, nem como substituto da arborescência produzida por Maximum Weight Rooted Branching.

### 2.3 Sankey diagnóstico e Sankey RAMEX final

A auditoria técnica identificou que a visualização Sankey podia estar a usar arestas do grafo observado filtrado ou completo, o que gerava cruzamentos excessivos e dificultava a leitura. Esta crítica é coerente com a natureza do grafo observado: por conter muitas transições, ciclos e múltiplos caminhos, o Sankey observado tende a ser denso.

Assim, o desenho corrigido separa:

- **Sankey diagnóstico**, construído a partir do grafo observado ou observado filtrado, apresentado apenas como visualização exploratória;
- **Sankey RAMEX 2007 final**, construído apenas a partir das arestas da arborescência seleccionada;
- **Sankey Back-and-Forward final**, construído apenas a partir das arestas da poly-tree formal;
- **Sankey Forward**, construído apenas a partir da estrutura seleccionada pela Forward Heuristic.

O Sankey observado nunca deve ser chamado Sankey RAMEX final.

No caso do **Sankey Back-and-Forward formal**, o posicionamento visual é calculado a partir da árvore não dirigida subjacente à poly-tree. A direcção real das arestas é preservada nos links, mas os níveis e posições dos nós são definidos por BFS a partir da aresta inicial ou do centro visual da árvore, reduzindo cruzamentos. Quando a poly-tree tem mais de 60 nós, o relatório e a interface usam por defeito uma versão interpretativa com as 50 arestas de maior peso; os ficheiros JSON/CSV continuam a conter a estrutura completa.

O relatório PDF passa a usar as mesmas vistas do frontend como fonte principal das figuras. A exportação é feita por Playwright através de seletores `data-export-id`, preservando títulos, subtítulos, avisos, badges e a semântica visual do painel interativo. As imagens geradas pelo backend permanecem como anexo técnico e evidência formal, não como narrativa visual principal.

## 3. Implementação

### 3.1 Pipeline implementada

A pipeline é modular e preserva as fases históricas do projecto:

1. leitura e normalização dos datasets;
2. construção de sequências;
3. geração de pares consecutivos;
4. matriz de adjacência;
5. grafo observado dirigido ponderado;
6. RAMEX simplificado experimental;
7. RAMEX 2007 formal;
8. Forward Heuristic;
9. Back-and-Forward Poly-tree formal;
10. visualizações, Sankeys, relatórios e artefactos de validação.

Esta organização segue a estrutura de implementação e testes presente no relatório de Gil Cunha, em especial na separação entre matriz, grafo, RAMEX com ICD/identificação de componentes, validação e organização modular dos scripts.

### 3.2 Separação entre rede observada e estruturas RAMEX extraídas

A principal correcção conceptual da implementação consistiu em separar a rede observada das estruturas RAMEX extraídas.

A **rede observada** é a camada completa de transições reconstruídas a partir dos dados. Pode ser densa, conter ciclos e apresentar múltiplas entradas no mesmo nó. A sua função é diagnóstica: mostrar a informação bruta de transição, permitir métricas globais e justificar a necessidade de condensação.

As **estruturas RAMEX** são condensações interpretáveis da rede observada. O RAMEX 2007 formal extrai uma arborescência dirigida por Maximum Weight Rooted Branching. A Forward Heuristic constrói uma expansão dirigida a partir de uma raiz conhecida ou inferida. A Back-and-Forward formal extrai uma poly-tree validada.

A arborescência RAMEX 2007 é validada formalmente através de raiz, grau de entrada, aciclicidade, alcançabilidade e relação `edges = nodes - 1`. A poly-tree formal é validada como DAG cujo grafo não dirigido é uma árvore. Estas validações impedem que grafos genéricos ou redes observadas sejam apresentados como estruturas RAMEX finais.

Os Sankeys finais usam apenas as arestas seleccionadas pelas estruturas RAMEX. O Sankey observado é mantido como diagnóstico complementar e deve incluir aviso de que pode conter cruzamentos por representar a rede completa de transições.

### 3.3 Módulo comum de validação estrutural

Foi introduzido um módulo comum de validação estrutural, `ramex_validation.py`, para evitar duplicação de lógica entre scripts. Este módulo valida:

- grafo observado;
- rooted branching / arborescência RAMEX 2007;
- Forward Tree;
- poly-tree formal;
- métricas gerais de grafo.

O módulo calcula métricas como número de nós, número de arestas, densidade, peso total, grau médio, graus máximos de entrada e saída, número de fontes e sumidouros, e percentagem de peso preservado quando existe grafo original de referência.

### 3.4 Artefactos exportados

Os métodos formais exportam CSV, JSON, PNG e ficheiros de métricas. Sempre que uma estrutura final é apresentada, o respectivo payload inclui validação estrutural.

Quando algum resultado ainda não tiver sido produzido numa execução concreta, o relatório deve usar o marcador:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

Este marcador evita inventar resultados numéricos e mantém a rastreabilidade entre relatório e execução.

## 4. Testes

### 4.1 Estratégia de validação

A validação do projecto passa a distinguir explicitamente testes sobre a rede observada e testes sobre estruturas RAMEX finais.

O grafo observado é testado como rede diagnóstica. Pode conter ciclos e múltiplas entradas, pelo que o teste não exige forma de árvore. Em vez disso, confirma a sua classificação correcta como grafo observado completo ou filtrado.

As estruturas RAMEX finais são testadas por propriedades formais.

### 4.2 Testes RAMEX 2007

Para o RAMEX 2007 formal, os testes estruturais devem verificar:

- a raiz existe;
- `root in_degree = 0`;
- todos os nós não-raiz têm `in_degree <= 1`;
- a estrutura é um DAG;
- todos os nós seleccionados são alcançáveis a partir da raiz;
- `edges = nodes - 1`;
- o peso preservado é calculado face ao grafo original.

Resultado esperado:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

### 4.3 Testes Forward Heuristic

Para a Forward Heuristic, os testes devem verificar:

- existência de raiz conhecida ou inferida;
- expansão a partir da raiz;
- aciclicidade;
- `edges <= nodes - 1`;
- nós seleccionados alcançáveis dentro da expansão;
- peso preservado face ao grafo observado.

Resultado esperado:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

### 4.4 Testes Back-and-Forward Poly-tree formal

Para a Back-and-Forward Poly-tree formal, os testes devem verificar:

- a estrutura é um DAG;
- o grafo não dirigido correspondente é uma árvore;
- `edges = nodes - 1`;
- ausência de ciclos não dirigidos;
- identificação de nós de convergência com `in_degree > 1`;
- peso preservado face ao grafo observado.

Resultado esperado:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

### 4.5 Testes Sankey

Os testes dos Sankeys devem confirmar que:

- o Sankey RAMEX 2007 usa apenas arestas da arborescência RAMEX 2007;
- o Sankey Back-and-Forward usa apenas arestas da poly-tree formal;
- o Sankey Back-and-Forward formal usa layout fixo hierárquico calculado sobre a árvore não dirigida, preservando a direcção real das arestas;
- quando a poly-tree excede 60 nós, a versão interpretativa top 50 é usada por defeito e a versão completa continua disponível;
- o Sankey Forward usa apenas arestas da Forward Heuristic;
- o Sankey observado usa apenas arestas do grafo observado filtrado e é classificado como diagnóstico;
- nenhuma visualização baseada no grafo observado é apresentada como Sankey RAMEX final.

Resultado esperado:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

### 4.6 Testes do grafo observado

O grafo observado deve ser testado como camada diagnóstica. Os testes devem registar:

- número de nós;
- número de arestas;
- densidade;
- existência ou ausência de ciclos;
- peso total;
- mensagem metodológica: "Grafo observado: pode conter ciclos e múltiplas entradas."

Resultado esperado:

`[INSERIR RESULTADO GERADO PELO SCRIPT]`

## 5. Conclusões

A framework implementada demonstra conformidade com os princípios fundamentais do RAMEX: transformação de sequências em rede, utilização de pesos absolutos, extracção de estruturas condensadas e validação estrutural dos artefactos finais.

A principal evolução do projecto consistiu em separar a rede observada das estruturas RAMEX finais, reforçando a fidelidade científica e a clareza visual.

Esta separação permite defender que:

- o grafo observado completo preserva a informação original de transições;
- o RAMEX 2007 formal é a implementação principal para extracção de arborescência;
- a Forward Heuristic funciona como abordagem com raiz conhecida;
- a Back-and-Forward formal permite obter uma poly-tree quando não existe raiz clara;
- o RAMEX simplificado permanece como baseline experimental;
- os Sankeys finais representam apenas estruturas seleccionadas, enquanto o Sankey observado é diagnóstico.

Deste modo, o projecto mantém o trabalho anterior, mas enquadra-o como evolução técnica e conceptual. A correcção introduzida melhora a defesa académica porque impede ambiguidades entre rede completa, visualizações exploratórias e resultados RAMEX formais.

## 6. Referências

1. Cavique, L. (2007). *A Network Algorithm to Discover Sequential Patterns*. EPIA 2007.
2. Cavique, L. (2015). *Ramex: A Sequence Mining Algorithm Using Poly-trees*.
3. Tiple, P., Cavique, L., & Marques, N. C. (2016/2017). Trabalhos sobre Ramex-Forum e visualizações para padrões sequenciais complexos.
4. Cunha, G. Relatório académico sobre RAMEX, poly-tree, matriz, ICD e organização de implementação/testes.
