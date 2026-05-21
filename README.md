# RAMEX Sequential Analysis Framework

Framework de analise sequencial com duas linhas claramente separadas:

- **RAMEX 2007 formal:** transformacao da base de dados numa rede de transicao de estados e aplicacao de Maximum Weight Rooted Branching.
- **RAMEX-Forum:** pipeline temporal de influencia com Fase 1, transformacao temporal, e Fase 2, extracao estrutural por Forward Tree ou Back-and-Forward Poly-tree.

As heuristicas antigas, como RAMEX simplificado, Forward e Back-and-Forward historicos, continuam disponiveis apenas como comparacao experimental. Nao substituem o RAMEX 2007 formal nem o RAMEX-Forum temporal.

## Instalacao

Backend:

```powershell
cd backend-ramex
..\venv\Scripts\python.exe -m pip install -r requirements.txt
..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend-ramex
npm install
npm.cmd run dev -- -p 3001
```

URLs habituais:

```text
Frontend: http://localhost:3001
API:      http://127.0.0.1:8000
Health:   http://127.0.0.1:8000/api/health
```

## Execucao

No frontend e possivel:

- escolher Dataset 01, 02 ou 03;
- carregar ficheiro `.txt`, `.csv` ou `.xlsx`;
- mapear entidade/caso, tempo/ordem e evento/sinal;
- executar `RAMEX 2007`, `RAMEX-Forum` ou `Both`;
- exportar relatorio final em Markdown ou PDF.

## Pipeline RAMEX 2007

O RAMEX 2007 implementado nesta framework segue a formulacao formal:

1. ordenar dados por cliente/entidade, tempo e item;
2. criar `next_item`;
3. adicionar `SOURCE` e `SINK`;
4. construir rede de estados `G` com ciclos permitidos;
5. gerar matriz de adjacencia com frequencias absolutas;
6. aplicar Maximum Weight Rooted Branching com raiz `SOURCE`;
7. validar DAG, arborescencia, in-degree e peso preservado;
8. apresentar grafo tecnico completo, grafo analitico e Sankey complementar.

Outputs principais:

- `ramex2007_ordered.csv`
- `ramex2007_sequences.csv`
- `ramex2007_graph_edges.csv`
- `ramex2007_adjacency_matrix.csv`
- `ramex2007_adjacency_matrix.png`
- `ramex2007_<job_id>.csv`
- `ramex2007_<job_id>.json`
- `ramex2007_<job_id>.png`
- `ramex2007_tree_complete.png`
- `ramex2007_expanded_paths_<job_id>.csv`

## Pipeline RAMEX-Forum

O RAMEX-Forum nao usa frequencias simples como peso principal. Trabalha sobre influencia temporal, sinais, latencia maxima, smoothing e filtros.

### Fase 1 - Transformacao temporal

Entrada: `entity,timestamp,signal`.

Etapas:

1. ordenar por entidade, timestamp e sinal;
2. calcular `signal_counter(P,t)`;
3. calcular influencia temporal `X -> Y` quando `X` ocorre antes de `Y` e `delta_t <= latency_max`;
4. usar peso inicial `frequency * temporal_decay`, com `temporal_decay = 1 / (1 + delta_t)`;
5. aplicar epsilon smoothing;
6. aplicar filtros de ruido;
7. gerar matriz e grafo temporal de influencia.

Outputs:

- `forum_ordered_dataset.csv`
- `forum_signal_counter.csv`
- `forum_temporal_influence.csv`
- `forum_filtered_influence.csv`
- `forum_influence_matrix.csv`
- `forum_influence_matrix.png`
- `forum_graph_edges.csv`
- `forum_graph.graphml`
- `forum_graph.png`
- `forum_temporal_phase1_metrics.json`

### Fase 2 - Extracao estrutural

Input principal: `forum_filtered_influence.csv`.

Peso principal: `smoothed_weight`.

Regras:

- se existir `initial_node` fornecido ou inferido, aplica Forward Heuristic e gera uma arvore de influencia;
- se nao existir no inicial claro, aplica Back-and-Forward Heuristic e gera uma Poly-tree de influencia;
- a rede de entrada pode conter ciclos, mas a estrutura final e validada como DAG/tree/poly-tree quando aplicavel.

Outputs:

- `forum_forward_tree.csv`
- `forum_forward_tree.json`
- `forum_forward_tree.png`
- `forum_back_forward_polytree.csv`
- `forum_back_forward_polytree.json`
- `forum_back_forward_polytree.png`
- `forum_phase2_structure.png`
- `forum_phase2_structure.svg`
- `forum_phase2_sankey.json`
- `forum_dominant_path.csv`
- `forum_temporal_phase2_metrics.json`

## Frontend

Abas principais:

- **Upload / Nova Analise:** executa novas analises.
- **RAMEX 2007:** mostra transformacao formal, matriz, grafo tecnico completo, grafo analitico, Sankey e tabela completa.
- **RAMEX-Forum:** mostra Fase 1 temporal e Fase 2 estrutural, separadas do RAMEX 2007.
- **Demonstracao:** percurso Dataset -> transformacao -> grafo -> RAMEX 2007 -> Forum -> conclusao.
- **Relatorios:** exportacao final Markdown/PDF.

## Relatorio PDF

O PDF inclui:

- secao RAMEX 2007;
- arvore tecnica completa sem cortes;
- Sankey RAMEX 2007;
- secao RAMEX-Forum Fase 1;
- secao RAMEX-Forum Fase 2;
- comparacao RAMEX 2007 vs RAMEX-Forum;
- limitacoes e trabalho futuro;
- referencias academicas.

## Exemplos de comandos

Validar Python:

```powershell
python -m py_compile backend-ramex\forum_temporal_pipeline.py backend-ramex\main.py backend-ramex\ramex_pipeline.py
python -m py_compile backend\scripts\forum\01_forum_prepare_dataset.py backend\scripts\forum\02_forum_signal_counter.py backend\scripts\forum\03_forum_temporal_influence.py backend\scripts\forum\04_forum_noise_filter.py backend\scripts\forum\05_forum_influence_matrix.py backend\scripts\forum\06_forum_graph_builder.py backend\scripts\forum\07_forum_phase2_structural_extraction.py
```

Validar frontend:

```powershell
cd frontend-ramex
npm.cmd run lint
npm.cmd run build
```

Executar RAMEX-Forum por scripts:

```powershell
python backend\scripts\forum\01_forum_prepare_dataset.py data\raw\testes_SCADA.csv --entity-column ativo --time-column timestamp --signal-column estado
python backend\scripts\forum\07_forum_phase2_structural_extraction.py backend\results\forum\forum_filtered_influence.csv --initial-node Bomba_ON --force-heuristic forward
```

## Checklist de defesa

Ver [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md).

## Referencias

- Cavique, L. (2007). *A Network Algorithm to Discover Sequential Patterns*. EPIA 2007, LNAI 4874, pp. 406-414.
- Cavique, L. (2015). *Ramex: A Sequence Mining Algorithm Using Poly-trees*. Advances in Intelligent Systems and Computing, 354, pp. 143-153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). *Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products*. Expert Systems, 34:e12174.
- Cavique, L. (2021). *Ciencia dos Dados: Bases de Dados versus Aprendizagem Automatica*. Revista de Ciencia Elementar, 9(02):041.

## Autoria

- Joaquim Bonacho (2300542)
- Cesar Neves (2200745)
- Ricardo Costa (2400400)
