# Módulo: Dashboard

**Última atualização:** 2026-04-13

## Visão geral
Rota principal de acompanhamento consolidado da carteira.

Rota: /dashboard

## Estrutura
- src/app/(app)/dashboard/data.ts: getDashboardData() e calcAllocation()
- src/app/(app)/dashboard/page.tsx: Server Component com serializacao de Decimal
- src/app/(app)/dashboard/dashboard-client.tsx: wrapper client para grafico
- src/components/AllocationChart.tsx: donut SVG
- src/components/PositionCard.tsx e src/components/IncomeCard.tsx: cards usados na tela

## Contratos
- calcAllocation(positions): agrupamento por categoria com percentual
- getDashboardData():
  - totalPortfolioCost
  - totalCurrentValue
  - assetCount
  - totalQuantity
  - totalIncomeMonth
  - top5Positions
  - allocationByCategory
  - recentIncome

## Regras de implementacao
- N+1 eliminado: getDashboardData() reaproveita getPositions(userId).
- Cotacoes em tempo real entram no dashboard via getQuotes() + enrichWithQuotes().
- KPI de Valor de Mercado ja esta ativo.
- Decimal e serializado antes de enviar props para componentes client (DEC-016).

## Testes
- __tests__/modules/dashboard.test.ts: 4 casos para calcAllocation
- __tests__/components/AllocationChart.test.tsx: 3 casos de renderizacao

## Fora de escopo atual
- Serie historica de valor de mercado no proprio dashboard (historico vive em /performance).
