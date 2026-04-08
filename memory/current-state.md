# Estado atual do projeto

**Última atualização:** 2026-04-07

## Stack confirmada
- Prisma ORM v7.7.0 + PostgreSQL (banco: `investbr`, localhost:5432)
- Driver adapter: `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7)
- Test runner: Vitest 4.1.3 + tsx
- Linguagem: TypeScript
- Sem Next.js ainda — projeto em fase de domínio/infra

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

## Enums
- `AccountType`: BROKERAGE, BANK, CRYPTO_WALLET, REAL_ESTATE, MANUAL
- `InstitutionType`: BROKER, BANK, CRYPTO_EXCHANGE, REAL_ESTATE_FUND, OTHER
- `AssetCategory`: STOCK, FII, ETF, FIXED_INCOME, FUND, CRYPTO, METAL, REAL_ESTATE, CASH
- `TransactionType`: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INCOME, RENT

## Módulos implementados
- `src/lib/prisma.ts` — singleton com PrismaPg adapter
- `src/modules/accounts/` — createAccount(), getAccountsByPortfolio()
- `src/modules/assets/` — createAssetClass(), createAsset(), getAssetByTicker(), getAssetsByClass(), getAllAssetClasses()
- `src/modules/transactions/` — createTransaction() (idempotente), getTransactionsByAccount(), getAccountBalance(), getTransactionByReference()

## Seed
- `prisma/seed.ts` — 6 classes + 15 ativos brasileiros (PETR4, ITUB4, VALE3, FIIs, ETFs)
- Rodar: `pnpm db:seed`

## Testes
- `__tests__/modules/accounts.test.ts` — 3 testes
- `__tests__/modules/assets.test.ts` — 7 testes
- `__tests__/modules/transactions.test.ts` — 7 testes (compra, venda, dividendo, idempotência, saldo)
- **Total: 17 testes passando**

## Decisões técnicas
- DEC-001: Prisma 7 requer `@prisma/adapter-pg` para conexão direta
- DEC-002/003: `.env.local` tem prioridade sobre `.env`
- DEC-004: `institutionId` em Account é opcional
- DEC-005: `AssetCategory` (enum) ≠ `AssetClass` (model)
- DEC-006: `Decimal` importado de `@prisma/client` (não de `@prisma/client/runtime/library`)
- **ADR-001**: Ledger com partidas simples + `balanceAfter` (ver `docs/decisions/ADR-001-ledger-model.md`)

## Pendências abertas
- Next.js ainda não inicializado
- `AssetIdentifier` (Épico 1.3)
- Épicos seguintes: `IncomeEvent`, `RentalReceipt`, cálculo de posição, dashboard

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
