# Curadoria de Artefactos RAMEX

Este ficheiro classifica os artefactos versionados e locais do projeto RAMEX. A regra geral é separar código, fixtures, evidência académica e outputs temporários.

## Fixtures reais

Ficheiros de entrada usados como base dos testes e demonstrações:

- `dataset 01.txt`
- `dataset 02.txt`
- `dataset 03.xlsx`

## Fixtures derivadas

Ficheiros derivados dos datasets originais e úteis para reproduzir fases da pipeline:

- `sequencias_dataset01.csv`
- `sequencias_dataset01_limpo.txt`
- `sequencias_dataset02.csv`
- `sequencias_dataset02_limpo.txt`
- `sequencias_dataset03.csv`
- `sequencias_dataset03.txt`

## Fixtures funcionais do frontend

Ficheiros usados diretamente pelo frontend para datasets pré-carregados:

- `frontend-ramex/public/data/`

Esta pasta deve continuar versionada enquanto a aplicação depender destes dados estáticos.

## Evidência académica

Artefactos que documentam resultados, validações e figuras usadas no acompanhamento do projeto:

- outputs RAMEX na raiz do projeto;
- relatórios de validação `validacao_*`;
- figuras PNG de grafos e estruturas RAMEX;
- relatórios PDF, Markdown e TXT;
- `FASES_FRAMEWORK.md`;
- `docs/acompanhamento/`;
- `docs/referencias/`.

Estes ficheiros devem ser mantidos ou movidos futuramente para uma estrutura mais explícita, como `docs/evidencia/`, `reports/` ou `fixtures/`.

## Temporários fora do Git

Artefactos de execução local, cache ou testes pontuais:

- `.matplotlib-cache/`
- `tmp/`
- `tmp_*`
- `backend-ramex/tmp_*/`
- `frontend-ramex/output.txt`
- `backend-ramex/outputs/`
- `backend-ramex/uploads/`
- `frontend-ramex/generated-reports/`

Estes ficheiros não devem ser versionados. Se já estiverem no Git, devem sair do tracking numa fase separada, sem apagar os ficheiros locais.
