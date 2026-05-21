# Checklist de Validacao RAMEX

## Objetivo

Garantir que a framework esta pronta para demonstracao sem misturar RAMEX 2007, RAMEX-Forum e heuristicas historicas.

## Dataset 01

- [ ] RAMEX 2007 gera SOURCE e SINK.
- [ ] `next_item` existe em `ramex2007_sequences.csv`.
- [ ] Matriz de adjacencia RAMEX 2007 existe.
- [ ] Arvore tecnica completa esta disponivel sem cortes.
- [ ] Sankey RAMEX 2007 e apresentado como complementar.
- [ ] RAMEX-Forum, quando reprocessado, gera Fase 1 e Fase 2.

## Dataset 02

- [ ] RAMEX 2007 mantem frequencias absolutas.
- [ ] Rooted Branching usa raiz formal `SOURCE`.
- [ ] Estrutura final e DAG.
- [ ] PDF inclui RAMEX 2007 e visualizacoes complementares.
- [ ] RAMEX-Forum nao reutiliza grafo de frequencias simples como peso principal.

## Dataset 03

- [ ] Dataset pequeno mostra Sankey completo quando aplicavel.
- [ ] Arvore tecnica completa abre inteira no visualizador.
- [ ] Tabela completa e JSON preservam todas as arestas.
- [ ] Relatorio final exporta sem erros.

## testes_SCADA

- [ ] Input no formato `entity,timestamp,signal`.
- [ ] Timestamp real ordenado corretamente.
- [ ] `initial_node=Bomba_ON` gera Forward Tree.
- [ ] Sem `initial_node`, modo auto pode escolher Back-and-Forward quando nao ha no inicial claro.
- [ ] `delta_t` respeita `latency_max`.
- [ ] `epsilon` e filtros aparecem nas metricas.

## Validacao tecnica

- [ ] `python -m py_compile backend-ramex\forum_temporal_pipeline.py backend-ramex\main.py backend-ramex\ramex_pipeline.py`
- [ ] `python -m py_compile backend\scripts\forum\*.py`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`

## Nomenclatura

- [ ] RAMEX 2007 = transformacao formal + rooted branching.
- [ ] RAMEX-Forum = influencia temporal + Fase 1/Fase 2.
- [ ] Heuristicas antigas = historicas/experimentais.
- [ ] Frequencia absoluta nao e confundida com influencia temporal.
