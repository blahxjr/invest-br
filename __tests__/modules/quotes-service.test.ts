import type { ProviderQuote, QuoteProvider } from '@/modules/quotes/domain/types'
import { getQuotesFromProviders } from '@/modules/quotes/service/get-quotes'

describe('getQuotesFromProviders', () => {
  function createProvider(options: {
    id: 'brapi' | 'yahoo'
    enabled?: boolean
    quotesByTicker?: Record<string, ProviderQuote>
    throws?: boolean
    onCall?: (tickers: string[]) => void
  }): QuoteProvider {
    const {
      id,
      enabled = true,
      quotesByTicker = {},
      throws = false,
      onCall,
    } = options

    return {
      id,
      isEnabled: () => enabled,
      async getQuotes(tickers: string[]) {
        onCall?.(tickers)

        if (throws) {
          throw new Error(`provider_${id}_error`)
        }

        const result = new Map<string, ProviderQuote>()
        for (const ticker of tickers) {
          const quote = quotesByTicker[ticker]
          if (quote) {
            result.set(ticker, quote)
          }
        }

        return result
      },
    }
  }

  it('usa fallback para completar tickers ausentes no provider primario', async () => {
    const now = new Date('2026-04-21T12:00:00.000Z')

    const primary = createProvider({
      id: 'brapi',
      quotesByTicker: {
        PETR4: {
          ticker: 'PETR4',
          price: 38,
          changedAt: now,
          changePercent: 1.2,
        },
      },
    })

    const fallback = createProvider({
      id: 'yahoo',
      quotesByTicker: {
        VALE3: {
          ticker: 'VALE3',
          price: 64,
          changedAt: now,
          changePercent: -0.5,
        },
      },
    })

    const result = await getQuotesFromProviders(['PETR4', 'VALE3'], [primary, fallback])

    expect(result.get('PETR4')?.price).toBe(38)
    expect(result.get('VALE3')?.price).toBe(64)
  })

  it('nao chama fallback quando o primario ja retorna todos os tickers', async () => {
    const calls: string[][] = []
    const now = new Date('2026-04-21T12:00:00.000Z')

    const primary = createProvider({
      id: 'brapi',
      quotesByTicker: {
        PETR4: {
          ticker: 'PETR4',
          price: 38,
          changedAt: now,
          changePercent: 1.2,
        },
      },
    })

    const fallback = createProvider({
      id: 'yahoo',
      onCall: (tickers) => calls.push(tickers),
    })

    const result = await getQuotesFromProviders(['PETR4'], [primary, fallback])

    expect(result.size).toBe(1)
    expect(calls).toHaveLength(0)
  })

  it('continua fluxo quando provider falha e tenta o proximo', async () => {
    const now = new Date('2026-04-21T12:00:00.000Z')

    const failingProvider = createProvider({
      id: 'brapi',
      throws: true,
    })

    const fallback = createProvider({
      id: 'yahoo',
      quotesByTicker: {
        ITSA4: {
          ticker: 'ITSA4',
          price: 9.8,
          changedAt: now,
          changePercent: 0.3,
        },
      },
    })

    const result = await getQuotesFromProviders(['ITSA4'], [failingProvider, fallback])

    expect(result.get('ITSA4')?.price).toBe(9.8)
  })

  it('ignora providers desabilitados', async () => {
    const now = new Date('2026-04-21T12:00:00.000Z')

    const disabledPrimary = createProvider({
      id: 'brapi',
      enabled: false,
      throws: true,
    })

    const enabledFallback = createProvider({
      id: 'yahoo',
      quotesByTicker: {
        BBAS3: {
          ticker: 'BBAS3',
          price: 25.2,
          changedAt: now,
          changePercent: 0.8,
        },
      },
    })

    const result = await getQuotesFromProviders(['BBAS3'], [disabledPrimary, enabledFallback])

    expect(result.get('BBAS3')?.price).toBe(25.2)
  })
})
