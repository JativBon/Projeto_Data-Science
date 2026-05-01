# RAMEX Sequential Analysis Framework

## 1. O que é este projeto

Este projeto analisa sequências de eventos com RAMEX.
Recebe datasets simples ou tabelas de eventos, transforma-os em transições e gera matrizes, grafos, estruturas RAMEX e relatórios técnicos.
O objetivo é comparar padrões sequenciais de forma visual e rastreável, mantendo suporte para RAMEX 2007, Forward, Back-and-Forward e Poly-tree.

O projeto inclui backend Python/FastAPI, frontend Next.js e datasets pré-carregados para demonstração.

## 2. Como executar

### Backend

A partir da raiz do projeto:

```powershell
cd backend-ramex
..\venv\Scripts\python.exe -m pip install -r requirements.txt
..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Se for necessário criar um ambiente virtual novo:

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

URLs habituais:

```text
Frontend: http://localhost:3001
API:      http://127.0.0.1:8000
Health:   http://127.0.0.1:8000/api/health
```

### Datasets

No frontend, é possível:

- escolher `D01`, `D02` ou `D03`;
- carregar um ficheiro `.txt`, `.csv` ou `.xlsx`;
- mapear colunas de entidade, ordem/data e evento;
- executar a análise RAMEX;
- exportar relatório técnico em Markdown ou PDF.

## 3. Estrutura do projeto

```text
backend-ramex/
```

API FastAPI. Recebe uploads, executa a pipeline RAMEX e guarda resultados de execução.

```text
frontend-ramex/
```

Aplicação Next.js. Mostra datasets, matrizes, grafos, resultados RAMEX, validações e relatórios.

```text
frontend-ramex/public/data/
```

Dados e resultados estáticos dos datasets pré-carregados.

```text
backend-ramex/outputs/<job_id>/
```

Resultados gerados por uploads. Estes outputs são locais e não devem ser versionados.

```text
backend-ramex/uploads/
```

Ficheiros carregados durante a utilização da aplicação. Também são artefactos locais.

## 4. Pipeline RAMEX

O fluxo principal é:

1. Ler o dataset de entrada.
2. Reconstruir ou normalizar as sequências.
3. Gerar pares de transição `A -> B`.
4. Contar frequências.
5. Construir matriz de adjacência.
6. Criar grafo dirigido ponderado.
7. Gerar estruturas RAMEX e relatórios.

Representação resumida:

```text
Dataset
  -> Sequências
  -> Pares A -> B
  -> Frequências
  -> Matriz de Adjacência
  -> Grafo Dirigido Ponderado
  -> RAMEX / Validação / Relatório
```

### Variantes RAMEX incluídas

- **RAMEX 2007 Rooted Branching:** aproxima o RAMEX puro com uma arborescência dirigida de peso máximo.
- **Forward:** expande a partir de uma raiz conhecida.
- **Back-and-Forward:** expande para a frente e para trás a partir das relações mais fortes.
- **Poly-tree:** preserva vários ramos relevantes e suporta estratégias `top-k` e `multiobjective`.

Scripts principais:

```powershell
python 10A_ramex_2007_rooted_branching.py grafo_edges_dataset03.csv ramex2007_dataset03.csv ramex2007_dataset03.png --input-type edges --root Tecnologia
python 10B_ramex_forward_heuristic.py grafo_edges_dataset03.csv ramex_forward_dataset03.csv ramex_forward_dataset03.png --root Tecnologia
python 10C_ramex_back_forward_heuristic.py grafo_edges_dataset03.csv ramex_back_forward_dataset03.csv ramex_back_forward_dataset03.png
python 10_ramex_polytree.py grafo_edges_dataset03.csv ramex_polytree_dataset03.csv ramex_polytree_dataset03.png --strategy multiobjective
```

Validação:

```powershell
python 10D_validacao_ramex_puro.py dataset03
python 10D1_validacao_ramex_multidataset.py
```

## 5. Inputs e Outputs

### Inputs aceites

Sequências simples:

```text
A B C D
A C D
B D A
```

Tabela de eventos:

```text
case_id,order,event
1,1,A
1,2,B
1,3,C
2,1,A
2,2,D
```

Dataset estilo Customer/Product:

```text
Customer ID,Order Date,Category
```

Nestes casos:

- `case_id` identifica a entidade, caso ou cliente;
- `order` ou uma data define a ordem dos eventos;
- `event` identifica a categoria analisada.

### Outputs principais

Os scripts e a aplicação podem gerar:

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

## 6. Notas importantes

- `backend-ramex/outputs/`, `backend-ramex/uploads/` e `frontend-ramex/generated-reports/` são artefactos de execução e não devem ser versionados.
- Os datasets originais e os ficheiros em `frontend-ramex/public/data/` servem como base para demonstração e comparação.
- Os scripts `extract_text.py`, `extract_text_utf8.py` e `extract_weights.py` são auxiliares. Devem ser revistos antes de serem tratados como parte da pipeline principal.
- A estratégia `multiobjective` da Poly-tree usa score composto. Os parâmetros devem ser registados quando forem usados em relatórios.
- Em datasets pequenos ou muito densos, `top-k` e `multiobjective` podem produzir estruturas semelhantes.

## 7. Enquadramento académico

RAMEX é uma abordagem de *sequence mining* baseada em redes e grafos.
Neste projeto, os eventos são tratados como nós e as transições como arestas ponderadas.
O resultado pode ser lido como grafo completo, RAMEX simplificado, rooted branching, Forward, Back-and-Forward ou Poly-tree.

Referências usadas no enquadramento:

- Cavique, L. (2007). *A Network Algorithm to Discover Sequential Patterns*. EPIA 2007, LNAI 4874, pp. 406-414.
- Cavique, L. (2015). *Ramex: A Sequence Mining Algorithm Using Poly-trees*. Advances in Intelligent Systems and Computing, 354, pp. 143-153.
- Tiple, P., Cavique, L., & Marques, N. C. (2017). *Ramex-Forum: a tool for displaying and analysing complex sequential patterns of financial products*. Expert Systems, 34:e12174.
- Cavique, L. (2021). *Ciência dos Dados: Bases de Dados versus Aprendizagem Automática*. Revista de Ciência Elementar, 9(02):041.

## Autoria

- Joaquim Bonacho (2300542)
- Cesar Neves (2200745)
- Ricardo Costa (2400400)
