# Normalização dos datasets

Antes da aplicação do RAMEX, todos os datasets são convertidos para um formato comum de **sequências ordenadas de eventos por entidade**.

Esta etapa é essencial porque os três datasets têm estruturas de origem diferentes. A normalização garante que todos podem ser analisados pela mesma pipeline RAMEX, independentemente do formato inicial.

---

## Objetivo da normalização

Converter dados heterogéneos para uma representação comum:

```text
#id, event stream
```

ou, de forma equivalente:

```text
Entidade / Caso -> Sequência ordenada de eventos
```

Esta representação está alinhada com a lógica do RAMEX, em que os eventos são transformados em transições consecutivas e depois acumulados numa rede de estados.

---

## Dataset 01

O Dataset 01 já se encontra em formato sequencial.

Cada linha corresponde a uma sequência completa, pelo que apenas é necessário ler, validar e estruturar os dados.

| Aspeto | Descrição |
|---|---|
| Estrutura original | Sequências já prontas |
| Entidade/caso | Implícita na linha |
| Ordem temporal | Implícita na ordem dos eventos da linha |
| Problema principal | Nenhum problema estrutural relevante |
| Solução aplicada | Usar diretamente após leitura e validação |

### Observação

Este dataset ficou assim porque já vinha no formato sequencial. Ou seja, já temos ordem, sequência e caso implícito. Cada linha pode ser interpretada como um processo, cliente ou execução.

---

## Dataset 02

O Dataset 02 está em formato de **event log estruturado**.

Cada linha representa um evento individual, existindo múltiplas linhas por caso. O dataset contém uma ordem explícita, mas não vem diretamente como sequência pronta.

| Aspeto | Descrição |
|---|---|
| Estrutura original | Event log, com linhas por evento |
| Entidade/caso | `Case ID` |
| Ordem temporal | `Order` |
| Evento | Coluna de evento/atividade |
| Problema principal | Falta reconstruir a sequência por caso |
| Solução aplicada | Agrupar por `Case ID`, ordenar por `Order` e juntar os eventos numa lista |

### Observação

Para aplicar o RAMEX, é necessário reconstruir cada sequência a partir dos eventos individuais. Assim, cada `Case ID` origina uma sequência ordenada de eventos.

---

## Dataset 03

O Dataset 03 contém dados transacionais.

Cada linha representa uma compra ou evento. Como os eventos estão separados por linhas, é necessário reconstruir o comportamento de cada cliente ao longo do tempo.

| Aspeto | Descrição |
|---|---|
| Estrutura original | Dados transacionais |
| Entidade/caso | `Customer ID` |
| Ordem temporal | `Order Date` |
| Evento | Categoria/produto |
| Problema principal | Falta reconstruir o comportamento sequencial por cliente |
| Solução aplicada | Agrupar por cliente, ordenar por data e gerar sequência de eventos |

### Regras aplicadas

- ler a tabela original;
- ordenar por cliente e data;
- agrupar eventos por cliente;
- remover repetições consecutivas quando aplicável;
- eliminar sequências com menos de dois eventos;
- exportar as sequências reconstruídas para formatos intermédios, como `.csv` e `.txt`.

### Resultados observados

No Dataset 03 foram obtidas:

- **50 sequências válidas**, correspondendo a clientes com pelo menos dois eventos úteis;
- **tamanho médio de 8,04 eventos** por cliente;
- **mínimo de 3 eventos**;
- **máximo de 17 eventos**.

Clientes com apenas uma compra foram removidos, uma vez que o RAMEX necessita de sequências e não de eventos isolados.

### Observação

As sequências obtidas apresentam granularidade adequada para análise de padrões sequenciais, uma vez que existe histórico suficiente por cliente para gerar transições entre eventos.

---

## Síntese comparativa

| Dataset | Estrutura original | Problema | Solução |
|---|---|---|---|
| Dataset 01 | Sequências já prontas | Nenhum | Usar diretamente |
| Dataset 02 | Event log, com linhas por evento | Falta reconstruir sequência | Agrupar por caso e ordenar |
| Dataset 03 | Dados transacionais | Falta reconstruir comportamento | Agrupar por cliente e ordenar |

---

## Sequence reconstruction from heterogeneous data sources

Os três datasets apresentam estruturas distintas:

- Dataset 01: dataset já sequencial;
- Dataset 02: event log estruturado;
- Dataset 03: dados transacionais.

Assim, foi necessário aplicar diferentes estratégias de pré-processamento para reconstruir sequências temporais consistentes, garantindo que todos os dados fossem convertidos para um formato comum compatível com o algoritmo RAMEX.

---

## Importância desta etapa

A qualidade da análise RAMEX depende diretamente da qualidade das sequências reconstruídas. Se os dados forem mal ordenados, mal agrupados ou demasiado fragmentados, as transições geradas podem não representar corretamente os padrões reais.

Por isso, a normalização dos datasets é uma fase crítica da pipeline:

```text
Dados originais -> Sequências reconstruídas -> Pares A->B -> Frequências -> Matriz -> Grafo -> RAMEX
```
