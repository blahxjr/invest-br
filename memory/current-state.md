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

### Escopo entregue
- Cadastro de Institution com create/list/update.
- Cadastro de Account com create/list/update.
- Fluxo na tela de nova conta com resolução de institution existente ou criação sob demanda por nome.
- Vinculação automática/reuso de Client principal do usuário autenticado.
- Portfólio padrão criado sob demanda para o usuário quando inexistente.

### Contratos implementados
- src/modules/institutions/service.ts
	- createInstitution(input)
	- listInstitutions()
	- updateInstitution(id, input)
- src/modules/accounts/service.ts
	- createAccount(input)
	- getAccountsByPortfolio(portfolioId)
	- getAccountsByClient(clientId)
	- updateAccount(id, input)

### Regras de vínculo vigentes
- Account exige clientId válido.
- Account exige institutionId válido.
- Account aceita portfolioId opcional (null permitido).
- Quando portfolioId é informado, ele precisa pertencer ao mesmo user do Client da conta.

## Entidades e vínculos relevantes
- User 1-N Client
- User 1-N Portfolio
- Institution 1-N Account
- Client 1-N Account
- Portfolio 1-N Account (opcional em Account)

## Schema e migrations
- Institution e Account: migration 20260408002729_institutions_accounts
- Restrições e ajustes de vínculo: migration 20260409120000_add_client_and_account_constraints
- BDR adicionado ao enum AssetCategory: migration add_bdr_to_asset_category (2026-04-13)

## Enum AssetCategory (estado atual)
```
STOCK | FII | ETF | FIXED_INCOME | FUND | CRYPTO | METAL | REAL_ESTATE | CASH | BDR
```
BDR adicionado no Prompt 9. Fallback BDR → STOCK removido de src/modules/b3/service.ts.

## Testes
- Suíte completa: **115 passed, 0 failed** (validado em 2026-04-13)
- Testes do Prompt 8 (Import B3): 10 (negociacao, movimentacao, posicao)
- Testes do Prompt 9 (Posições): 5 (algoritmo custo médio ponderado)
- Testes do Prompt 10 (Dashboard v2): 7 (4 calcAllocation + 3 AllocationChart)
- Sidebar.test.tsx: reflete todos os itens de navegação atuais
- Helper compartilhado: __tests__/helpers/fixtures.ts (uniqueSuffix, uniqueTicker, safeDeleteMany)
- Dependência de seed removida dos testes de módulos

## Decisões ativas relacionadas
- DEC-001: Prisma 7 com adapter pg obrigatório.
- DEC-002/DEC-003: prioridade de .env.local.
- DEC-005: AssetCategory (enum) separado de AssetClass (model).
- DEC-008: Prisma externalizado no runtime Node do Next.js.
- DEC-009: Tailwind v4 sem tailwind.config.js.
- DEC-010: jsdom por arquivo nos testes de componente.
- DEC-011/DEC-012/DEC-013: arquitetura de autenticação e sessão.
- DEC-014: Account com Client e Institution obrigatórios; Portfolio opcional.
- DEC-015: Insights V1 calculados on-the-fly, sem tabela Insight persistida.
- ADR-004: BDR com fallback para STOCK no import — resolvido no Prompt 9.
- DEC-016: Decimal → string/number antes de passar de Server para Client Component (Next.js não serializa Decimal).

## Módulo Insights/Rebalanceamento

Status: preparação de dados concluída.

### Escopo de preparação concluído
- Enum `InvestmentHorizon` adicionado ao schema.
- `Asset` enriquecido com `currency`, `country` e `recommendedHorizon`.
- `AssetClass` enriquecido com `recommendedHorizonBase`.
- Decisão da V1: cálculo on-the-fly, sem tabela `Insight` persistida.

### Fora de escopo nesta fase
- Sem modelo `Position` persistido.
- Sem persistência de snapshots de insight.

## Módulo Proventos (Income)

Status: implementado — listagem e cadastro de IncomeEvent.

### Escopo entregue
- src/app/(app)/income/page.tsx — listagem (últimos 50 por portfólio)
- src/app/(app)/income/new/page.tsx — formulário de cadastro
- src/app/(app)/income/new/actions.ts — createIncomeEventAction, getAccountsForUser, getAllAssetsForIncome
- src/components/IncomeEventForm.tsx — Client Component de formulário
- Sidebar: item Proventos

### Fora de escopo nesta fase
- RentalReceipt, edição/exclusão, paginação além de 50

## Módulo Import B3 (Prompt 8)

Status: implementado — import de Negociação, Movimentação e Posição.

### Escopo entregue
- src/modules/b3/parser/ — parsers por tipo (negociacao.ts, movimentacao.ts, posicao.ts)
- src/modules/b3/service.ts — persistência via createTransaction + upsert Asset
- src/app/(app)/import/ — UI de upload com 3 cards + Server Actions
- Idempotência via referenceId em todos os imports
- Normalização de ticker fracionário (sufixo F removido)

### Tipos de Movimentação ignorados
- Cessão de Direitos, Direitos de Subscrição, Atualização

## Módulo Posições (Prompt 9)

Status: implementado — /positions com custo médio ponderado.

### Escopo entregue
- src/modules/positions/service.ts — getPositions(userId) + calcPositions() pura + summarizePositions()
- src/modules/positions/types.ts — Position, PositionSummary, AllocationItem
- src/app/(app)/positions/ — page.tsx + positions-page-client.tsx + positions-summary.tsx + position-card.tsx
- Filtros client-side por AssetCategory e AssetClass
- Migration BDR aplicada; fallback removido

### Algoritmo
- 1 query única: Transaction BUY/SELL com asset + assetClass
- Map<assetId, Position> em memória; SELL mantém avgCost; ativos zerados removidos
- Ordenação: maior totalCost primeiro

## Módulo Dashboard v2 (Prompt 10)

Status: implementado — gráfico de alocação + refactor de N+1.

### Escopo entregue
- src/app/(app)/dashboard/data.ts — getDashboardData() refatorado, usa getPositions() + summarizePositions()
- src/app/(app)/dashboard/data.ts — calcAllocation() exportada como função pura
- src/app/(app)/dashboard/page.tsx — serializa Decimal→string/number para Client
- src/app/(app)/dashboard/dashboard-client.tsx — NOVO Client Component wrapper
- src/components/AllocationChart.tsx — NOVO donut chart SVG nativo com legenda

### KPIs do dashboard
- Patrimônio = totalPortfolioCost (soma de totalCost de todas as posições)
- Ativos distintos = assetCount
- Proventos do mês = aggregate de IncomeEvent do mês corrente
- Top 5 posições = positions.slice(0, 5) — sem query extra

### N+1 eliminado
- Antes: getPositionsByAccount(accountId) × N contas
- Depois: getPositions(userId) — 1 query única

### Gráfico AllocationChart
- SVG nativo (sem biblioteca externa)
- Donut chart com legenda lateral: categoria + % + valor R$
- Cores: STOCK azul | FII verde | ETF amarelo | BDR roxo | outros cinza
- Props serializadas: { category: string; value: string; percentage: string }[]

### Fora de escopo nesta fase
- Cotações em tempo real
- Variação percentual com preço de mercado
- Snapshot histórico de patrimônio

## Build e Qualidade

**Última validação:** 2026-04-13  
**Build TypeScript:** ✅ Limpo — zero erros TypeScript  
**Testes:** ✅ 115 passed, 0 failed  
**Rotas ativas:** /dashboard | /accounts | /transactions | /income | /positions | /import  
**Pattern Server→Client:** ✅ Decimal serializado para string/number antes de cruzar boundary  
**N+1:** ✅ Eliminados em dashboard e posições  

## Pendências abertas
- Cotações em tempo real e séries históricas
- Variação percentual das posições com preço de mercado
- Snapshot histórico de patrimônio (evolução no tempo)
- AssetIdentifier (múltiplos identificadores por ativo)
- RentalReceipt (aluguéis de imóveis)
- Edição/exclusão de transações e proventos
- Paginação nas listagens
