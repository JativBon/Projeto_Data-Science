# RAMEX Sequential Analysis Framework

## Descricao

O **RAMEX Sequential Analysis Framework** é um artefacto digital de Data Science para análise sequêncial, inspirado nos trabalhos do Professor Luís Cavique sobre RAMEX e *sequence mining*.

A framework permite transformar datasets heterogéneos em estruturas interpretáveis de conhecimento sequêncial. O sistema suporta datasets pré-carregados e upload de novos ficheiros, mantendo uma pipeline rastreável desde os dados brutos até a visualização e interpretação dos padrões.

A framework permite:

- carregar datasets;
- transformar dados em sequências;
- gerar pares de transição;
- calcular frequências;
- construir matriz de adjacência;
- criar grafo dirigido ponderado;
- gerar RAMEX simplificado;
- gerar RAMEX Poly-tree;
- comparar datasets;
- produzir relatérios técnicos.

## Enquadramento Cientifico

O RAMEX é uma abordagem de *sequence mining* baseada em estruturas de rede/grafo. Em vez de produzir apenas listas extensas de regras sequênciais, procura condensar os padrões em representações visuais e interpretáveis.

Nesta framework, a abordagem e operacionalizada em três néveis:

- **Grafo completo:** representa todas as transições observadas entre eventos.
- **RAMEX simplificado:** seleciona uma estrutura dominante, mais legivel, a partir do grafo ponderado.
- **RAMEX Poly-tree:** preserva múltiplos ramos relevantes, aproximando-se mais da ideia de poly-tree associada ao RAMEX.

Referencias cientificas:

- Cavique, L. (2007). *A Network Algorithm to Discover Sequential Patterns*. EPIA 2007, LNAI 4874, pp. 406-414.
- Cavique, L. (2015). *Ramex: A Sequence Mining Algorithm Using Poly-trees*. Advances in Intelligent Systems and Computing, 354, pp. 143-153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). *Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products*. Expert Systems, 34:e12174.
- Cavique, L. (2021). *Ciencia dos Dados: Bases de Dados versus Aprendizagem Automatica*. Revista de Ciencia Elementar, 9(02):041.

## Arquitetura

A solução esta dividida em duas camadas:

- **Backend Python/FastAPI:** recebe uploads, normaliza datasets, executa a pipeline RAMEX e gera CSV/PNG/JSON.
- **Frontend TypeScript/React/Next.js:** apresenta os datasets, visualiza matriz/grafo/RAMEX, permite upload e exporta relatorios tecnicos.

Os artefactos estáticos dos datasets pré-carregados estão em:

```text
frontend-ramex/public/data/
```

Os resultados de uploads são guardados pelo backend em:

```text
backend-ramex/outputs/<job_id>/
```

Pipeline conceptual:

```text
Dataset
  ↓
Normalização de Sequências
  ↓
Pares A → B
  ↓
Frequências
  ↓
Matriz de Adjacência
  ↓
Grafo Dirigido Ponderado
  ↓
RAMEX Simplificado / RAMEX Poly-tree
  ↓
Interpretacao e Relatério Técnico
```

## Instalação

### Backend

A partir da raiz do projeto:

```powershell
cd backend-ramex
..\venv\Scripts\python.exe -m pip install -r requirements.txt
..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Se for criado um novo ambiente virtual:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend-ramex\requirements.txt
```

### Frontend

Noutro terminal:

```powershell
cd frontend-ramex
npm install
npm.cmd run dev -- -p 3001
```

## Execução

URLs habituais:

```text
Frontend: http://localhost:3001
API:      http://127.0.0.1:8000
Health:   http://127.0.0.1:8000/api/health
```

Fluxo de utilização:

1. Arrancar o backend FastAPI.
2. Arrancar o frontend Next.js.
3. Selecionar D01, D02 ou D03 para analisar datasets pré-carregados.
4. Usar "Upload Dataset" para carregar um novo ficheiro.
5. Mapear colunas, quando aplicavel.
6. Executar a análise RAMEX.
7. Visualizar matriz, grafo, RAMEX simplificado, Poly-tree e relatório.

## Formatos aceites

### 1. Sequencias simples

Ficheiro `.txt` ou `.csv` onde cada linha representa uma sequência:

```text
A B C D
A C D
B D A
```

### 2. Tabela de eventos

CSV/XLSX com colunas configuraveis:

```text
case_id,order,event
1,1,A
1,2,B
1,3,C
2,1,A
2,2,D
```

- `case_id` identifica entidade/caso/cliente;
- `order` ou data define a ordem;
- `event` e o evento/categoria.

### 3. Dataset estilo Customer/Product

Exemplo:

```text
Customer ID,Order Date,Category
```

O frontend permite mapear as colunas de entidade, tempo/ordem e evento/categoria.

## Exemplos de utilização

### Usar datasets pré-carregados

No frontend:

- selecionar `D01`, `D02` ou `D03`;
- abrir as abas "Matriz de Adjacência", "Grafo", "RAMEX Simplificado", "RAMEX Poly-tree" ou "Validação Comparativa".

### Carregar ficheiro novo

1. Abrir "Upload Dataset".
2. Selecionar `.txt`, `.csv` ou `.xlsx`.
3. Escolher o tipo de dataset.
4. Mapear colunas, se necessário.
5. Clicar em "Executar analise RAMEX".
6. Gerar o relatório técnico.

### Executar scripts pela linha de comandos

```powershell
python 06_grafo.py matriz_adjacencia_dataset03.csv grafo_dataset03.png
python 07_ramex_simplificado.py grafo_edges_dataset03.csv ramex_dataset03.csv ramex_dataset03.png
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --top-k-per-node 2 --max-depth 5
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --strategy multiobjective
```

## Pipeline detalhada

### Normalização

Reconstrução das sequências a partir de dados brutos, tabelas de eventos ou ficheiros de sequências simples.

### Pares

Cada sequência e transformada em pares de transição `A → B`.

### Frequências

As transiç~ees repetidas são agregadas e contadas.

### Matriz de Adjacência

As linhas representam eventos de origem e as colunas eventos de destino. Cada célula contém a frequência da transição.

### Grafo

A matriz e convertida num grafo dirigido ponderado, onde os nós são eventos e as arestas representam transições.

### RAMEX Simplificado

Seleciona uma estrutura dominante e legivel, evitando ciclos e preservando os pesos originais das arestas escolhidas.

### RAMEX 2007 Rooted Branching

A fase `10A_ramex_2007_rooted_branching.py` inicia o alinhamento com o RAMEX puro de 2007, usando a ideia de **Maximum Weight Rooted Branching**.

Esta fase:

- transforma sequências ou arestas numa rede dirigida ponderada;
- usa frequências absolutas como pesos;
- permite raiz explícita ou escolha automática;
- suporta nós `SOURCE` e `SINK`;
- gera uma árvore/arborescência dirigida enraizada;
- valida aciclicidade e `in-degree <= 1` para todos os nós exceto a raiz.

Esta implementação é diferente das heurísticas experimentais Top-K/Multiobjetivo. O objetivo aqui é obter uma estrutura RAMEX 2007 baseada em rooted branching, maximizando a soma dos pesos selecionados sob restrições de árvore dirigida.

Exemplos:

```powershell
python 10A_ramex_2007_rooted_branching.py grafo_edges_dataset03.csv ramex2007_dataset03.csv ramex2007_dataset03.png --input-type edges --root Tecnologia
python 10A_ramex_2007_rooted_branching.py grafo_edges_dataset03.csv ramex2007_dataset03_auto.csv ramex2007_dataset03_auto.png --input-type edges
python 10A_ramex_2007_rooted_branching.py sequencias_dataset03.txt ramex2007_dataset03_seq.csv ramex2007_dataset03_seq.png --input-type sequences
```

### RAMEX Forward Heuristic

A fase `10B_ramex_forward_heuristic.py` implementa a heuristica Forward do RAMEX para casos em que existe uma raiz conhecida.

Esta heuristica:

- parte de uma raiz definida pelo utilizador;
- expande a estrutura a partir dos nos ja incluidos;
- escolhe iterativamente a transicao de maior peso para um novo no;
- evita ciclos;
- usa pesos absolutos do grafo original;
- gera CSV, JSON e PNG para analise e rastreabilidade.

Ao contrario da fase 10A, que procura uma rooted branching por maximização global ou aproximação equivalente, a heuristica Forward e uma expansao gulosa orientada pela raiz. E simples, interpretavel e util quando a analise academica ja conhece o evento inicial mais relevante.

Exemplo:

```powershell
python 10B_ramex_forward_heuristic.py grafo_edges_dataset03.csv ramex_forward_dataset03.csv ramex_forward_dataset03.png --root Tecnologia
```

### RAMEX Back-and-Forward Heuristic

A fase `10C_ramex_back_forward_heuristic.py` implementa a heuristica Back-and-Forward do RAMEX, aproximando a construcao de uma Poly-tree a partir das relacoes mais fortes do grafo.

Esta fase:

- nao exige uma raiz explicita;
- inicia a estrutura pela aresta de maior peso;
- expande para a frente, usando transicoes que saem dos nos ja incluidos;
- expande para tras, usando transicoes que entram nos nos ja incluidos;
- acrescenta novos nos sem criar ciclos;
- preserva pesos absolutos e regista a direcao de cada expansao.

A diferenca principal face a Forward e que a estrutura nao fica limitada a uma raiz conhecida. O nucleo inicial e a melhor relacao observada, e a partir dela a heuristica procura antecessores e sucessores relevantes.

Exemplo:

```powershell
python 10C_ramex_back_forward_heuristic.py grafo_edges_dataset03.csv ramex_back_forward_dataset03.csv ramex_back_forward_dataset03.png
```

### Validação Comparativa RAMEX Puro

A fase `10D_validacao_ramex_puro.py` compara os resultados das fases RAMEX puras:

- `10A` RAMEX 2007 Rooted Branching;
- `10B` RAMEX Forward Heuristic;
- `10C` RAMEX Back-and-Forward Heuristic.

A validacao lê os ficheiros JSON gerados por cada fase, normaliza as metricas comuns e produz uma tabela comparativa com:

- algoritmo e metodo;
- nos e arestas originais;
- nos e arestas selecionados;
- soma de pesos original e selecionada;
- percentagem de peso preservado;
- aciclicidade e conectividade;
- raiz ou aresta inicial;
- observacoes e avisos.

Tambem gera uma interpretacao automatica em Markdown, identificando o metodo com maior peso preservado, o metodo mais simples e o metodo mais proximo da ideia de Poly-tree RAMEX.

Exemplo:

```powershell
python 10D_validacao_ramex_puro.py dataset03
```

### Validação Multi-Dataset RAMEX Puro

A fase `10D1_validacao_ramex_multidataset.py` agrega a validação RAMEX pura em vários datasets, comparando automaticamente os resultados das fases 10A, 10B e 10C quando os respetivos JSONs existem.

Esta validação:

- processa `dataset01`, `dataset02` e `dataset03` por defeito;
- aceita uma lista explícita de datasets pela linha de comandos;
- ignora JSONs inexistentes sem interromper a execução;
- calcula ranking global por algoritmo;
- identifica o melhor método por dataset;
- calcula média e desvio padrão do peso preservado;
- identifica consistência global, simplicidade e estruturação.

Exemplos:

```powershell
python 10D1_validacao_ramex_multidataset.py
python 10D1_validacao_ramex_multidataset.py dataset01 dataset02 dataset03
python 10D1_validacao_ramex_multidataset.py dataset03
```

### RAMEX Poly-tree

Preserva múltiplos ramos relevantes a partir da raiz, aproximando melhor o conceito RAMEX com poly-trees.

A fase `10_ramex_polytree.py` suporta duas estrategias:

- `--strategy top-k`: estrategia simples e transparente, seleciona as K arestas de saída mais fortes por nó/caminho. Continua a ser a opção por defeito para manter compatibilidade.
- `--strategy multiobjective`: estrategia mais robusta, que calcula um score por aresta combinando peso normalizado, probabilidade local da transição, ganho de cobertura, centralidade do destino, penalização de redundância e penalização de complexidade.

Formula conceptual:

```text
score =
  alpha * normalized_weight
+ beta * transition_probability
+ gamma * coverage_gain
+ delta * target_centrality
- epsilon * redundancy_penalty
- zeta * complexity_penalty
```

Esta heurística evita depender apenas da frequência absoluta. O objetivo é equilibrar recorrência, cobertura, centralidade e legibilidade, tornando a Poly-tree mais defensável em contexto académico.

Exemplo:

```powershell
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03_topk.csv ramex_polytree_dataset03_topk.png --strategy top-k
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --strategy multiobjective
```

No frontend, a aba **Upload Dataset** permite escolher a estratégia Poly-tree antes da análise:

- **Top-K:** mostra top K por nó, min weight e profundidade máxima.
- **Multiobjetivo:** mostra também alpha, beta, gamma, delta, epsilon, zeta, preserve weight target, max branching e min score.

Os relatórios Markdown e PDF registam a estratégia usada, os parâmetros principais, o score e a razão de seleção das arestas quando essa informação está disponível.

Notas de interpretação:

- Top-K seleciona por peso, ordenando as transições de saída de cada nó por frequência observada.
- Multiobjetivo seleciona por score composto, equilibrando peso, probabilidade local, cobertura global, centralidade, redundância e complexidade.
- Em datasets pequenos, muito densos e com poucas alternativas estruturais, as duas estratégias podem produzir estruturas semelhantes.
- A diferença tende a ser mais visível em datasets maiores, com mais nós, ramificações e pesos heterogéneos.

### Validacao Comparativa

Compara datasets com métricas como:

- número de nos;
- número de arestas;
- densidade;
- soma dos pesos;
- peso preservado;
- interpretação automática.

## Outputs gerados

Principais ficheiros:

- `matriz_adjacencia_datasetXX.csv`
- `grafo_edges_datasetXX.csv`
- `grafo_datasetXX.png`
- `ramex_datasetXX.csv`
- `ramex_datasetXX.png`
- `ramex2007_datasetXX.csv`
- `ramex2007_datasetXX.png`
- `ramex2007_datasetXX.json`
- `ramex_forward_datasetXX.csv`
- `ramex_forward_datasetXX.png`
- `ramex_forward_datasetXX.json`
- `ramex_back_forward_datasetXX.csv`
- `ramex_back_forward_datasetXX.png`
- `ramex_back_forward_datasetXX.json`
- `validacao_ramex_puro_datasetXX.csv`
- `validacao_ramex_puro_datasetXX.md`
- `validacao_ramex_puro_datasetXX.json`
- `validacao_ramex_multidataset.csv`
- `validacao_ramex_multidataset.md`
- `validacao_ramex_multidataset.json`
- `ramex_polytree_datasetXX.csv`
- `ramex_polytree_datasetXX.png`
- `ramex_polytree_datasetXX.json`
- `validacao_comparativa.csv`
- `validacao_comparativa.txt`
- `relatorio_tecnico_datasetXX.md`
- `relatorio_tecnico_<job_id>.md`


## Trabalho futuro

- Suportar ligação direta a bases de dados.
- Comparar com outros algoritmos de *sequence mining*.

## Autoria / Contexto académico

Projeto academico desenvolvido no ambito de uma framework de Data Science / Extracao de Conhecimento de Dados.

Autoria do projeto:

- Joaquim Bonacho (2300542)
- Cesar Neves (2200745)
- Ricardo Costa (2400400)
