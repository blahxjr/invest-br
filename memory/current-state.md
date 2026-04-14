# Estado atual do projeto

**Última atualização:** 2026-04-13 (checkpoint pre-Fase 3)

## Stack
- Next.js 16.2.2 (App Router) + React 19 + TypeScript
- Tailwind CSS 4.2.2 (CSS-first, sem tailwind.config.js)
- Prisma 7.7.0 + @prisma/adapter-pg + pg
- PostgreSQL (schema em prisma/schema.prisma)
- NextAuth v5 (magic link via Nodemailer, sessoes em banco)
- Vitest 4.1.3 + @testing-library/react
- xlsx (SheetJS) para importacao B3
- decimal.js para valores financeiros

## Rotas ativas
- /dashboard
- /dashboard/insights
- /dashboard/insights/config
- /dashboard/insights/profiles
- /accounts
- /accounts/new
- /transactions
- /transactions/new
- /income
- /income/new
- /positions
- /performance
- /import
- /assets
- /institutions
- /login
- /login/verify
- /api/auth/[...nextauth]

## Modulos implementados
### Accounts/Institutions
Status: implementado e coberto por testes.
Arquivos-chave: src/modules/accounts/service.ts, src/modules/institutions/service.ts
Contratos: createAccount, getAccountsByPortfolio, getAccountsByClient, updateAccount, createInstitution, listInstitutions, updateInstitution

### Assets
Status: implementado.
Arquivos-chave: src/modules/assets/service.ts
Contratos: createAssetClass, createAsset, getAssetByTicker, getAllAssetClasses, getAssetsByClass

### Transactions/Ledger
Status: implementado com idempotencia.
Arquivos-chave: src/modules/transactions/service.ts
Contratos: createTransaction, getAccountBalance, getTransactionsByAccount

### Income
Status: implementado para cadastro/listagem e calculo por conta.
Arquivos-chave: src/modules/income/service.ts
Contratos: createIncomeEvent, getIncomeEventsByAccount, getTotalIncomeByAccount, createRentalReceipt, getRentalReceiptsByAccount, calculatePositionByAsset, getPositionsByAccount

### Import B3
Status: implementado (negociacao, movimentacao e posicao).
Arquivos-chave: src/modules/b3/parser/*.ts, src/modules/b3/service.ts, src/app/(app)/import/actions.ts
Contratos: parseNegociacaoRow, parseMovimentacaoRow, parsePosicaoRow, persistNegociacao, persistMovimentacao, syncPosicao

### Positions
Status: implementado com custo medio ponderado + cotacoes + historico de patrimonio.
Arquivos-chave: src/modules/positions/service.ts, src/modules/positions/types.ts, src/modules/positions/history.ts
Contratos: calcPositions, summarizePositions, getPositions, enrichWithQuotes, calcSnapshotsFromTxs, calcPatrimonyHistory

### Dashboard
Status: implementado (v2 + valor de mercado).
Arquivos-chave: src/app/(app)/dashboard/data.ts, src/app/(app)/dashboard/page.tsx
Contratos: calcAllocation, getDashboardData

### Insights
Status: implementado (on-the-fly + perfis configuraveis).
Arquivos-chave: src/modules/insights/service.ts, src/modules/insights/config-service.ts
Contratos: computeInsights, resolveEffectiveConfig, upsertInsightProfile, upsertInsightRules

### Performance
Status: implementado.
Arquivos-chave: src/app/(app)/performance/page.tsx, src/app/(app)/performance/performance-page-client.tsx, src/components/PatrimonyChart.tsx
Contratos: rota /performance com filtro client-side por periodo e KPIs de evolucao patrimonial

## Testes
- Total: 124 passed, 0 failed, 0 skipped
- Arquivos de teste: 22
- Destaques:
  - __tests__/modules/history.test.ts: 5
  - __tests__/lib/quotes.test.ts: 4
  - __tests__/modules/positions.test.ts: 5
  - __tests__/modules/dashboard.test.ts: 4
  - __tests__/components/Sidebar.test.tsx: 3

## Decisoes tecnicas ativas
- DEC-001: Prisma 7 exige @prisma/adapter-pg
- DEC-002: DATABASE_URL via prisma.config.ts
- DEC-003: .env.local com precedencia sobre .env
- DEC-005: AssetCategory (enum) separado de AssetClass (model)
- DEC-008: Prisma externalizado no runtime Node do Next 16
- DEC-009: Tailwind v4 sem tailwind.config.js
- DEC-010: jsdom por arquivo de teste de componente
- DEC-011: autenticacao por magic link
- DEC-012: sessoes em banco
- DEC-013: session.user.id via callback
- DEC-014: Account exige clientId e institutionId; portfolioId opcional
- DEC-015: Insights v1 on-the-fly
- DEC-016: Decimal serializado no boundary Server -> Client
- DEC-017: sem any explicito em codigo de producao (pendente)

## Pendencias para Fase 3
1. Corrigir pendencias DEC-017 em insights
2. Prompt 13: movimentacoes v2 com filtros
3. Prompt 14: edicao/exclusao de transacoes e proventos
4. Prompt 15: paginacao nas listagens
5. Prompt 16: insights/rebalanceamento com UX de acao
6. Prompt 17: polish MVP

## Fora de escopo (MVP)
- AssetIdentifier completo
- Cotacoes historicas por ativo
- Motor tributario avancado
- Integracoes automaticas em tempo real
