# Estado atual do projeto

**Última atualização:** 2026-04-13

## Stack confirmada
- Prisma ORM 7.7.0 + PostgreSQL (investbr)
- Adapter obrigatório: @prisma/adapter-pg + pg
- Next.js 16.2.2 + React 19.2.4 (App Router)
- Tailwind CSS 4.2.2 (CSS-first)
- NextAuth v5 (magic link com Nodemailer + sessions em banco)
- Vitest 4.1.3 + Testing Library (jsdom em testes de componente)
- TypeScript + alias @/*
- xlsx (SheetJS) ^0.18.5 — leitura de planilhas B3 em Server Actions

## Módulo Cadastro: Instituições e Contas
Status: implementado e estabilizado.
- src/modules/institutions/service.ts — createInstitution, listInstitutions, updateInstitution
- src/modules/accounts/service.ts — createAccount, getAccountsByPortfolio, getAccountsByClient, updateAccount
- Regras: Account exige clientId e institutionId; portfolioId opcional

## Entidades e vínculos relevantes
- User 1-N Client, User 1-N Portfolio
- Institution 1-N Account, Client 1-N Account
- Portfolio 1-N Account (opcional)

## Schema e migrations
- 20260408002729_institutions_accounts
- 20260409120000_add_client_and_account_constraints
- add_bdr_to_asset_category (2026-04-13)

## Enum AssetCategory (estado atual)
```
STOCK | FII | ETF | FIXED_INCOME | FUND | CRYPTO | METAL | REAL_ESTATE | CASH | BDR
```

## Testes
- Suíte completa: **119 passed, 0 failed** (validado em 2026-04-13)
- Prompt 8 (Import B3): 10 testes
- Prompt 9 (Posições): 5 testes
- Prompt 10 (Dashboard v2): 7 testes
- Prompt 11 (Cotações): 4 quotes.test.ts + 2 PositionCard.test.tsx = **6 novos** (119 - 6 = 113 base real)
- Helper: __tests__/helpers/fixtures.ts

## Decisões ativas
- DEC-001: Prisma 7 com adapter pg obrigatório
- DEC-005: AssetCategory (enum) separado de AssetClass (model)
- DEC-008: Prisma externalizado no runtime Node do Next.js
- DEC-009: Tailwind v4 sem tailwind.config.js
- DEC-010: jsdom por arquivo nos testes de componente
- DEC-014: Account com Client e Institution obrigatórios; Portfolio opcional
- DEC-015: Insights V1 calculados on-the-fly, sem tabela Insight persistida
- DEC-016: Decimal → string/number antes de cruzar boundary Server→Client
- DEC-017: Tipagem de resposta de API externa com tipos dedicados (sem `any` explícito)
- ADR-004: BDR fallback resolvido no Prompt 9

## Módulo Proventos (Income)
Status: implementado — listagem (últimos 50) e cadastro de IncomeEvent.
Fora de escopo: RentalReceipt, edição/exclusão, paginação.

## Módulo Import B3 (Prompt 8)
Status: implementado — Negociação, Movimentação e Posição.
- Parsers puros em src/modules/b3/parser/
- Idempotência via referenceId; ticker fracionário normalizado
- Tipos de movimentação ignorados: Cessão de Direitos, Subscrição, Atualização

## Módulo Posições (Prompt 9)
Status: implementado — /positions com custo médio ponderado.
- getPositions(userId) — 1 query, Map<assetId> em memória
- Position, PositionSummary, AllocationItem em types.ts
- Filtros client-side por AssetCategory e AssetClass

## Módulo Dashboard v2 (Prompt 10)
Status: implementado.
- getDashboardData() usa getPositions() — sem N+1
- calcAllocation() pura e exportada
- AllocationChart.tsx — donut SVG nativo + legenda + Top 3 com "Outros"
- KPIs: Patrimônio (custo) | Ativos | Proventos/mês

## Módulo Cotações (Prompt 11)
Status: implementado — P&L e valor de mercado em tempo real.

### Escopo entregue
- src/lib/quotes.ts — getQuotes(tickers[]) com batching (50/req) + cache 5min (next: { revalidate: 300 }) + falha silenciosa
- src/modules/positions/types.ts — PositionWithQuote, SerializedPositionWithQuote, enrichWithQuotes() pura
- /positions/page.tsx — enriquece posições com cotações antes do client
- position-card.tsx (módulo positions) — P&L e var. dia condicionais
- src/components/PositionCard.tsx — props de P&L/quote adicionadas
- dashboard/data.ts — top5 enriquecido + totalCurrentValue
- dashboard/page.tsx — novo KPI "Valor de Mercado"
- run.md — BRAPI_TOKEN documentado como opcional

### API: Brapi.dev
- Gratuita, cobre B3 completa (STOCK, FII, ETF, BDR)
- Até 50 tickers/request — batching automático
- BRAPI_TOKEN via .env.local (opcional)
- Falha silenciosa: 429/5xx retorna [], nunca quebra a página

### Tipos novos
```typescript
PositionWithQuote = Position & {
  currentPrice:    number | null
  currentValue:    Decimal | null
  gainLoss:        Decimal | null
  gainLossPercent: Decimal | null
  quoteChangePct:  number | null
  quotedAt:        Date | null
}
SerializedPositionWithQuote   // versão string/null para cruzar boundary Server→Client
```

## Cotações em tempo real (Prompt 11)

Status: implementado.

### Escopo entregue
- Serviço de cotações Brapi com cache server-side (`revalidate: 300`) em `src/lib/quotes.ts`.
- Enriquecimento de posições com métricas de mercado via função pura `enrichWithQuotes`.
- Dashboard com KPI adicional de valor de mercado.
- Cards de posição com P&L e variação diária quando cotação está disponível.
- Falha de API com fallback silencioso (não quebra página).

### Testes
- `__tests__/lib/quotes.test.ts` cobrindo cálculos de enriquecimento.
- `__tests__/components/PositionCard.test.tsx` atualizado para cenários de P&L.

## Rentabilidade e evolução patrimonial (Prompt 12)

Status: implementado.

### Escopo entregue
- Novo módulo retrospectivo em `src/modules/positions/history.ts`:
	- `calcPatrimonyHistory(userId, period)`
	- `calcSnapshotsFromTxs(transactions, dates)` (função pura)
- Nova rota protegida `/performance` com:
	- seletor de período client-side sem refetch,
	- gráfico de linha com Recharts,
	- KPIs de P&L total, variação total, melhor mês e maior posição.
- Sidebar com novo item `Rentabilidade` entre `Posições` e `Importar B3`.

### Testes
- `__tests__/modules/history.test.ts` com 5 cenários de cálculo retrospectivo.
- `__tests__/components/Sidebar.test.tsx` atualizado para novo item e ordem.

### Build e qualidade
- `pnpm vitest run`: 124 passed, 0 failed.
- `pnpm next build`: sucesso com rota `/performance` publicada.

## Build e Qualidade

**Última validação:** 2026-04-13  
**Build TypeScript:** ✅ Zero erros  
**Testes:** ✅ 119 passed, 0 failed  
**Rotas ativas:** /dashboard | /accounts | /transactions | /income | /positions | /import  
**N+1:** ✅ Eliminados  
**Decimal→Client:** ✅ DEC-016 + SerializedPositionWithQuote  
**Sem `any` explícito:** ✅ DEC-017 — tipos dedicados para resposta Brapi  

## Pendências abertas
- Snapshot histórico de patrimônio (evolução no tempo) — Prompt 12
- P&L consolidado da carteira (gráfico de rentabilidade)
- AssetIdentifier (múltiplos identificadores por ativo)
- RentalReceipt (aluguéis de imóveis)
- Edição/exclusão de transações e proventos
- Paginação nas listagens
