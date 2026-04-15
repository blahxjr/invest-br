# Prompt 16 — Rebalance Insights

## O que foi criado
- Modelo `AllocationTarget` no Prisma com migration `feat/allocation-target`.
- Server Action `saveAllocationTargets(userId, targets)` com validação Zod e tolerância de soma via Decimal.js.
- Serviço `rebalance-service.ts` com `calculateRebalance(userId)`.
- Serviço `alerts-service.ts` com `generateAlerts(userId)` para alertas de concentração e rebalanceamento.
- Tipos dedicados em `rebalance-types.ts`.
- Página principal de análise em `/insights/rebalance`.
- Página de configuração em `/insights/rebalance/config` com soma em tempo real e persistência.
- Endpoint `GET /api/insights/rebalance` com serialização de Decimal para string.
- Integração no dashboard: card de alertas com contagens por severidade e link para análise completa.
- Novos testes:
  - `__tests__/modules/rebalance-service.test.ts` (8 casos)
  - `__tests__/modules/alerts-service.test.ts` (5 casos)
  - `__tests__/components/RebalancePageClient.test.tsx` (3 casos)

## AssetClasses mapeadas no sistema
- `RENDA_FIXA`: categorias `FIXED_INCOME`
- `ACOES`: categorias `STOCK`
- `FIIS`: categorias `FII`
- `CRYPTO`: categorias `CRYPTO`
- `EXTERIOR`: categorias `FUND`, `BDR`
- `OUTROS`: categorias restantes (`ETF`, `METAL`, `REAL_ESTATE`, `CASH`, etc.)

## Fórmulas de cálculo aplicadas
- Total da carteira:
  - `totalPortfolioValue = Σ currentValue` (com fallback para `totalCost` quando sem cotação)
- Alocação atual por classe:
  - `currentValue(classe) = Σ currentValue dos ativos da classe`
  - `currentPct = (currentValue(classe) / totalPortfolioValue) × 100`
- Desvio:
  - `deviationPct = currentPct - targetPct`
- Status:
  - `OK` se `|deviationPct| <= 5`
  - `ACIMA` se `deviationPct > 5`
  - `ABAIXO` se `deviationPct < -5`
- Sugestão:
  - `suggestionValue = |deviationPct / 100| × totalPortfolioValue`
  - Label: `Aportar`, `Reduzir` ou `Balanceado`
- Todos os cálculos financeiros e percentuais foram feitos com Decimal.js.

## TODOs para P17 (polish)
- Melhorar mapeamento de classe para ativos internacionais (diferenciar ETF BR vs ETF exterior por `country/currency`).
- Adicionar accordion real na seção de alertas para detalhes expandíveis.
- Destacar desvio > 15pp com estilo visual mais forte na tabela.
- Carregar configuração inicial com skeleton e estado de erro dedicado.
- Extrair formatação monetária para utilitário compartilhado.
- Cobrir com testes de integração da Server Action `saveAllocationTargets`.
- Adicionar teste de API route `/api/insights/rebalance`.
