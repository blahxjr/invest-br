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
BDR adicionado no Prompt 9 para suportar ativos como ROXO34 importados da planilha de Posição B3.
Fallback BDR → STOCK removido de src/modules/b3/service.ts.

## Testes
- Suíte completa: **108 passed, 0 failed** (validado em 2026-04-13)
- Testes do Prompt 8 (Import B3): 10 novos (negociacao, movimentacao, posicao)
- Testes do Prompt 9 (Posições): 5 novos (algoritmo de custo médio ponderado)
- Sidebar.test.tsx atualizado para refletir os itens de navegação atuais.
- Helper de testes compartilhado: __tests__/helpers/fixtures.ts (uniqueSuffix, uniqueTicker, safeDeleteMany).
- Dependência de seed removida dos testes de módulos.

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
- ADR-004: BDR com fallback para STOCK no import (resolvido no Prompt 9).

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
- Sidebar atualizada com item Proventos

### Fora de escopo nesta fase
- RentalReceipt: apenas na iteração seguinte
- Edição/exclusão de proventos
- Paginação além dos 50 mais recentes

## Módulo Import B3 (Prompt 8)

Status: implementado — import de Negociação, Movimentação e Posição.

### Escopo entregue
- src/modules/b3/parser/ — parsers puros por tipo de planilha (negociacao.ts, movimentacao.ts, posicao.ts)
- src/modules/b3/service.ts — persistência via createTransaction + upsert de Asset
- src/app/(app)/import/page.tsx + import-page-client.tsx — UI de upload com 3 cards
- src/app/(app)/import/actions.ts — Server Actions: importNegociacao, importMovimentacao, importPosicao
- Sidebar: item "Importar B3" adicionado entre Posições e Proventos
- Dependência: xlsx (SheetJS) adicionada
- Idempotência via referenceId garantida em todos os imports

### Tipos de Movimentação ignorados no import
- Cessão de Direitos, Cessão de Direitos - Solicitada
- Direito/Direitos de Subscrição, Direitos de Subscrição - Não Exercido
- Atualização

### Normalização de ticker
- Tickers fracionários (sufixo F, ex: AGRO3F) → normalizado para AGRO3 antes de busca/criação de Asset

## Módulo Posições (Prompt 9)

Status: implementado — página /positions com custo médio ponderado.

### Escopo entregue
- src/modules/positions/service.ts — getPositions(userId) + calcPositions() pura
- src/modules/positions/types.ts — Position, PositionSummary
- src/app/(app)/positions/page.tsx — Server Component
- src/app/(app)/positions/positions-page-client.tsx — Client Component com filtros client-side
- src/app/(app)/positions/positions-summary.tsx — barra de totais (custo total | ativos | cotas)
- src/app/(app)/positions/position-card.tsx — card individual com badge de categoria
- Filtros client-side por AssetCategory e AssetClass (sem re-fetch)
- Sidebar: item "Posições" entre Movimentações e Importar B3
- Sidebar.test.tsx atualizado
- Migration BDR aplicada; fallback removido de b3/service.ts

### Algoritmo de custo médio ponderado
- 1 query única: Transaction BUY/SELL com asset + assetClass aninhados
- Processamento em memória com Map<assetId, Position>
- SELL: mantém avgCost, reduz quantity e totalCost
- Ativos zerados (todos os BUY vendidos) são removidos do resultado
- Ordenação: maior totalCost primeiro

### Fora de escopo nesta fase
- Cotação em tempo real (preço atual do ativo)
- Variação percentual com preço de mercado
- Paginação

## Build e Qualidade

**Última validação:** 2026-04-13  
**Build TypeScript:** ✅ Limpo — `ignoreBuildErrors` removido de next.config.ts  
**Testes:** ✅ 108 passed, 0 failed  
**Rotas ativas:** /dashboard, /accounts, /transactions, /income, /positions, /import  
**Documentação SMTP:** ✅ Alinhada — variável correta é EMAIL_SERVER_PASSWORD  
**Actions pattern:** ✅ Server Actions retornam ActionResult<T> — sem throw direto  
**Dashboard:** ✅ getDashboardData otimizado — queries N+1 eliminadas  

## Pendências abertas
- Cotações em tempo real e séries históricas
- Variação percentual das posições com preço de mercado
- AssetIdentifier (múltiplos identificadores por ativo)
- RentalReceipt (aluguéis de imóveis)
- Edição/exclusão de transações e proventos
- Paginação nas listagens
