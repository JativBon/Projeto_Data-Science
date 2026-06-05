# Checklist de Validacao RAMEX

## Objetivo

Garantir que a framework esta pronta para demonstracao sem misturar RAMEX 2007, RAMEX-Forum e heuristicas historicas.

## Dataset 01

- [x] RAMEX 2007 gera SOURCE e SINK.
- [x] `next_item` existe em `ramex2007_sequences.csv`.
- [x] Matriz de adjacencia RAMEX 2007 existe.
- [x] Arvore tecnica completa esta disponivel sem cortes.
- [x] Sankey RAMEX 2007 e apresentado como complementar.
- [ ] RAMEX-Forum, quando reprocessado, gera Fase 1 e Fase 2.

## Dataset 02

- [x] RAMEX 2007 mantem frequencias absolutas.
- [x] Rooted Branching usa raiz formal `SOURCE`.
- [x] Estrutura final e DAG.
- [ ] PDF inclui RAMEX 2007 e visualizacoes complementares.
- [x] RAMEX-Forum nao reutiliza grafo de frequencias simples como peso principal.

## Dataset 03

- [ ] Dataset pequeno mostra Sankey completo quando aplicavel.
- [ ] Arvore tecnica completa abre inteira no visualizador.
- [x] Tabela completa e JSON preservam todas as arestas.
- [ ] Relatorio final exporta sem erros.

## testes_SCADA

- [x] Input no formato `entity,timestamp,signal`.
- [x] Timestamp real ordenado corretamente.
- [ ] `initial_node=Bomba_ON` gera Forward Tree.
- [ ] Sem `initial_node`, modo auto pode escolher Back-and-Forward quando nao ha no inicial claro.
- [x] `delta_t` respeita `latency_max`.
- [x] `epsilon` e filtros aparecem nas metricas.

## Validacao tecnica

- [ ] `python -m py_compile backend-ramex\forum_temporal_pipeline.py backend-ramex\main.py backend-ramex\ramex_pipeline.py`
- [ ] `python -m py_compile backend\scripts\forum\*.py`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`

## Nomenclatura

- [x] RAMEX 2007 = transformacao formal + rooted branching.
- [x] RAMEX-Forum = influencia temporal + Fase 1/Fase 2.
- [x] Heuristicas antigas = historicas/experimentais (campo `is_experimental: true` na resposta API e nota `experimental_note`).
- [x] Frequencia absoluta nao e confundida com influencia temporal.
