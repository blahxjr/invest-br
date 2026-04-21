import type { ProviderQuote, QuoteProvider } from '@/modules/quotes/domain/types'

const DEFAULT_TIMEOUT_MS = 6000
const DEFAULT_CONCURRENCY = 5
const MIN_SUPPORTED_NODE_MAJOR = 20
const RECOMMENDED_NODE_MAJOR = 22

type YahooQuoteLike = {
  symbol?: string
  regularMarketPrice?: number
  regularMarketTime?: Date | number | string
  regularMarketChangePercent?: number
}

type YahooClient = {
  quote(symbol: string): Promise<unknown>
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function isNodeVersionSupported(): boolean {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  return major >= MIN_SUPPORTED_NODE_MAJOR
}

function isNodeVersionRecommended(): boolean {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  return major >= RECOMMENDED_NODE_MAJOR
}

function isFeatureEnabled(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseYahooQuote(payload: unknown): YahooQuoteLike | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const record = payload as Record<string, unknown>
  const parsed: YahooQuoteLike = {
    symbol: typeof record.symbol === 'string' ? record.symbol : undefined,
    regularMarketPrice:
      typeof record.regularMarketPrice === 'number' ? record.regularMarketPrice : undefined,
    regularMarketTime:
      record.regularMarketTime instanceof Date ||
      typeof record.regularMarketTime === 'number' ||
      typeof record.regularMarketTime === 'string'
        ? record.regularMarketTime
        : undefined,
    regularMarketChangePercent:
      typeof record.regularMarketChangePercent === 'number' ? record.regularMarketChangePercent : undefined,
  }

  if (
    typeof parsed.symbol !== 'string' ||
    typeof parsed.regularMarketPrice !== 'number' ||
    parsed.regularMarketTime === undefined
  ) {
    return null
  }

  return parsed
}

function parseMarketTime(value: Date | number | string): Date {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    // Yahoo costuma retornar epoch em segundos.
    return new Date(value * 1000)
  }

  return new Date(value)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Yahoo quote timeout')), timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = []
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)

  return results
}

let yahooClientPromise: Promise<YahooClient> | null = null
let hasLoggedUnsupportedNodeWarning = false
let hasLoggedNonRecommendedNodeWarning = false

async function getYahooClient(): Promise<YahooClient> {
  if (!yahooClientPromise) {
    yahooClientPromise = import('yahoo-finance2').then((module) => {
      const YahooFinanceCtor = module.default
      return new YahooFinanceCtor() as YahooClient
    })
  }

  return yahooClientPromise
}

async function fetchTickerQuote(client: YahooClient, ticker: string, timeoutMs: number): Promise<ProviderQuote | null> {
  try {
    const rawPayload = await withTimeout(client.quote(ticker), timeoutMs)
    const parsed = parseYahooQuote(rawPayload)
    if (!parsed) {
      return null
    }

    return {
      ticker: normalizeTicker(parsed.symbol),
      price: parsed.regularMarketPrice,
      changedAt: parseMarketTime(parsed.regularMarketTime),
      changePercent:
        typeof parsed.regularMarketChangePercent === 'number' ? parsed.regularMarketChangePercent : 0,
    }
  } catch {
    return null
  }
}

export const yahooProvider: QuoteProvider = {
  id: 'yahoo',
  isEnabled: () => isFeatureEnabled(process.env.YAHOO_ENABLED) && isNodeVersionSupported(),
  async getQuotes(tickers: string[]) {
    if (!isFeatureEnabled(process.env.YAHOO_ENABLED)) {
      return new Map()
    }

    if (!isNodeVersionSupported()) {
      if (process.env.NODE_ENV !== 'test' && !hasLoggedUnsupportedNodeWarning) {
        hasLoggedUnsupportedNodeWarning = true
        console.warn(
          `[quotes] Yahoo provider desativado: requer Node >= ${MIN_SUPPORTED_NODE_MAJOR} (atual: ${process.versions.node}).`,
        )
      }
      return new Map()
    }

    if (process.env.NODE_ENV !== 'test' && !isNodeVersionRecommended() && !hasLoggedNonRecommendedNodeWarning) {
      hasLoggedNonRecommendedNodeWarning = true
      console.warn(
        `[quotes] Yahoo provider em modo compatibilidade: Node ${process.versions.node}. Recomendado >= ${RECOMMENDED_NODE_MAJOR}.`,
      )
    }

    const uniqueTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)))
    if (uniqueTickers.length === 0) {
      return new Map()
    }

    const client = await getYahooClient()

    const quotes = await mapWithConcurrency(uniqueTickers, DEFAULT_CONCURRENCY, (ticker) =>
      fetchTickerQuote(client, ticker, DEFAULT_TIMEOUT_MS),
    )

    const result = new Map<string, ProviderQuote>()
    for (const quote of quotes) {
      if (quote) {
        result.set(quote.ticker, quote)
      }
    }

    return result
  },
}
