# Módulo de Rentabilidade

## Objetivo

Exibir a evolução do patrimônio da carteira ao longo do tempo com base em custo histórico (V1), sem depender de snapshots persistidos.

## Escopo da V1

- Rota protegida: `/performance`
- Seletor de período client-side: `1M`, `3M`, `6M`, `1Y`, `ALL`
- Cálculo retrospectivo em memória a partir de transações `BUY`/`SELL`
- Gráfico de linha com Recharts
- KPIs:
  - P&L total (R$)
  - Variação total (%)
  - Melhor mês
  - Maior posição atual

## Arquitetura

### Domínio

Arquivo: `src/modules/positions/history.ts`

- `calcPatrimonyHistory(userId, period)`
  - Busca transações `BUY`/`SELL` do usuário em 1 query
  - Define pontos de data conforme período
  - Recalcula posições e resumo para cada ponto
- `calcSnapshotsFromTxs(transactions, dates)`
  - Função pura para snapshots retrospectivos
  - Facilita testes unitários sem banco

### Apresentação

Arquivos:
- `src/app/(app)/performance/page.tsx`
- `src/app/(app)/performance/performance-page-client.tsx`
- `src/app/(app)/performance/patrimony-chart.tsx`
- `src/components/PatrimonyChart.tsx`

Fluxo:
1. Server carrega `ALL` snapshots e calcula KPIs
2. Server serializa Decimal para string
3. Client filtra período sem refetch
4. Recharts renderiza série temporal responsiva

## Regras de cálculo

- Patrimônio V1 = soma de `totalCost` das posições abertas no ponto da linha do tempo
- `1M`: ~30 pontos diários
- `3M`, `6M`, `1Y`: pontos semanais
- `ALL`: pontos mensais desde a primeira transação

## Testes

Arquivo: `__tests__/modules/history.test.ts`

Cobertura principal:
- Snapshot zero antes da primeira transação
- Acúmulo com múltiplos BUY
- Redução após SELL parcial
- Remoção de ativo zerado
- Independência entre ativos

## Dependências

- `recharts`

## Limitações conhecidas (V1)

- Não usa cotações históricas por ativo
- Não calcula valor de mercado histórico
- Não persiste snapshots

## Evolução planejada (V2)

- Série histórica de valor de mercado por ativo
- Rentabilidade time-weighted e money-weighted
- Persistência de snapshots para consultas rápidas
