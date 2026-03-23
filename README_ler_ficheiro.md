RAMEX - Transformar tudo em sequências ordenadas de eventos por entidade

Diferença importante entre os 3 datasets
Dataset 03:
ler tabela
ordenar por cliente e data
agrupar em sequência
limpar repetidos consecutivos
NOTA: Os dados aqui são transacionais e cada linha é uma compra (evento). Temos cliente (Customer ID), cliente (Customer ID), timestamp (Order Date). Mas os eventos estão separados, temos de reconstruir o comportamento.
Dataset 01:
uma linha = uma sequência
só precisa ler e estruturar
NOTA: Ficou assim porque o dataset já vinha no formato sequencial. Ou seja, já temos ordem, sequência e caso implícito (linha = caso). Cada lnha = um processo - cliente - execução.

Dataset 02
Já está no formato de event log:
temos de agrupar por Case ID
ordenar por Order
formar a sequência
NOTA: Este dataset é um event log estruturado, cada linha é um evento individual. Temos múltiplas linhas por caso, ordem explícita (Order) e eventos separados. Mas o dataset não estava no formato de seuqência. Para aplicar o Ramex
temos de agrupar por Case ID, ordenar por Order e juntar os eventos numa lista. Case ID= entidade (processo, clinete, etc), Order = tempo relativo e sequência = reconstruida.

Os resultados do dataset 03 indicam:
 - 50 sequências válidas, que mostra 50 clientes diferentes com pelo menos 2 eventos úteis;
 - tamanho médio 8.04 (em médias cada cliente tem 8 eventos na sequência);
 - minimo 3 (clientes com menos dados) e máximo 17 (clienet com mais dados).

NOTA: As sequências obtidas apresentam um tamanho médio de 8 eventos por cliente, com um mínimo de 3 e um máximo de 17 eventos, que indica um nível adequado de granularidade para análise de padrões sequenciais.

Dataset 03
1 - Notas
- clientes com 1 compra → foram removidos
- permanecem apenas quem tem “histórico”
- Ramex necessita de sequências (não eventos isolados)
- Cria ficheiro sequências_dataset03.csve também em .*txt


Todos os datasets foram uniformizados para o mesmo formato sequêncial, em linha com o input exigido pelo Ramex (#id, event stream) Fonte (2015 Ramex.pdf)


| Dataset | Estrutura original            | Problema        | Solução           |
| ------- | ----------------------------- | --------------- | ----------------- |
| 01      | Sequências já prontas         | Nenhum          | Usar diretamente  |
| 02      | Event log (linhas por evento) | Falta sequência | Agrupar + ordenar |
| 03      | Dados transacionais           | Falta sequência | Agrupar + ordenar |


Sequence reconstruction from heterogeneous data sources
Os três datasets apresentam estruturas distintas: um dataset já sequencial (Dataset 01), um event log estruturado (Dataset 02) e um conjunto de dados transacionais (Dataset 03).
Assim, foi necessário aplicar diferentes estratégias de pré-processamento para reconstruir sequências temporais consistentes, garantindo que todos os dados fossem convertidos para um formato comum compatível com o algoritmo Ramex.