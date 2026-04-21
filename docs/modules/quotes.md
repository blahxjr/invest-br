# Módulo: Cotações

**Última atualização:** 2026-04-21 (Fase 1 multi-provider)

## Visão Geral

Integração de cotações em arquitetura multi-provider com fallback resiliente:

- Primário: Brapi
- Fallback opcional: Yahoo Finance (via `yahoo-finance2`)

O módulo enriquece `Position` com `currentPrice`, `currentValue`, `gainLoss`, `gainLossPercent` e `quoteChangePct`, sem quebrar a aplicação em caso de falha externa.

---

## Estrutura de Arquivos

```
src/
  lib/
    quotes.ts                        ← fachada compatível (getQuotes)
  modules/
    quotes/
      domain/
        types.ts                     ← QuoteProviderId, ProviderQuote, QuoteProvider
      providers/
        brapi-provider.ts            ← provider primário (batch 50 + cache)
        yahoo-provider.ts            ← fallback opcional (ticker BR com .SA)
      service/
        get-quotes.ts                ← orquestração + fallback + métricas
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
    modules/
      quotes-service.test.ts         ← fallback, erro, provider desabilitado
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

- Mantém contrato compatível para consumidores existentes
- Delega para `src/modules/quotes/service/get-quotes.ts`
- Resolve providers por configuração de ambiente
- Aplica fallback automático para tickers pendentes
- Emite métricas por provider no log (`[quotes]`)

## Providers

### Brapi (primário)
- Lotes de até 50 tickers
- Cache `revalidate: 300`
- Pode retornar vazio para parte dos ativos sem token

### Yahoo (fallback opcional)
- Ativado por `YAHOO_ENABLED=true`
- Para ativos brasileiros, consulta com sufixo `.SA` (ex.: `PETR4` -> `PETR4.SA`)
- Retorna a chave no formato original do ticker da posição (ex.: `PETR4`)
- Compatível com Node 20+ (recomendado 22+)

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
QUOTE_PROVIDER_PRIMARY=brapi
QUOTE_PROVIDER_FALLBACKS=yahoo
YAHOO_ENABLED=false
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

### `quotes-service.test.ts` — 4 testes (orquestração multi-provider)

| Caso | Validação |
|------|-----------|
| fallback parcial | provider secundário completa tickers faltantes |
| short-circuit | não chama fallback se primário cobriu todos |
| falha no primário | continua no secundário |
| provider desabilitado | ignora provider fora da configuração ativa |

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

---

## Evolução Planejada (V2)

Para evolução de cotações em arquitetura multi-provider com fallback resiliente e trilha para near-real-time:

- Plano técnico: `docs/architecture/market-data-implementation-plan.md`
- ADR proposta: `docs/decisions/ADR-002-market-data-provider-strategy.md`
