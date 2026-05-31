# RAMEX Sequential Analysis Framework

Framework de análise sequencial baseada em RAMEX, com separação explícita entre as principais abordagens identificadas na bibliografia:

- **RAMEX 2007 formal:** transformação da base de dados numa rede de transição de estados e aplicação de **Maximum Weight Rooted Branching**.
- **RAMEX 2015:** abordagem baseada em **poly-trees**, com **Forward Heuristic** quando existe nó inicial e **Back-and-Forward Heuristic** quando não existe nó inicial claro.
- **RAMEX-Forum temporal:** pipeline temporal de influência, com Fase 1 de transformação temporal e Fase 2 de extração estrutural por Forward Tree ou Back-and-Forward Poly-tree.
- **Sankey:** visualização complementar de fluxos agregados. Não substitui o RAMEX, mas ajuda a interpretar transições em grafos densos.

As versões exploratórias baseadas em heurísticas locais/gulosas desenvolvidas numa fase inicial continuam disponíveis apenas como comparação experimental. As abordagens finais distinguem RAMEX 2007 formal, RAMEX 2015 Forward/Back-and-Forward e RAMEX-Forum temporal.

---

## Alinhamento bibliográfico das abordagens RAMEX

| Referência | Implementação no projeto | Papel na framework |
|---|---|---|
| Cavique (2007) | RAMEX 2007 — Rooted Branching | Gera uma arborescência enraizada de peso máximo a partir de uma rede de transições. |
| Cavique (2015) | RAMEX 2015 — Forward Heuristic | Gera uma árvore quando existe nó inicial conhecido. |
| Cavique (2015) | RAMEX 2015 — Back-and-Forward Poly-tree | Gera uma poly-tree quando não existe nó inicial claro. |
| Tiple, Cavique & Marques (2017) | RAMEX-Forum temporal | Analisa influência temporal entre produtos/entidades, com sinais, latência e pesos de influência. |
| Visualização complementar | Sankey — Fluxos agregados | Mostra fluxos de transição de forma mais legível, sobretudo em grafos densos. |

---

## Instalação

### Pré-requisitos

Garantir que estão instalados:

```powershell
python --version
node -v
```

No Windows/PowerShell, o comando `npm` pode ser bloqueado por política de execução de scripts. Por isso, recomenda-se usar `npm.cmd`.

### Backend

Na primeira execução, criar o ambiente virtual e instalar dependências:

```powershell
cd backend-ramex
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Executar o backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend

Na primeira execução, instalar dependências:

```powershell
cd frontend-ramex
npm.cmd install
```

Executar o frontend:

```powershell
npm.cmd run dev -- -p 3001
```

URLs habituais:

```text
Frontend: http://localhost:3001
API:      http://127.0.0.1:8000
Health:   http://127.0.0.1:8000/api/health
```

---

## Execução rápida após a primeira instalação

Depois de as dependências estarem instaladas, normalmente basta executar dois terminais.

### Terminal 1 — Backend

```powershell
cd backend-ramex
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Terminal 2 — Frontend

```powershell
cd frontend-ramex
npm.cmd run dev -- -p 3001
```

---

## Utilização

No frontend é possível:

- escolher Dataset 01, 02 ou 03;
- carregar ficheiro `.txt`, `.csv` ou `.xlsx`;
- mapear entidade/caso, tempo/ordem e evento/sinal;
- executar `RAMEX 2007`, `RAMEX 2015`, `RAMEX-Forum temporal` ou análise combinada;
- visualizar grafo observado, estruturas RAMEX e Sankey complementar;
- exportar relatório final em Markdown ou PDF.

---

## Pipeline RAMEX 2007

O RAMEX 2007 implementado nesta framework segue a formulação formal baseada em **Maximum Weight Rooted Branching**:

1. ordenar dados por cliente/entidade, tempo e item;
2. criar `next_item`;
3. adicionar `SOURCE` e `SINK`, quando aplicável;
4. construir rede de estados `G`, com ciclos permitidos na rede original;
5. gerar matriz de adjacência com frequências absolutas;
6. aplicar Maximum Weight Rooted Branching com raiz definida;
7. validar DAG, arborescência, in-degree e peso preservado;
8. apresentar grafo técnico completo, grafo analítico e Sankey complementar.

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

---

## Pipeline RAMEX 2015

O RAMEX 2015 introduz a utilização de árvores e poly-trees para representar macro-padrões sequenciais, distinguindo duas heurísticas principais.

### Forward Heuristic

Aplicada quando existe um nó inicial conhecido ou inferido.

- Entrada: rede de transições ponderadas.
- Saída: árvore dirigida.
- Objetivo: expandir a estrutura a partir do nó inicial, selecionando transições relevantes e evitando ciclos.

### Back-and-Forward Heuristic

Aplicada quando não existe nó inicial claro.

- Entrada: rede de transições ponderadas.
- Saída: poly-tree.
- Objetivo: selecionar relações fortes em ambos os sentidos de expansão, preservando macro-padrões relevantes e mantendo uma estrutura interpretável.

Esta abordagem é especialmente útil quando se pretende obter uma leitura global dos padrões sem depender exclusivamente de uma raiz inicial.

---

## Pipeline RAMEX-Forum temporal

O RAMEX-Forum não usa frequências simples como peso principal. Trabalha sobre influência temporal, sinais, latência máxima, smoothing e filtros.

### Fase 1 — Transformação temporal

Entrada: `entity,timestamp,signal`.

Etapas:

1. ordenar por entidade, timestamp e sinal;
2. calcular `signal_counter(P,t)`;
3. calcular influência temporal `X -> Y` quando `X` ocorre antes de `Y` e `delta_t <= latency_max`;
4. usar peso inicial `frequency * temporal_decay`, com `temporal_decay = 1 / (1 + delta_t)`;
5. aplicar epsilon smoothing;
6. aplicar filtros de ruído;
7. gerar matriz e grafo temporal de influência.

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

### Fase 2 — Extração estrutural

Input principal: `forum_filtered_influence.csv`.

Peso principal: `smoothed_weight`.

Regras:

- se existir `initial_node` fornecido ou inferido, aplica Forward Heuristic e gera uma árvore de influência;
- se não existir nó inicial claro, aplica Back-and-Forward Heuristic e gera uma Poly-tree de influência;
- a rede de entrada pode conter ciclos, mas a estrutura final é validada como DAG/tree/poly-tree quando aplicável.

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

---

## Sankey — visualização complementar de fluxos

A visualização Sankey é usada como apoio interpretativo. Permite representar fluxos agregados entre eventos, produtos ou categorias, tornando mais legíveis relações que no grafo observado podem ficar demasiado densas.

Esta visualização:

- não substitui o RAMEX 2007, RAMEX 2015 ou RAMEX-Forum temporal;
- não altera os pesos calculados pela pipeline;
- ajuda a interpretar fluxos dominantes;
- pode ser usada no relatório e na demonstração final como complemento visual.

---

## Documentação complementar

- [Normalização dos datasets](docs/normalizacao-datasets.md)

---

## Frontend

Abas principais:

- **Upload / Nova Análise:** executa novas análises.
- **Grafo observado:** mostra a rede original de transições antes da condensação RAMEX.
- **RAMEX 2007:** mostra transformação formal, matriz, grafo técnico completo, grafo analítico, arborescência e tabela completa.
- **RAMEX 2015:** mostra Forward Heuristic e Back-and-Forward Poly-tree.
- **Sankey:** mostra fluxos agregados como visualização complementar.
- **RAMEX-Forum temporal:** mostra Fase 1 temporal e Fase 2 estrutural, separadas do RAMEX 2007/2015.
- **Demonstração:** percurso Dataset -> transformação -> grafo -> RAMEX 2007/2015 -> Forum -> conclusão.
- **Relatórios:** exportação final Markdown/PDF.

---

## Relatório PDF

O PDF inclui:

- secção RAMEX 2007;
- árvore técnica completa sem cortes;
- Sankey RAMEX 2007;
- secção RAMEX 2015 Forward/Back-and-Forward;
- secção RAMEX-Forum temporal — Fase 1;
- secção RAMEX-Forum temporal — Fase 2;
- comparação RAMEX 2007 vs RAMEX 2015 vs RAMEX-Forum temporal;
- limitações e trabalho futuro;
- referências académicas.

---

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

Executar RAMEX-Forum temporal por scripts:

```powershell
python backend\scripts\forum\01_forum_prepare_dataset.py data\raw\testes_SCADA.csv --entity-column ativo --time-column timestamp --signal-column estado
python backend\scripts\forum\07_forum_phase2_structural_extraction.py backend\results\forum\forum_filtered_influence.csv --initial-node Bomba_ON --force-heuristic forward
```

---

## Checklist de defesa

Ver [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md).

---

## Referências

- Cavique, L. (2007). *A Network Algorithm to Discover Sequential Patterns*. EPIA 2007, LNAI 4874, pp. 406-414.
- Cavique, L. (2015). *Ramex: A Sequence Mining Algorithm Using Poly-trees*. Advances in Intelligent Systems and Computing, 354, pp. 143-153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). *Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products*. Expert Systems, 34:e12174.
- Cavique, L. (2021). *Ciência dos Dados: Bases de Dados versus Aprendizagem Automática*. Revista de Ciência Elementar, 9(02):041.

---

## Autoria

- Joaquim Bonacho (2300542)
- César Neves (2200745)
- Ricardo Costa (2400400)
