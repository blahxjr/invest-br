# Módulo: Posições

**Última atualização:** 2026-04-13

## Visão geral
Calcula posições abertas em tempo real a partir de transações BUY/SELL, sem tabela Position persistida.

Rota: /positions

## Estrutura
- src/modules/positions/service.ts: calcPositions, summarizePositions, getPositions
- src/modules/positions/types.ts: tipos base e tipos enriquecidos com cotação
- src/app/(app)/positions/page.tsx: Server Component que carrega posições + cotações
- src/app/(app)/positions/positions-page-client.tsx: filtros client-side

## Contratos
- calcPositions(transactions): custo médio ponderado por ativo
- summarizePositions(positions): totalCost, assetCount, totalQuantity
- getPositions(userId): uma query para BUY/SELL ordenada por data
- enrichWithQuotes(positions, quotes): adiciona currentValue, gainLoss, gainLossPercent e quoteChangePct

## Regras de calculo
- BUY: recalcula avgCost por media ponderada.
- SELL: mantem avgCost e reduz quantity/totalCost.
- Ativo com quantity <= 0 e removido do mapa.
- Resultado final ordenado por totalCost desc.

## Boundary Server -> Client
Na rota /positions, Decimal e Date sao serializados para string antes de enviar para PositionsPageClient (DEC-016).

## Testes
- __tests__/modules/positions.test.ts: 5 casos do algoritmo de custo medio
- __tests__/lib/quotes.test.ts: 4 casos do enriquecimento com cotacoes
- __tests__/components/PositionCard.test.tsx: 5 casos de renderizacao com/sem P&L

## Fora de escopo atual
- Paginacao do grid de posicoes.
