# Estado atual do projeto

**Última atualização:** 2026-04-13 (checkpoint pré-Fase 3)

## Stack confirmada
- Prisma ORM 7.7.0 + PostgreSQL (investbr)
- Adapter obrigatório: @prisma/adapter-pg + pg
- Next.js 16.2.2 + React 19.2.4 (App Router)
- Tailwind CSS 4.2.2 (CSS-first, sem tailwind.config.js)
- NextAuth v5 (magic link + Nodemailer + sessions em banco)
- Vitest 4.1.3 + Testing Library (jsdom por arquivo de componente)
- TypeScript + alias @/*
- xlsx (SheetJS) ^0.18.5
- decimal.js (Decimal) — nunca substituir por number nativo em valores monetários

## Rotas ativas (confirmadas em pnpm next build)

| Rota | Status |
|------|--------|
| `/dashboard` | ✅ ativo |
| `/dashboard/insights` | ✅ ativo |
| `/dashboard/insights/config` | ✅ ativo |
| `/dashboard/insights/profiles` | ✅ ativo |
| `/accounts` | ✅ ativo |
| `/accounts/new` | ✅ ativo |
| `/transactions` | ✅ ativo |
| `/transactions/new` | ✅ ativo |
| `/income` | ✅ ativo |
| `/income/new` | ✅ ativo |
| `/positions` | ✅ ativo |
| `/performance` | ✅ ativo |
| `/import` | ✅ ativo |
| `/assets` | ✅ ativo |
| `/institutions` | ✅ ativo |
| `/login` | ✅ ativo |
| `/login/verify` | ✅ ativo |
| `/api/auth/[...nextauth]` | ✅ ativo |

## Testes (auditados em 2026-04-13)

**Total: 124 passed, 0 failed, 0 skipped**

### Componentes
| Arquivo | Casos |
|---------|-------|
| AccountCard.test.tsx | 6 |
| AllocationChart.test.tsx | 3 |
| IncomeCard.test.tsx | 7 |
| InsightRulesForm.test.tsx | 4 |
| insights.test.tsx | 7 |
| LoginPage.test.tsx | 4 |
| PositionCard.test.tsx | 5 |
| Sidebar.test.tsx | 3 |

### Módulos / lib
| Arquivo | Casos |
|---------|-------|
| quotes.test.ts | 4 |
| accounts.test.ts | 11 |
| actions.test.ts | 7 |
| assets.test.ts | 7 |
| movimentacao.test.ts | 3 |
| negociacao.test.ts | 2 |
| posicao.test.ts | 2 |
| dashboard.test.ts | 4 |
| history.test.ts | 5 |
| income.test.ts | 8 |
| insights.test.ts | 10 |
| institutions.test.ts | 10 |
| positions.test.ts | 5 |
| transactions.test.ts | 7 |

## Decisões técnicas ativas

| DEC | Descrição | Status |
|-----|-----------|--------|
| DEC-001 | Prisma 7 com adapter pg obrigatório | ✅ |
| DEC-005 | AssetCategory (enum) separado de AssetClass (model) | ✅ |
| DEC-008 | Prisma externalizado no runtime Node do Next.js | ✅ |
| DEC-009 | Tailwind v4 sem tailwind.config.js | ✅ |
| DEC-010 | jsdom por arquivo nos testes de componente | ✅ confirmado |
| DEC-014 | Account com Client e Institution obrigatórios; Portfolio opcional | ✅ |
| DEC-015 | Insights V1 calculados on-the-fly, sem tabela Insight persistida | ✅ |
| DEC-016 | Decimal → string/number antes de cruzar boundary Server→Client | ✅ confirmado em /positions, /dashboard, /performance |
| DEC-017 | Sem `any` explícito em código de produção | ⚠️ **PENDÊNTE** — violações em service.ts:202-203 e config-service.ts:18,250,251,353 |
| ADR-004 | BDR fallback resolvido; enum BDR confirmado em schema.prisma | ✅ |

## Módulos implementados

### Cadastro (Instituições e Contas)
Status: ✅ estabilizado  
Contratos: createInstitution, listInstitutions, updateInstitution, createAccount, getAccountsByPortfolio, getAccountsByClient, updateAccount  
Regras: Account exige clientId + institutionId; portfolioId opcional

### Import B3 (Prompt 8)
Status: ✅ implementado  
Arquivos-chave: src/modules/b3/parser/{negociacao,movimentacao,posicao}.ts, src/modules/b3/service.ts  
Idempotência via referenceId; ticker fracionário normalizado (sufixo F removido)  
Ignorados: Cessão de Direitos, Subscrição, Atualização

### Posições (Prompt 9)
Status: ✅ implementado  
Arquivos-chave: src/modules/positions/service.ts, types.ts  
Contrato: getPositions(userId) — 1 query, Map<assetId> em memória  
Filtros client-side por AssetCategory e AssetClass

### Dashboard v2 (Prompt 10)
Status: ✅ implementado  
Arquivos-chave: src/app/(app)/dashboard/data.ts, AllocationChart.tsx  
N+1 eliminado: getDashboardData usa getPositions(userId)  
calcAllocation() pura e exportada  
KPIs: Patrimônio (custo) | Ativos | Proventos/mês | Valor de Mercado

### Cotações (Prompt 11)
Status: ✅ implementado  
Arquivos-chave: src/lib/quotes.ts, src/modules/positions/types.ts  
API: Brapi.dev — batching 50/req, cache 5min, falha silenciosa  
Tipos: PositionWithQuote, SerializedPositionWithQuote, enrichWithQuotes()  
Variável: BRAPI_TOKEN (.env.local, opcional)

### Rentabilidade / Performance (Prompt 12)
Status: ✅ implementado  
Arquivos-chave: src/modules/positions/history.ts, src/app/(app)/performance/  
Contratos: calcPatrimonyHistory(userId, period), calcSnapshotsFromTxs(txs, dates)  
Seletor client-side: page.tsx carrega ALL, client filtra sem re-fetch  
KPIs: P&L total, variação %, melhor mês, maior posição

### Insights / Rebalanceamento
Status: ✅ implementado (on-the-fly, DEC-015)  
Rotas: /dashboard/insights, /dashboard/insights/config, /dashboard/insights/profiles  
⚠️ DEC-017 pendente: `any` explícito em service.ts e config-service.ts

## Enum AssetCategory
```
STOCK | FII | ETF | FIXED_INCOME | FUND | CRYPTO | METAL | REAL_ESTATE | CASH | BDR
```

## Build e Qualidade

**Última validação:** 2026-04-13  
**Build:** ✅ pnpm next build — zero erros TypeScript  
**Testes:** ✅ 124 passed, 0 failed  
**DEC-017:** ⚠️ pendência — corrigir antes do Prompt 13  

## Pendências para Fase 3

| # | Módulo | Escopo |
|---|--------|--------|
| P13 | Fix DEC-017 | Tipar `any` em service.ts:202-203 e config-service.ts:18,250,251,353 |
| P14 | Movimentações v2 | Filtros por período, ativo, tipo |
| P15 | Edição/Exclusão | Transações e proventos |
| P16 | Paginação | Todas as listagens |
| P17 | Polish MVP | Empty states, skeletons, responsividade |

## Fora de escopo (MVP)
- AssetIdentifier (múltiplos identificadores por ativo)
- RentalReceipt (aluguéis de imóveis)
- Alertas de preço (price target)
- Snapshot histórico de valor de mercado (Rentabilidade v2 com cotações históricas)
- WebSocket / atualização sub-segundo
- Multi-portfólio com rebalanceamento automático
