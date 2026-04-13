# Dashboard e Telas Iniciais — Fase 4

**Última atualização:** 2026-04-07

## Visão Geral

Implementação do frontend Next.js 16 com App Router, Tailwind CSS v4 e componentes React para o investidor brasileiro.

## Estrutura de Arquivos

```
src/
  app/
    layout.tsx              — Layout raiz com sidebar responsivo
    page.tsx                — Redirect automático para /dashboard
    globals.css             — Tailwind v4 (@import "tailwindcss")
    dashboard/
      page.tsx              — Visão geral: patrimônio, top 5 posições, rendimentos
      data.ts               — Server-side data fetching (getDashboardData)
    accounts/
      page.tsx              — Lista de contas com saldo e contagem de transações
    assets/
      page.tsx              — Catálogo de ativos agrupado por classe
    transactions/
      page.tsx              — Tabela de movimentações (últimas 50)
  components/
    Sidebar.tsx             — Navegação lateral + mobile drawer
    PositionCard.tsx        — Card de posição (ticker, qty, custo médio, variação)
    IncomeCard.tsx          — Card de rendimento (tipo, bruto, líquido, data)
    AccountCard.tsx         — Card de conta (nome, tipo, saldo, transações)
```

## Telas e Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redirect → `/dashboard` |
| `/dashboard` | KPI cards + Top 5 posições + Últimos rendimentos |
| `/accounts` | Grid de contas com saldo real do ledger |
| `/assets` | Catálogo agrupado por AssetClass c/ chips de categoria |
| `/transactions` | Tabela de movimentações c/ tipo colorido |

## Componentes

### PositionCard
- Exibe: ticker, nome, quantidade, custo médio, custo total, valor atual, variação (R$ e %)
- Variação verde (TrendingUp) se positiva, vermelha (TrendingDown) se negativa
- Props: `{ ticker, name, quantity, averageCost, currentValue?, category }`

### IncomeCard
- Exibe: tipo de rendimento (traduzido), ticker, valor bruto/líquido, IR retido, data
- Suporta: DIVIDEND, JCP, FII_RENT, COUPON, RENTAL
- Props: `{ type, ticker?, grossAmount, netAmount, paymentDate }`

### AccountCard
- Exibe: nome, tipo de conta (traduzido), instituição, saldo, contagem de movimentações
- Tipos: BROKERAGE → "Corretora", BANK → "Banco", etc.
- Props: `{ name, type, institutionName?, balance, transactionCount? }`

### Sidebar
- Desktop: barra lateral fixa 256px
- Mobile: header fixo com drawer overlay
- Ativo: item destacado em azul baseado em `usePathname()`
- Links: Dashboard | Contas | Ativos | Movimentações

## Stack Configurada

- **Next.js 16.2.2** (App Router + Server Components)
- **React 19.2.4**
- **Tailwind CSS 4.2.2** + `@tailwindcss/postcss`
- **Tailwind configuração:** sem `tailwind.config.js` (v4 usa CSS direta)
- **lucide-react** para ícones
- **clsx** para classes condicionais

## Configurações

### next.config.ts
```ts
serverComponentsExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg']
```

### postcss.config.js
```js
plugins: { '@tailwindcss/postcss': {} }
```

### tsconfig.json
- Target: ES2017, moduleResolution: bundler
- Path alias: `@/*` → `./src/*`

## Padrão de Data Fetching

As pages usam **React Server Components** com `Suspense`:

```tsx
async function PageContent() {
  const data = await prisma.model.findMany(...)
  return <ComponenteUI data={data} />
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <PageContent />
    </Suspense>
  )
}
```

## Testes

**21 testes de componentes** em `__tests__/components/`:

| Arquivo | Testes |
|---------|--------|
| PositionCard.test.tsx | 5 |
| IncomeCard.test.tsx | 7 |
| AccountCard.test.tsx | 6 |
| Sidebar.test.tsx | 3 |

Configuração jsdom: cada arquivo com `// @vitest-environment jsdom`

## Como Rodar

```bash
# Instalar dependências
pnpm install

# Popular banco de dados
pnpm db:seed

# Iniciar servidor de desenvolvimento
pnpm dev
# → http://localhost:3000/dashboard

# Rodar todos os testes (46 testes)
pnpm test
```

## Esquema de Dados: Dashboard

```
getDashboardData()
  ├── prisma.portfolio.findFirst()
  │     └── accounts[]
  ├── getPositionsByAccount(accountId) × N contas
  │     → agrega por ticker (custo médio ponderado)
  │     → top 5 por totalCost
  ├── prisma.ledgerEntry últimos saldos × N contas
  │     → totalPatrimony = Σ saldos + Σ custo posições
  ├── getIncomeEventsByAccount(accountId) × N contas
  │     → filtra mês atual → totalIncomeMonth
  └── últimos 5 eventos de renda → recentIncome[]
```

## Decisões Técnicas

- **DEC-008**: Next.js 16 + `serverComponentsExternalPackages` para Prisma rodarem em Server Components sem bundle
- **DEC-009**: Tailwind v4 sem `tailwind.config.js` — configuração puramente CSS com `@import "tailwindcss"`
- **DEC-010**: `environmentMatchGlobs` do vitest não funciona confiável — usar `// @vitest-environment jsdom` por arquivo
