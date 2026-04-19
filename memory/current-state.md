# Estado atual do projeto

**Última atualização:** 2026-04-19 (DEC-017 - suporte a múltiplos CSVs de posição B3)

## Prioridade V2 ativa (19/04/2026)

- Prioridade #1: **Importacao de dados** (B3 movimentacao) antes de Cripto, Previdencia, Multi-corretora e Relatorios.
- Motivo: existem falhas criticas de interconexao entre importacao e modulos operacionais (contas/ativos/posicoes).
- Diretriz: qualquer proximo ciclo deve iniciar por estabilizacao do fluxo `movimentacao -> transacao -> ledger -> posicao/ativos`.

## Riscos criticos mapeados (Importacao B3)

- UX de contas importadas: contas eram criadas automaticamente pela importacao, mas sem fluxo de edicao visivel no modulo de contas.
  - Status 19/04: **mitigado** com nova rota de edicao em `/accounts/[id]/edit` e acao "Editar conta" na listagem.
- Acoplamento de dados de ativo: no fluxo de movimentacao, ativos novos podem ser criados com nome simplificado (ticker), reduzindo qualidade de cadastro no modulo de ativos.
  - Status 19/04: **parcialmente mitigado** no fluxo principal (confirmacao do wizard), agora com nome derivado de produto e fallback seguro.
- Documentacao de importacao desatualizada em pontos do fluxo real (wizard de analise/revisao/confirmacao).
- Necessidade de reforcar testes E2E de interconexao entre modulos apos importacao (conta, transacao, ledger, posicoes, ativos).

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
- /dashboard (com metadata title)
- /dashboard/insights
- /dashboard/insights/config
- /dashboard/insights/profiles
- /accounts
- /accounts/new
- /transactions (com metadata title)
- /transactions/new
- /income (com metadata title)
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
Status: implementado com suporte a múltiplos CSVs (negociacao, movimentacao e posicao).
Arquivos-chave: src/modules/b3/parser/*.ts, src/modules/b3/service.ts, src/app/(app)/import/actions.ts
Contratos: parseNegociacaoRow, parseMovimentacaoRow, parsePosicaoRow, persistNegociacao, persistMovimentacao, syncPosicao
Nota (DEC-017): posição aceita 6 tipos de CSV da B3 (acoes, bdr, etf, fundos, rendafixa, tesourodireto), cada um com mapeamento de colunas específico. UI aceita múltiplos arquivos com `accept=".csv,.xlsx,.xls"`.

### Positions
Status: v2 completo com enriquecimento de dados, dual view, filtros e alocacao baseada em valor de mercado.
Arquivos-chave: src/modules/positions/service.ts, src/modules/positions/types.ts, src/modules/positions/history.ts, src/app/(app)/positions/positions-page-client.tsx, src/app/(app)/positions/positions-table.tsx
Contratos: 
- Service: calcPositions, summarizePositions, getPositions, enrichWithQuotes (3-pass allocation), calcSnapshotsFromTxs, calcPatrimonyHistory
- UI: PositionCard (account, institution, allocation %), PositionsTable (11 colunas sortaveis), toggle cards/table (localStorage), filtros (account, institution, search)
Recursos P18:
- Enriquecimento: accountId, accountName, institutionId, institutionName, allocationPct
- Dual view: cards vs table com toggle persistido em localStorage
- Sorting: multi-coluna com estado client-side
- Filtros: conta, instituicao, busca por ticker com reset button
- Allocation: valor de mercado (currentValue) com fallback para totalCost
- Reset script: scripts/reset-import-data.ts com confirmacao interativa
- Testes: PositionsEnrichment.test.tsx com 11 casos cobrindo UI, filters, sorting
- Correção: alocacao no dashboard usa calcAllocationWithQuotes para consistencia

### Dashboard
Status: v2 completo com valor de mercado, fallback error e alocacao por valor de mercado.
Arquivos-chave: src/app/(app)/dashboard/data.ts, src/app/(app)/dashboard/page.tsx
Contratos: calcAllocation, getDashboardData

### Insights
Status: implementado (on-the-fly + perfis configuraveis + rebalance com UX polish).
Arquivos-chave: src/modules/insights/service.ts, src/modules/insights/config-service.ts, src/app/(app)/insights/rebalance/page-client.tsx
Contratos: computeInsights, resolveEffectiveConfig, upsertInsightProfile, upsertInsightRules

### Performance
Status: implementado.
Arquivos-chave: src/app/(app)/performance/page.tsx, src/app/(app)/performance/performance-page-client.tsx, src/components/PatrimonyChart.tsx
Contratos: rota /performance com filtro client-side por periodo e KPIs de evolucao patrimonial

## UI/UX Polish Final
- ✅ Componentes reutilizáveis: EmptyState, Skeleton
- ✅ Loading routes em /dashboard, /transactions, /income, /insights/rebalance
- ✅ Error boundary em (app)/error.tsx
- ✅ Responsive design mobile-first em todas as main pages
- ✅ Rebalance table: desvio visual (▲/▼/✓), status badges com emojis, header tooltips
- ✅ Rebalance alerts: expandíveis por severidade (CRITICAL/WARNING/INFO)
- ✅ Quote fallback: "Cotação indisponível" badge + fallback value (totalCost)
- ✅ Metadata titles: Dashboard, Transactions, Income, Rebalance
- ✅ Favicon: public/favicon.svg
- ✅ Navigation mobile: menu hamburger + drawer overlay
- ✅ Cleanup: zero console.log em src/app, zero `: any` de tipos de domínio

## Testes
- Total: 304 passed, 0 failed, 0 skipped
- Arquivos de teste: 46
- Novos testes P17:
  - EmptyState.test.tsx: 4
  - Skeleton.test.tsx: 2
  - PositionCard.test.tsx: ajustado para fallback
  - TransactionsPageClient.test.tsx: empty state
  - IncomePageClient.test.tsx: empty state + outros
  - RebalancePageClient.test.tsx: desvio visual, empty states
- Destaques históricos:
  - __tests__/modules/history.test.ts: 5
  - __tests__/lib/quotes.test.ts: 4
  - __tests__/modules/positions.test.ts: 5
  - __tests__/modules/dashboard.test.ts: 4
  - __tests__/components/Sidebar.test.tsx: 3

## Build Status
- ✅ Next.js build: Compiled successfully
- ✅ TypeScript: No errors ou warnings
- ✅ All routes pre-calculated
- ✅ Favicon asset included

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
Status: implementado com suporte a múltiplos CSVs (negociacao, movimentacao e posicao).
Arquivos-chave: src/modules/b3/parser/*.ts, src/modules/b3/service.ts, src/app/(app)/import/actions.ts
Contratos: parseNegociacaoRow, parseMovimentacaoRow, parsePosicaoRow, persistNegociacao, persistMovimentacao, syncPosicao
Nota (DEC-017): posição aceita 6 tipos de CSV da B3 (acoes, bdr, etf, fundos, rendafixa, tesourodireto), cada um com mapeamento de colunas específico. UI aceita múltiplos arquivos com `accept=".csv,.xlsx,.xls"`.

### Positions
Status: v2 completo com enriquecimento de dados, dual view, filtros e alocacao baseada em valor de mercado (P18).
Arquivos-chave: src/modules/positions/service.ts, src/modules/positions/types.ts, src/modules/positions/history.ts, src/app/(app)/positions/positions-page-client.tsx, src/app/(app)/positions/positions-table.tsx, scripts/reset-import-data.ts
Contratos: 
- Service: calcPositions, summarizePositions, getPositions, enrichWithQuotes (3-pass allocation), calcSnapshotsFromTxs, calcPatrimonyHistory
- UI: PositionCard, PositionsTable, dual view toggle (localStorage), filtros (account/institution/search), sorting
Recursos P18:
- Enriquecimento: accountId, accountName, institutionId, institutionName, allocationPct em cada Position
- Dual view: cards view vs table view com toggle persistido em localStorage
- Sorting: multi-coluna ascendente/descendente/null com estado client-side
- Filtros: conta, instituicao, busca por ticker com reset button
- Allocation: recalculado com valor de mercado (currentValue), fallback para totalCost, soma 100%
- Reset script: scripts/reset-import-data.ts com confirmacao interativa para limpar dados B3
- Testes: PositionsEnrichment.test.tsx com 11 casos + ajustes em outros testes
- Correção: alocacao no dashboard agora usa calcAllocationWithQuotes para consistencia

### Dashboard
Status: v2 completo com valor de mercado.
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
- Total: 239 passed, 0 failed, 0 skipped
- Arquivos de teste: 40
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
- DEC-017: EmptyState + Skeleton como primitivos reutilizáveis
- DEC-018: Rebalance desvio visual: ▲ vermelho, ▼ âmbar, ✓ verde
- DEC-019: Quote fallback: badge "Cotação indisponível" + totalCost
- DEC-020 (novo P18): Allocation em valor de mercado (currentValue) com fallback para totalCost, soma 100% como valor

## Pendências resolvidas neste prompt (P17 polish final)
- ✅ Responsividade mobile em todas as rotas principais
- ✅ Empty states com EmptyState component
- ✅ Loading skeletons em rotas críticas
- ✅ Error boundary centralizado
- ✅ Rebalance UX polish: desvio visual, status badges, suggestion colors
- ✅ Quote fallback UX
- ✅ Metadata titles padronizadas
- ✅ Favicon criado
- ✅ Cleanup console.log e `: any`
- ✅ +11 testes adicionados/ajustados (187 total)
- ✅ Build passando
- ✅ Changelog + memory atualizados
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
