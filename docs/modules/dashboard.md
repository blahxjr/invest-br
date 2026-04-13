# Módulo: Dashboard

**Última atualização:** 2026-04-13 (v2 — Prompt 10)

## Visão Geral

Página principal do sistema. Exibe o patrimônio consolidado da carteira, KPIs financeiros, gráfico de alocação por categoria, Top 5 posições e últimos proventos.

Rota: `/dashboard`

---

## Estrutura de Arquivos

```
src/
  app/
    (app)/
      dashboard/
        data.ts               ← getDashboardData(userId) + calcAllocation() pura
        page.tsx              ← Server Component (busca dados + serializa Decimal)
        dashboard-client.tsx  ← Client Component wrapper
  components/
    AllocationChart.tsx       ← Donut chart SVG nativo
    PositionCard.tsx          ← Card de posição (existente)
    IncomeCard.tsx            ← Card de provento (existente)
  __tests__/
    modules/
      dashboard.test.ts       ← 4 testes de calcAllocation() (sem banco)
    components/
      AllocationChart.test.tsx ← 3 testes do componente
```

---

## Dados: `getDashboardData(userId)`

### Queries executadas (3 no total — sem N+1)

```
1. getPositions(userId)          ← 1 query (Transaction BUY/SELL + asset + assetClass)
2. prisma.incomeEvent.findMany   ← últimos 5 proventos
3. prisma.incomeEvent.aggregate  ← soma net do mês corrente
```

### Retorno

```typescript
{
  totalPortfolioCost:  Decimal   // patrimônio = soma de totalCost das posições
  assetCount:          number    // ativos distintos com posição aberta
  totalQuantity:       Decimal   // soma de cotas
  totalIncomeMonth:    Decimal   // proventos líquidos do mês
  top5Positions:       Position[] // 5 maiores por totalCost
  allocationByCategory: AllocationItem[]
  recentIncome:        IncomeEvent[]
}
```

---

## `calcAllocation(positions)` — Função Pura

Exportada separadamente para ser testável sem banco.

```typescript
export function calcAllocation(positions: Position[]): AllocationItem[]

// AllocationItem:
// { category: string; value: Decimal; percentage: Decimal }

// Algoritmo:
// 1. Soma totalCost de todos os ativos → total
// 2. Agrupa por category com Map
// 3. Calcula percentage = (value / total) * 100
// 4. Ordena por value decrescente
```

---

## Serialização Decimal (DEC-016)

Next.js não serializa `Decimal` entre Server e Client Components.  
O `page.tsx` converte antes de passar props para `DashboardClient`:

```typescript
// No page.tsx (Server Component):
const allocationForClient = data.allocationByCategory.map(item => ({
  category:   item.category,
  value:      item.value.toFixed(2),      // string
  percentage: item.percentage.toFixed(1), // string
}))

const kpis = {
  totalPortfolioCost: data.totalPortfolioCost.toFixed(2), // string
  assetCount:         data.assetCount,                    // number (ok)
  totalIncomeMonth:   data.totalIncomeMonth.toFixed(2),   // string
}
```

---

## Layout do Dashboard

```
┌───────────────────────────────────────────────────────────────┐
│  KPIs: [Patrimônio] [Ativos] [Proventos/mês]            │
├───────────────────────────────────┬─────────────────────────┤
│  AllocationChart (donut + legenda) │  Top 5 Posições    │
├───────────────────────────────────┴─────────────────────────┤
│  Últimos Proventos [IncomeCard x5]                       │
└───────────────────────────────────────────────────────────────┘
```

---

## `AllocationChart` — Componente

```typescript
// 'use client'
// Props: items: { category: string; value: string; percentage: string }[]
```

**Implementação:** SVG nativo (sem biblioteca externa)  
**Formato:** Donut chart + legenda lateral

**Cores por categoria:**

| Category | Cor | Hex |
|----------|-----|-----|
| STOCK | Azul | `#3b82f6` |
| FII | Verde | `#22c55e` |
| ETF | Amarelo | `#eab308` |
| BDR | Roxo | `#a855f7` |
| Outros | Cinza | `#94a3b8` |

**Estado vazio:** exibe mensagem "sem posições" quando `items` está vazio.

---

## Testes

### `dashboard.test.ts` — 4 testes de `calcAllocation` (sem banco)

| Caso | Validação |
|------|-----------|
| Percentual correto | STOCK 30%, FII 70% |
| Ordenação | maior value primeiro |
| Carteira vazia | retorna array vazio |
| Agrupamento | múltiplos ativos da mesma categoria somam value |

### `AllocationChart.test.tsx` — 3 testes de componente

| Caso | Validação |
|------|-----------|
| Legendas | renderiza categoria + percentual |
| SVG | elemento svg presente no DOM |
| Estado vazio | mensagem "sem posições" |

---

## Histórico de Versões

| Versão | Prompt | O que mudou |
|--------|--------|-------------|
| v1 | Prompt 4 | Dashboard inicial: KPIs + Top 5 + Proventos (com N+1) |
| v2 | Prompt 10 | Refactor N+1 → getPositions(); AllocationChart; DEC-016 serialização |

---

## Fora de Escopo (fase atual)

- Cotações em tempo real
- Variação % com preço de mercado
- Snapshot histórico de patrimônio (evolução no tempo)
