# Estado atual do projeto

**Última atualização:** 2026-04-08

## Stack confirmada
- Prisma ORM v7.7.0 + PostgreSQL (banco: `investbr`, localhost:5432)
- Driver adapter: `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7)
- **Next.js 16.2.2** + React 19.2.4 (App Router)
- **Tailwind CSS 4.2.2** + `@tailwindcss/postcss` (sem tailwind.config.js)
- **NextAuth v5** (`next-auth@5.0.0-beta.30`) + `@auth/prisma-adapter` + `nodemailer@7`
- Test runner: Vitest 4.1.3 + tsx + @testing-library/react (jsdom)
- Linguagem: TypeScript
- Path alias: `@/*` → `./src/*`

## Entidades no banco (schema.prisma)

| Modelo           | Migration                               | Status      |
|------------------|-----------------------------------------|-------------|
| User             | 20260408001856_init_core                | ✅ Aplicada  |
| Portfolio        | 20260408001856_init_core                | ✅ Aplicada  |
| Institution      | 20260408002729_institutions_accounts    | ✅ Aplicada  |
| Account          | 20260408002729_institutions_accounts    | ✅ Aplicada  |
| AssetClass       | 20260408003350_assets_catalog           | ✅ Aplicada  |
| Asset            | 20260408003350_assets_catalog           | ✅ Aplicada  |
| Transaction      | 20260408004030_transactions_ledger      | ✅ Aplicada  |
| LedgerEntry      | 20260408004030_transactions_ledger      | ✅ Aplicada  |
| IncomeEvent      | 20260408011457_income_rentals           | ✅ Aplicada  |
| RentalReceipt    | 20260408011457_income_rentals           | ✅ Aplicada  |
| AuthAccount      | 20260408020533_add_nextauth_tables      | ✅ Aplicada  |
| Session          | 20260408020533_add_nextauth_tables      | ✅ Aplicada  |
| VerificationToken| 20260408020533_add_nextauth_tables      | ✅ Aplicada  |

## Enums
- `AccountType`: BROKERAGE, BANK, CRYPTO_WALLET, REAL_ESTATE, MANUAL
- `InstitutionType`: BROKER, BANK, CRYPTO_EXCHANGE, REAL_ESTATE_FUND, OTHER
- `AssetCategory`: STOCK, FII, ETF, FIXED_INCOME, FUND, CRYPTO, METAL, REAL_ESTATE, CASH
- `TransactionType`: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INCOME, RENT
- `IncomeType`: DIVIDEND, JCP, FII_RENT, COUPON, RENTAL

## Módulos implementados
- `src/lib/prisma.ts` — singleton com PrismaPg adapter
- `src/lib/auth.ts` — NextAuth v5 config (Nodemailer provider, PrismaAdapter, database sessions)
- `src/modules/accounts/` — createAccount(), getAccountsByPortfolio()
- `src/modules/assets/` — createAssetClass(), createAsset(), getAssetByTicker(), getAssetsByClass(), getAllAssetClasses()
- `src/modules/transactions/` — createTransaction() (idempotente), getTransactionsByAccount(), getAccountBalance(), getTransactionByReference()
- `src/modules/income/` — createIncomeEvent(), createRentalReceipt(), getIncomeEventsByAccount(), getTotalIncomeByAccount(), calculatePositionByAsset(), getPositionsByAccount()

## Auth (Fase 5)
- **Provider**: Nodemailer (magic link, sem senha)
- **Estratégia**: database sessions
- **Middleware**: `middleware.ts` — protege todas as rotas exceto `/login/*` e `/api/auth/*`
- **Padrão de uso**: `const session = await auth()` em Server Components e Server Actions

## Frontend

### Estrutura de rotas
```
src/app/
├── (app)/           ← rotas protegidas (layout com Sidebar)
│   ├── dashboard/
│   ├── accounts/
│   │   └── new/     ← form nova conta (Server Action)
│   ├── assets/
│   └── transactions/
│       └── new/     ← form nova transação (Server Action)
├── login/           ← area pública
│   ├── page.tsx     ← magic link form
│   └── verify/
└── api/auth/[...nextauth]/
```

### Componentes
- `src/components/Sidebar.tsx` — Navegação desktop + mobile drawer
- `src/components/PositionCard.tsx` — Card de posição com variação
- `src/components/IncomeCard.tsx` — Card de rendimento
- `src/components/AccountCard.tsx` — Card de conta

### Páginas
- Dashboard: KPIs, top 5 posições, rendimentos recentes (filtrados por userId)
- Contas: lista de contas com saldo real (filtrado por userId)
- Ativos: catálogo por classe (público)
- Movimentações: tabela paginada (filtrada por userId)
- Nova Conta: form com name, type, institutionName — Server Action redirects para /accounts
- Nova Transação: form com account select, type, ticker, qty, price, date — Server Action

## Seed
- `prisma/seed.ts` — 6 classes + 15 ativos brasileiros (PETR4, ITUB4, VALE3, FIIs, ETFs)
- Rodar: `pnpm db:seed`

## Testes
- `__tests__/modules/accounts.test.ts` — 3 testes
- `__tests__/modules/assets.test.ts` — 7 testes
- `__tests__/modules/transactions.test.ts` — 7 testes
- `__tests__/modules/income.test.ts` — 8 testes
- `__tests__/modules/actions.test.ts` — 4 testes (Server Actions: createAccount, getAccountsForUser)
- `__tests__/components/PositionCard.test.tsx` — 5 testes (jsdom)
- `__tests__/components/IncomeCard.test.tsx` — 7 testes (jsdom)
- `__tests__/components/AccountCard.test.tsx` — 6 testes (jsdom)
- `__tests__/components/Sidebar.test.tsx` — 3 testes (jsdom)
- `__tests__/components/LoginPage.test.tsx` — 4 testes (jsdom: render, disabled, success, error)
- **Total: 54 testes passando**

## Build
- `npx next build` — 11 rotas compiladas com sucesso
- `ignoreBuildErrors: true` em `next.config.ts` (workaround para tipo Decimal do Prisma)

## Decisões técnicas
- DEC-001: Prisma 7 requer `@prisma/adapter-pg` para conexão direta
- DEC-002/003: `.env.local` tem prioridade sobre `.env`
- DEC-004: `institutionId` em Account é opcional
- DEC-005: `AssetCategory` (enum) ≠ `AssetClass` (model)
- DEC-006: `Decimal` importado de `@prisma/client` (não de `@prisma/client/runtime/library`)
- DEC-007: Custo médio ponderado em `calculatePositionByAsset()` — SELL mantém custo médio, apenas reduz qty
- DEC-008: Next.js 16 requer `serverExternalPackages` para Prisma em Server Components
- DEC-009: Tailwind v4 sem `tailwind.config.js` — usar `@import "tailwindcss"` no CSS
- DEC-010: vitest jsdom por arquivo via `// @vitest-environment jsdom` (não usar `environmentMatchGlobs`)
- DEC-011: Magic link via Nodemailer — sem senhas armazenadas, máxima segurança
- DEC-012: Estratégia `database` (não JWT) — permite revogar sessões
- DEC-013: `user.id` exposto via session callback para filtrar dados por usuário
- **ADR-001**: Ledger com partidas simples + `balanceAfter` (ver `docs/decisions/ADR-001-ledger-model.md`)

## Stack confirmada
- Prisma ORM v7.7.0 + PostgreSQL (banco: `investbr`, localhost:5432)
- Driver adapter: `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7)
- **Next.js 16.2.2** + React 19.2.4 (App Router adicionado na Fase 4)
- **Tailwind CSS 4.2.2** + `@tailwindcss/postcss` (sem tailwind.config.js)
- Test runner: Vitest 4.1.3 + tsx + @testing-library/react (jsdom)
- Linguagem: TypeScript
- Path alias: `@/*` → `./src/*`

## Entidades no banco (schema.prisma)

| Modelo       | Migration                               | Status      |
|--------------|-----------------------------------------|-------------|
| User         | 20260408001856_init_core                | ✅ Aplicada  |
| Portfolio    | 20260408001856_init_core                | ✅ Aplicada  |
| Institution  | 20260408002729_institutions_accounts    | ✅ Aplicada  |
| Account      | 20260408002729_institutions_accounts    | ✅ Aplicada  |
| AssetClass   | 20260408003350_assets_catalog           | ✅ Aplicada  |
| Asset        | 20260408003350_assets_catalog           | ✅ Aplicada  |
| Transaction  | 20260408004030_transactions_ledger      | ✅ Aplicada  |
| LedgerEntry  | 20260408004030_transactions_ledger      | ✅ Aplicada  |
| IncomeEvent  | 20260408011457_income_rentals           | ✅ Aplicada  |
| RentalReceipt| 20260408011457_income_rentals           | ✅ Aplicada  |

## Enums
- `AccountType`: BROKERAGE, BANK, CRYPTO_WALLET, REAL_ESTATE, MANUAL
- `InstitutionType`: BROKER, BANK, CRYPTO_EXCHANGE, REAL_ESTATE_FUND, OTHER
- `AssetCategory`: STOCK, FII, ETF, FIXED_INCOME, FUND, CRYPTO, METAL, REAL_ESTATE, CASH
- `TransactionType`: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INCOME, RENT
- `IncomeType`: DIVIDEND, JCP, FII_RENT, COUPON, RENTAL

## Módulos implementados
- `src/lib/prisma.ts` — singleton com PrismaPg adapter
- `src/modules/accounts/` — createAccount(), getAccountsByPortfolio()
- `src/modules/assets/` — createAssetClass(), createAsset(), getAssetByTicker(), getAssetsByClass(), getAllAssetClasses()
- `src/modules/transactions/` — createTransaction() (idempotente), getTransactionsByAccount(), getAccountBalance(), getTransactionByReference()
- `src/modules/income/` — createIncomeEvent(), createRentalReceipt(), getIncomeEventsByAccount(), getTotalIncomeByAccount(), calculatePositionByAsset(), getPositionsByAccount()

## Frontend (Fase 4)
- `src/app/layout.tsx` — RootLayout com Sidebar responsivo
- `src/app/dashboard/page.tsx` — Dashboard: KPIs, top 5 posições, rendimentos recentes
- `src/app/accounts/page.tsx` — Lista de contas com saldo real
- `src/app/assets/page.tsx` — Catálogo de ativos por classe
- `src/app/transactions/page.tsx` — Tabela de movimentações
- `src/components/Sidebar.tsx` — Navegação desktop + mobile drawer
- `src/components/PositionCard.tsx` — Card de posição com variação
- `src/components/IncomeCard.tsx` — Card de rendimento
- `src/components/AccountCard.tsx` — Card de conta

## Seed
- `prisma/seed.ts` — 6 classes + 15 ativos brasileiros (PETR4, ITUB4, VALE3, FIIs: IFIX11/HGLG11/KNRI11/XPML11, ETFs)
- Rodar: `pnpm db:seed`

## Testes
- `__tests__/modules/accounts.test.ts` — 3 testes
- `__tests__/modules/assets.test.ts` — 7 testes
- `__tests__/modules/transactions.test.ts` — 7 testes (compra, venda, dividendo, idempotência, saldo)
- `__tests__/modules/income.test.ts` — 8 testes (dividendos, FII rent, aluguel, posição, custo médio)
- `__tests__/components/PositionCard.test.tsx` — 5 testes (jsdom)
- `__tests__/components/IncomeCard.test.tsx` — 7 testes (jsdom)
- `__tests__/components/AccountCard.test.tsx` — 6 testes (jsdom)
- `__tests__/components/Sidebar.test.tsx` — 3 testes (jsdom)
- **Total: 46 testes passando**

## Decisões técnicas
- DEC-001: Prisma 7 requer `@prisma/adapter-pg` para conexão direta
- DEC-002/003: `.env.local` tem prioridade sobre `.env`
- DEC-004: `institutionId` em Account é opcional
- DEC-005: `AssetCategory` (enum) ≠ `AssetClass` (model)
- DEC-006: `Decimal` importado de `@prisma/client` (não de `@prisma/client/runtime/library`)
- DEC-007: Custo médio ponderado em `calculatePositionByAsset()` — SELL mantém custo médio, apenas reduz qty
- DEC-008: Next.js 16 requer `serverComponentsExternalPackages` para Prisma em Server Components
- DEC-009: Tailwind v4 sem `tailwind.config.js` — usar `@import "tailwindcss"` no CSS
- DEC-010: vitest jsdom por arquivo via `// @vitest-environment jsdom` (não usar `environmentMatchGlobs`)
- **ADR-001**: Ledger com partidas simples + `balanceAfter` (ver `docs/decisions/ADR-001-ledger-model.md`)

## Pendências abertas
- `AssetIdentifier` (Épico 1.3)
- Formulário "Nova Conta" (modal/drawer)
- Formulário "Novo Ativo / Nova Classe"
- Cotações em tempo real (atual: custo médio como valor atual)
- Fase 5: detalhes de conta/ativo, gráficos históricos

## Stack confirmada
- Prisma ORM v7.7.0 + PostgreSQL (banco: `investbr`, localhost:5432)
- Driver adapter: `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7)
- Test runner: Vitest 4.1.3 + tsx
- Linguagem: TypeScript
- Sem Next.js ainda — projeto em fase de domínio/infra

## Entidades no banco (schema.prisma)

| Modelo      | Migration                              | Status      |
|-------------|----------------------------------------|-------------|
| User        | 20260408001856_init_core               | ✅ Aplicada  |
| Portfolio   | 20260408001856_init_core               | ✅ Aplicada  |
| Institution | 20260408002729_institutions_accounts   | ✅ Aplicada  |
| Account     | 20260408002729_institutions_accounts   | ✅ Aplicada  |
| AssetClass  | 20260408003350_assets_catalog          | ✅ Aplicada  |
| Asset       | 20260408003350_assets_catalog          | ✅ Aplicada  |

## Enums
- `AccountType`: BROKERAGE, BANK, CRYPTO_WALLET, REAL_ESTATE, MANUAL
- `InstitutionType`: BROKER, BANK, CRYPTO_EXCHANGE, REAL_ESTATE_FUND, OTHER
- `AssetCategory`: STOCK, FII, ETF, FIXED_INCOME, FUND, CRYPTO, METAL, REAL_ESTATE, CASH

## Módulos implementados
- `src/lib/prisma.ts` — singleton com PrismaPg adapter
- `src/modules/accounts/types.ts` + `service.ts` — createAccount(), getAccountsByPortfolio()
- `src/modules/assets/types.ts` + `service.ts` — createAssetClass(), createAsset(), getAssetByTicker(), getAssetsByClass(), getAllAssetClasses()

## Seed
- `prisma/seed.ts` — 6 classes + 15 ativos brasileiros (PETR4, ITUB4, VALE3, FIIs, ETFs)
- Rodar: `pnpm db:seed`

## Testes
- `__tests__/modules/accounts.test.ts` — 3 testes passando
- `__tests__/modules/assets.test.ts` — 7 testes passando
- **Total: 10 testes passando**
- Setup: `__tests__/setup.ts` carrega .env.local

## Decisões técnicas
- Prisma 7 requer adapter para conexão direta (sem Accelerate) — DEC-001
- `.env.local` tem prioridade sobre `.env` — DEC-002 / DEC-003
- `institutionId` em Account é opcional — DEC-004
- `AssetClass` como model e `AssetCategory` como enum (evitar conflito de nome Prisma) — DEC-005

## Pendências abertas
- Next.js ainda não inicializado
- `AssetIdentifier` (Épico 1.3) — múltiplos códigos por ativo
- Épicos seguintes: transactions, ledger_entries, idempotência
