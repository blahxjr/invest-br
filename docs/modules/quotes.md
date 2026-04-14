# Módulo: Cotações (Prompt 11)

## Visão Geral

Integração com a API [Brapi.dev](https://brapi.dev) para buscar preços atuais dos ativos da carteira. Enriquece `Position` com `currentPrice`, `currentValue`, `gainLoss`, `gainLossPercent` e `quoteChangePct`. Nunca quebra a aplicação em caso de falha da API externa.

---

## Estrutura de Arquivos

```
src/
  lib/
    quotes.ts                       ← NOVO: getQuotes() + fetchBatch()
  modules/
    positions/
      types.ts                      ← ADD: PositionWithQuote + enrichWithQuotes()
  app/
    (app)/
      positions/
        page.tsx                    ← ALT: chama getQuotes + enrichWithQuotes
        position-card.tsx           ← ALT: exibe P&L condicionalmente
      dashboard/
        data.ts                     ← ALT: enriquece top5 + totalCurrentValue
        page.tsx                    ← ALT: passa totalCurrentValue serializado
  __tests__/
    lib/
      quotes.test.ts                ← NOVO: 4 testes de enrichWithQuotes
    components/
      PositionCard.test.tsx         ← ALT: +2 casos P&L
```

---

## API: Brapi.dev

```
GET https://brapi.dev/api/quote/{tickers}
    ?token=TOKEN          ← opcional (aumenta rate limit)
    &fundamental=false
    &dividends=false
```

| Detalhe | Valor |
|---------|-------|
| Máx tickers/request | 50 |
| Cache server | 5 minutos (`next: { revalidate: 300 }`) |
| Plano | Free (sem cadastro obrigatório) |
| Cobertura | B3 completa: STOCK, FII, ETF, BDR |

---

## `getQuotes(tickers)` — `src/lib/quotes.ts`

```typescript
export type QuoteResult = {
  ticker:        string
  price:         number
  changedAt:     Date
  changePercent: number
}

export async function getQuotes(tickers: string[]): Promise<Map<string, QuoteResult>>
```

- Batcheia automaticamente em grupos de 50
- Usa `fetch` nativo com `next: { revalidate: 300 }` (cache Next.js)
- Retorna `Map<ticker, QuoteResult>` — tickers ausentes simples ausentes no map
- **Falha silenciosa:** batch com erro retorna `[]`, nunca lanaça exceção

---

## `enrichWithQuotes` — Função Pura

```typescript
// src/modules/positions/types.ts

export type PositionWithQuote = Position & {
  currentPrice:     number | null
  currentValue:     Decimal | null  // quantity × currentPrice
  gainLoss:         Decimal | null  // currentValue - totalCost
  gainLossPercent:  Decimal | null  // (gainLoss / totalCost) × 100
  quoteChangePct:   number | null   // variação % do dia
  quotedAt:         Date | null
}

export function enrichWithQuotes(
  positions: Position[],
  quotes: Map<string, QuoteResult>
): PositionWithQuote[]
```

Casos especiais:
- Ticker não encontrado no mapa → todos os campos `null`
- `totalCost = 0` → `gainLossPercent = 0` (evita divisão por zero)
- `gainLoss` negativo → `isNegative()` = true

---

## Exibição no `PositionCard`

Condicional: só exibe se `currentPrice !== null`.

```
┌──────────────────────────────┐
│ PETR4  [STOCK]             │
│ Petróleo Brasileiro SA     │
├──────────────────────────────┤
│ Qtd:         10            │
│ Custo médio: R$ 30,00      │
│ Custo total: R$ 300,00     │
│ Valor atual: R$ 384,50 ↑   │  ← só se currentPrice não-null
│ P&L: +R$ 84,50 (+28,2%)   │  ← verde se positivo
│ Var. dia: +1,23%           │  ← vermelho se negativo
└──────────────────────────────┘
```

---

## Dashboard: Novo KPI

`totalCurrentValue` = soma de `currentValue` das posições com cotação disponível.

```
Patrimônio (custo)  |  Valor de Mercado  |  Ativos  |  Proventos/mês
R$ 47.832,00         |  R$ 52.140,00      |  68      |  R$ 1.230,00
```

A diferença entre os dois KPIs é o P&L total da carteira visualmente implícito.

---

## Variável de Ambiente

```bash
# .env.local
BRAPI_TOKEN=seu_token_aqui   # opcional — https://brapi.dev
```

Documentada no `run.md` como opcional. Sem token: funciona com rate limit menor.

---

## Testes

### `quotes.test.ts` — 4 testes de `enrichWithQuotes` (sem fetch, sem banco)

| Caso | Validação |
|------|-----------|
| P&L positivo | currentValue, gainLoss e gainLossPercent corretos |
| Ticker ausente | todos os campos null |
| P&L negativo | gainLoss.isNegative() = true |
| totalCost zero | gainLossPercent = 0 (sem divisão por zero) |

### `PositionCard.test.tsx` — +2 casos

| Caso | Validação |
|------|-----------|
| P&L positivo | elemento com classe verde presente |
| currentPrice null | seção "Valor atual" ausente do DOM |

---

## Fora de Escopo (fase atual)

- Séries históricas de preços
- Gráfico de evolução de patrimônio no tempo
- Alertas de preço (price target)
- WebSocket / atualizacão em tempo real (atua com polling via revalidate)
