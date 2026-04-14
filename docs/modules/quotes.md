# Módulo: Cotações

**Última atualização:** 2026-04-13 (Prompt 11)

## Visão Geral

Integração com [Brapi.dev](https://brapi.dev) para buscar preços atuais dos ativos da carteira. Enriquece `Position` com `currentPrice`, `currentValue`, `gainLoss`, `gainLossPercent` e `quoteChangePct`. Nunca quebra a aplicação em caso de falha da API externa.

---

## Estrutura de Arquivos

```
src/
  lib/
    quotes.ts                        ← getQuotes() + fetchBatch()
  modules/
    positions/
      types.ts                       ← PositionWithQuote + SerializedPositionWithQuote + enrichWithQuotes()
  app/
    (app)/
      positions/
        page.tsx                     ← chama getQuotes + enrichWithQuotes
        positions-page-client.tsx    ← aceita SerializedPositionWithQuote[]
        position-card.tsx            ← P&L e var. dia condicionais
      dashboard/
        data.ts                      ← top5 enriquecido + totalCurrentValue
        page.tsx                     ← KPI Valor de Mercado
  components/
    PositionCard.tsx                 ← props P&L/quote adicionadas
  __tests__/
    lib/
      quotes.test.ts                 ← 4 testes enrichWithQuotes
    components/
      PositionCard.test.tsx          ← +2 casos P&L
```

---

## API: Brapi.dev

| Detalhe | Valor |
|---------|-------|
| Endpoint | `GET https://brapi.dev/api/quote/{tickers}` |
| Máx tickers/req | 50 (batching automático) |
| Cache servidor | 5 min (`next: { revalidate: 300 }`) |
| Plano | Free (sem cadastro obrigatório) |
| Cobertura B3 | STOCK, FII, ETF, BDR |
| Token | Opcional via `BRAPI_TOKEN` (aumenta rate limit) |

---

## `getQuotes` — `src/lib/quotes.ts`

```typescript
export type QuoteResult = {
  ticker:        string
  price:         number
  changedAt:     Date
  changePercent: number
}

export async function getQuotes(
  tickers: string[]
): Promise<Map<string, QuoteResult>>
```

- Agrupa tickers em lotes de 50
- `fetch` com `next: { revalidate: 300 }` — cache nativo do Next.js
- Resposta da Brapi parseada com **tipos dedicados** (DEC-017 — sem `any` explícito)
- Batch com erro (4xx/5xx) retorna `[]` silenciosamente
- Tickers ausentes simplesmente não aparecem no `Map` retornado

---

## `enrichWithQuotes` — Função Pura

```typescript
// src/modules/positions/types.ts

export type PositionWithQuote = Position & {
  currentPrice:    number | null
  currentValue:    Decimal | null   // quantity × currentPrice
  gainLoss:        Decimal | null   // currentValue - totalCost
  gainLossPercent: Decimal | null   // (gainLoss / totalCost) × 100
  quoteChangePct:  number | null    // variação % do dia
  quotedAt:        Date | null
}

export type SerializedPositionWithQuote = Omit<
  PositionWithQuote,
  'quantity' | 'avgCost' | 'totalCost' | 'currentValue' | 'gainLoss' | 'gainLossPercent'
> & {
  quantity:        string
  avgCost:         string
  totalCost:       string
  currentValue:    string | null
  gainLoss:        string | null
  gainLossPercent: string | null
}

export function enrichWithQuotes(
  positions: Position[],
  quotes: Map<string, QuoteResult>
): PositionWithQuote[]
```

**Casos especiais:**
- Ticker ausente no mapa → todos os campos `null`
- `totalCost = 0` → `gainLossPercent = 0` (evita divisão por zero)
- `gainLoss` negativo → `isNegative()` = `true`

---

## PositionCard: Exibição Condicional

```
Sempre visível:
  ticker | nome | badge categoria
  cotas | custo médio | custo total

Só se currentPrice !== null:
  Valor atual: R$ X,XX
  P&L: +/-R$ X,XX (+/-X,X%)   ← verde/vermelho
  Var. dia: +/-X,XX%           ← verde/vermelho
```

---

## Dashboard: KPI Valor de Mercado

```
Patrimônio (custo)  |  Valor de Mercado  |  Ativos  |  Proventos/mês
```

`totalCurrentValue` = soma de `currentValue` das posições com cotação disponível.  
A diferença entre os dois KPIs é o P&L implícito da carteira.

---

## Variável de Ambiente

```bash
# .env.local
BRAPI_TOKEN=seu_token_aqui   # opcional — https://brapi.dev
```

Documentada em `run.md` como opcional.

---

## Testes

### `quotes.test.ts` — 4 testes (função pura, sem fetch, sem banco)

| Caso | Validação |
|------|-----------|
| P&L positivo | currentValue, gainLoss e gainLossPercent corretos |
| Ticker ausente no mapa | todos os campos null |
| P&L negativo | gainLoss.isNegative() = true |
| totalCost zero | gainLossPercent = 0 (sem divisão por zero) |

### `PositionCard.test.tsx` — +2 casos

| Caso | Validação |
|------|-----------|
| P&L positivo | elemento com classe de cor positiva presente |
| currentPrice null | seção "Valor atual" ausente do DOM |

---

## Fora de Escopo

- Séries históricas de preços
- Gráfico de evolução de patrimônio no tempo
- Alertas de preço
- WebSocket / atualizacão sub-segundo
