import type {
  ProviderQuote,
  ProviderResult,
  QuoteProvider,
  QuoteProviderId,
} from '@/modules/quotes/domain/types'
import { brapiProvider } from '@/modules/quotes/providers/brapi-provider'
import { yahooProvider } from '@/modules/quotes/providers/yahoo-provider'

const providerRegistry: Record<QuoteProviderId, QuoteProvider> = {
  brapi: brapiProvider,
  yahoo: yahooProvider,
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function parseProviderId(rawValue: string): QuoteProviderId | null {
  const normalized = rawValue.trim().toLowerCase()
  if (normalized === 'brapi' || normalized === 'yahoo') {
    return normalized
  }
  return null
}

function parseProviderList(value: string | undefined): QuoteProviderId[] {
  if (!value) {
    return []
  }

  const providers = value
    .split(',')
    .map((item) => parseProviderId(item))
    .filter((item): item is QuoteProviderId => item !== null)

  return Array.from(new Set(providers))
}

function emitProviderMetrics(results: ProviderResult[]): void {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  for (const result of results) {
    const payload = {
      provider: result.providerId,
      requestedTickers: result.requestedTickers,
      receivedTickers: result.receivedTickers,
      durationMs: result.durationMs,
      error: result.error,
    }
    console.info('[quotes]', JSON.stringify(payload))
  }
}

/**
 * Resolve a ordem dos providers de cotação com base em variáveis de ambiente.
 */
export function resolveProviderOrder(): QuoteProvider[] {
  const primaryRaw = process.env.QUOTE_PROVIDER_PRIMARY ?? 'brapi'
  const fallbackRaw = process.env.QUOTE_PROVIDER_FALLBACKS ?? 'yahoo'

  const primary = parseProviderId(primaryRaw) ?? 'brapi'
  const fallbacks = parseProviderList(fallbackRaw)

  const providerIds = Array.from(new Set([primary, ...fallbacks]))

  return providerIds
    .map((providerId) => providerRegistry[providerId])
    .filter((provider): provider is QuoteProvider => provider !== undefined)
}

/**
 * Busca cotações com fallback entre providers configurados, preservando o contrato atual.
 */
export async function getQuotesFromProviders(
  tickers: string[],
  providers: QuoteProvider[],
): Promise<Map<string, ProviderQuote>> {
  const uniqueTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)))
  if (uniqueTickers.length === 0) {
    return new Map()
  }

  const activeProviders = providers.filter((provider) => provider.isEnabled())
  if (activeProviders.length === 0) {
    return new Map()
  }

  const finalResult = new Map<string, ProviderQuote>()
  let pendingTickers = [...uniqueTickers]
  const providerResults: ProviderResult[] = []

  for (const provider of activeProviders) {
    if (pendingTickers.length === 0) {
      break
    }

    const startedAt = Date.now()

    try {
      const quotes = await provider.getQuotes(pendingTickers)
      for (const [ticker, quote] of quotes.entries()) {
        finalResult.set(ticker, quote)
      }

      pendingTickers = pendingTickers.filter((ticker) => !finalResult.has(ticker))

      providerResults.push({
        providerId: provider.id,
        quotes,
        requestedTickers: pendingTickers.length + quotes.size,
        receivedTickers: quotes.size,
        durationMs: Date.now() - startedAt,
      })
    } catch (error: unknown) {
      providerResults.push({
        providerId: provider.id,
        quotes: new Map(),
        requestedTickers: pendingTickers.length,
        receivedTickers: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'provider_error',
      })
    }
  }

  emitProviderMetrics(providerResults)
  return finalResult
}

/**
 * Busca cotações usando ordem de providers configurada em ambiente.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, ProviderQuote>> {
  return getQuotesFromProviders(tickers, resolveProviderOrder())
}
