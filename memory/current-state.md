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

### Contratos implementados
- src/modules/institutions/service.ts — createInstitution, listInstitutions, updateInstitution
- src/modules/accounts/service.ts — createAccount, getAccountsByPortfolio, getAccountsByClient, updateAccount

### Regras de vínculo vigentes
- Account exige clientId e institutionId válidos; portfolioId opcional.

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
BDR adicionado no Prompt 9. Fallback BDR → STOCK removido.

## Testes
- Suíte completa: **115 passed, 0 failed** (validado em 2026-04-13)
- Prompt 8 (Import B3): 10 testes
- Prompt 9 (Posições): 5 testes (algoritmo custo médio)
- Prompt 10 (Dashboard v2): 7 testes (4 calcAllocation + 3 AllocationChart)
- Próxima meta após Prompt 11: 121 passed
- Helper: __tests__/helpers/fixtures.ts (uniqueSuffix, uniqueTicker, safeDeleteMany)

## Decisões ativas
- DEC-001: Prisma 7 com adapter pg obrigatório
- DEC-005: AssetCategory (enum) separado de AssetClass (model)
- DEC-008: Prisma externalizado no runtime Node do Next.js
- DEC-009: Tailwind v4 sem tailwind.config.js
- DEC-010: jsdom por arquivo nos testes de componente
- DEC-014: Account com Client e Institution obrigatórios; Portfolio opcional
- DEC-015: Insights V1 calculados on-the-fly, sem tabela Insight persistida
- DEC-016: Decimal → string/number antes de cruzar boundary Server→Client
- ADR-004: BDR fallback resolvido no Prompt 9

## Módulo Proventos (Income)
Status: implementado — listagem (últimos 50) e cadastro de IncomeEvent.
Fora de escopo: RentalReceipt, edição/exclusão, paginação.

## Módulo Import B3 (Prompt 8)
Status: implementado — Negociação, Movimentação e Posição.
- Parsers puros em src/modules/b3/parser/
- Idempotência via referenceId; ticker fracionário normalizado (sufixo F removido)
- Tipos de movimentação ignorados: Cessão de Direitos, Subscrição, Atualização

## Módulo Posições (Prompt 9)
Status: implementado — /positions com custo médio ponderado.
- src/modules/positions/service.ts — getPositions(userId) + calcPositions() + summarizePositions()
- src/modules/positions/types.ts — Position, PositionSummary, AllocationItem
- Filtros client-side por AssetCategory e AssetClass
- 1 query única, Map<assetId> em memória, ativos zerados removidos

## Módulo Dashboard v2 (Prompt 10)
Status: implementado — gráfico de alocação + refactor N+1.
- getDashboardData() usa getPositions() — eliminou N+1
- calcAllocation() exportada como função pura
- AllocationChart.tsx — donut SVG nativo + legenda + Top 3 por categoria com rótulo "Outros"
- dashboard-client.tsx — Client Component wrapper
- KPIs: Patrimônio (custo total) | Ativos distintos | Proventos do mês
- Top 5 posições via positions.slice(0, 5)

## Módulo Cotações (Prompt 11)
Status: **em implementação**

### Escopo previsto
- src/lib/quotes.ts — getQuotes(tickers[]) com cache 5min (next: { revalidate: 300 })
- src/modules/positions/types.ts — PositionWithQuote + enrichWithQuotes() pura
- /positions/page.tsx — enriquece posições com cotações antes de passar ao client
- position-card.tsx — exibe P&L e variação do dia condicionalmente
- dashboard/data.ts — enriquece top5 + novo KPI totalCurrentValue (Valor de Mercado)

### API: Brapi.dev
- Gratuita, cobre B3 completa (STOCK, FII, ETF, BDR)
- Até 50 tickers por request — batching automático
- Token via BRAPI_TOKEN (opcional, aumenta rate limit)
- Falha silenciosa: posição exibe sem preço, nunca quebra a página

### Variável de ambiente nova
```
BRAPI_TOKEN=seu_token   # opcional — https://brapi.dev
```

### Testes previstos (6 novos)
- 4 testes de enrichWithQuotes (função pura, sem fetch)
- 2 testes de PositionCard (P&L positivo/negativo, omissão sem preço)

## Build e Qualidade

**Última validação:** 2026-04-13  
**Build TypeScript:** ✅ Zero erros  
**Testes:** ✅ 115 passed, 0 failed  
**Rotas ativas:** /dashboard | /accounts | /transactions | /income | /positions | /import  
**N+1:** ✅ Eliminados em dashboard e posições  
**Decimal→Client:** ✅ DEC-016 aplicada  

## Pendências abertas
- Variação % das posições com preço de mercado (desbloqueada após Prompt 11)
- Snapshot histórico de patrimônio (evolução no tempo)
- AssetIdentifier (múltiplos identificadores por ativo)
- RentalReceipt (aluguéis de imóveis)
- Edição/exclusão de transações e proventos
- Paginação nas listagens
