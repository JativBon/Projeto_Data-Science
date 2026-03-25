# Projeto Data Science

Projeto académico da unidade curricular de Projeto de Engenharia Informática, focado na preparação de dados sequenciais e extração de padrões de transição para análise de processos.

## Autoria

- Joaquim Bonacho (2300542)
- César Neves (2200745)
- Ricardo Costa (2400400)

## Objetivo

Uniformizar três datasets com estruturas diferentes para um formato sequencial comum e, no Dataset 03, construir uma pipeline de análise com:

- geração de sequências por entidade
- extração de pares de transição
- cálculo de frequências
- criação de matriz de adjacência
- visualização em grafo
- aplicação de heurísticas simplificadas inspiradas no Ramex

## Estrutura dos datasets

- Dataset 01: já está em formato de sequências (uma linha por sequência).
- Dataset 02: está em formato de event log (uma linha por evento), exigindo agrupamento por caso e ordenação.
- Dataset 03: contém dados transacionais, exigindo reconstrução temporal por cliente.

## Scripts principais

- `01_dataset.py`: processa o `dataset 01.txt` e gera sequências limpas.
- `02_dataset.py`: processa o `dataset 02.txt`, reconstrói sequências por caso e exporta resultados.
- `03_dataset_A.py`: fase A do Dataset 03 (sequências por cliente e limpeza de repetidos consecutivos).
- `03_criarpares_B.py`: fases A+B (sequências e pares de transição).
- `03_contarfreqpares_C.py`: fases A+B+C (contagem de frequências de pares).
- `03_matrizadj_D.py`: fases A+B+C+D (matriz de adjacência).
- `03_grafo_E.py`: fases A+B+C+D+E (grafo dirigido ponderado e grafo filtrado).
- `03_ramex_simplificado_F.py`: fases A+B+C+D+E+F (Ramex simplificado, heurística forward).
- `03_backandforward_heur.py`: variação com heurística back-and-forward e nós START/END.

## Ficheiros de saída gerados

- `sequencias_dataset01.csv`
- `sequencias_dataset01_limpo.txt`
- `sequencias_dataset02.csv`
- `sequencias_dataset02_limpo.txt`
- `sequencias_dataset03.csv`
- `sequencias_dataset03.txt`
- `pares_dataset03.csv`
- `frequencias_pares_dataset03.csv`
- `matriz_adjacencia_dataset03.csv`
- `grafo_dataset03.png`
- `grafo_dataset03_filtrado.png`
- `grafo_principal_dataset03.png`
- `grafo_ramex_simplificado_forward.png`
- `grafo_ramex_simplificado_back_forward.png`

## Requisitos

Python 3.10+ e bibliotecas:

- pandas
- openpyxl
- networkx
- matplotlib

Instalação rápida:

```bash
pip install pandas openpyxl networkx matplotlib
```

## Como executar

Executar os scripts a partir da raiz do projeto.

Exemplos:

```bash
python 01_dataset.py
python 02_dataset.py
python 03_dataset_A.py
python 03_criarpares_B.py
python 03_contarfreqpares_C.py
python 03_matrizadj_D.py
python 03_grafo_E.py
python 03_ramex_simplificado_F.py
python 03_backandforward_heur.py
```

Nota: os scripts do Dataset 03 são cumulativos por fases (A até F). Cada script mais avançado reexecuta as fases anteriores.

## Enquadramento

Este repositório foi desenvolvido no contexto de avaliação académica e demonstra um fluxo completo de preparação e modelação de sequências a partir de dados heterogéneos.
