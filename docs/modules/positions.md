# Módulo: Posições

## Visão Geral

Exibe as posições abertas da carteira do usuário calculadas em tempo real a partir das transações `BUY` e `SELL` registradas. Não existe modelo `Position` persistido no banco — tudo é calculado em memória com custo médio ponderado.

Rota: `/positions`

---

## Estrutura de Arquivos

```
src/
  modules/
    positions/
      service.ts          ← getPositions(userId) + calcPositions() pura
      types.ts            ← Position, PositionSummary
  app/
    (app)/
      positions/
        page.tsx                   ← Server Component
        positions-page-client.tsx  ← Client Component (filtros + grid)
        positions-summary.tsx      ← Barra de totais
        position-card.tsx          ← Card individual por ativo
  __tests__/
    modules/
      positions.test.ts            ← 5 testes do algoritmo (sem banco)
```

---

## Tipos

```typescript
// src/modules/positions/types.ts

export type Position = {
  assetId:        string
  ticker:         string
  name:           string
  category:       AssetCategory
  assetClassCode: string
  quantity:       Decimal   // cotas abertas
  avgCost:        Decimal   // preço médio ponderado por cota
  totalCost:      Decimal   // quantity × avgCost
}

export type PositionSummary = {
  totalCost:     Decimal   // soma do totalCost de todas as posições
  assetCount:    number    // ativos distintos com posição aberta
  totalQuantity: Decimal   // soma de todas as cotas
}
```

---

## Algoritmo de Custo Médio Ponderado

### Query (1 única — sem N+1)

```typescript
prisma.transaction.findMany({
  where: {
    type: { in: ['BUY', 'SELL'] },
    account: { client: { userId } },
    assetId: { not: null },
  },
  select: {
    type: true, quantity: true, price: true, totalAmount: true, date: true,
    asset: {
      select: {
        id: true, ticker: true, name: true, category: true,
        assetClass: { select: { code: true } },
      },
    },
  },
  orderBy: { date: 'asc' },
})
```

### Processamento em Memória

```
Para cada transação (ordem cronológica):

  BUY:
    newQty   = pos.quantity + tx.quantity
    newCost  = pos.totalCost + tx.totalAmount
    avgCost  = newCost / newQty
    quantity = newQty
    totalCost = newCost

  SELL:
    quantity  = pos.quantity - tx.quantity
    totalCost = pos.avgCost × quantity   ← avgCost NÃO muda
    Se quantity ≤ 0: remove ativo do Map
```

### Saída

- Apenas posições com `quantity > 0`
- Ordenadas por `totalCost` decrescente (maior posição primeiro)

---

## UI

### Barra de Totais (`positions-summary.tsx`)

Exibe 3 métricas lado a lado:

| Custo Total da Carteira | Ativos Distintos | Total de Cotas |
|-------------------------|-----------------|----------------|
| R$ 47.832,00            | 68              | 3.241          |

### Filtros (client-side)

- Por `AssetCategory`: Todas \| STOCK \| FII \| ETF \| BDR \| CRYPTO \| ...
- Por `AssetClass.code`: Todas as classes \| ACOES \| FII \| ETF \| RF \| ...
- Sem re-fetch ao filtrar — opera sobre o array recebido do Server Component

### Position Card (`position-card.tsx`)

Exibe por ativo:
- Ticker + badge de categoria (cor por tipo)
- Nome completo
- Quantidade de cotas
- Custo médio (R$/cota)
- Custo total (R$)

**Badge de categoria:**

| Category | Cor |
|----------|-----|
| STOCK    | Azul |
| FII      | Verde |
| ETF      | Amarelo |
| BDR      | Roxo |
| CRYPTO   | Laranja |

---

## Enum BDR

Adicionado no Prompt 9 via migration:

```sql
ALTER TYPE "AssetCategory" ADD VALUE 'BDR';
```

Resolve o ADR-004 (fallback BDR → STOCK que existia em `src/modules/b3/service.ts`).
BDRs como `ROXO34` agora são persistidos com a categoria correta.

---

## Testes

`__tests__/modules/positions.test.ts` — **5 testes**, todos sem banco (função pura `calcPositions`):

| Caso | Validação |
|------|-----------|
| 2 compras do mesmo ativo | custo médio ponderado correto |
| Venda total | ativo removido do resultado |
| Venda parcial | avgCost mantido, quantity e totalCost ajustados |
| Múltiplos ativos | calculados independentemente |
| Ordenação | maior totalCost primeiro |

---

## Fora de Escopo (fase atual)

- Cotação em tempo real (preço atual do ativo)
- Variação percentual com preço de mercado
- Paginação do grid de posições
