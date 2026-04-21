import type { ProviderQuote, QuoteProvider } from '@/modules/quotes/domain/types'

const BRAPI_BASE = 'https://brapi.dev/api/quote'
const BRAPI_TOKEN = process.env.BRAPI_TOKEN ?? ''
const DEFAULT_REVALIDATE_SECONDS = 300
const DEFAULT_TIMEOUT_MS = 6000
const BATCH_SIZE = 50

type BrapiQuote = {
  symbol?: string
  regularMarketPrice?: number
  regularMarketTime?: string
  regularMarketChangePercent?: number
}

type BrapiResponse = {
  results?: BrapiQuote[]
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function chunkTickers(tickers: string[], chunkSize: number): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < tickers.length; i += chunkSize) {
    chunks.push(tickers.slice(i, i + chunkSize))
  }
  return chunks
}

async function fetchBatch(
  tickers: string[],
  revalidateSeconds: number,
  timeoutMs: number,
): Promise<ProviderQuote[]> {
  const params = new URLSearchParams({
    fundamental: 'false',
    dividends: 'false',
  })

  if (BRAPI_TOKEN) {
    params.set('token', BRAPI_TOKEN)
  }

  const normalizedTickers = tickers.map(normalizeTicker)
  const url = `${BRAPI_BASE}/${normalizedTickers.join(',')}?${params.toString()}`

  try {
    const response = await fetch(url, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as BrapiResponse
    return (data.results ?? [])
      .filter(
        (
          item,
        ): item is Required<Pick<BrapiQuote, 'symbol' | 'regularMarketPrice' | 'regularMarketTime'>> &
          BrapiQuote =>
          typeof item.symbol === 'string' &&
          typeof item.regularMarketPrice === 'number' &&
          typeof item.regularMarketTime === 'string',
      )
      .map((item) => ({
        ticker: normalizeTicker(item.symbol),
        price: item.regularMarketPrice,
        changedAt: new Date(item.regularMarketTime),
        changePercent: typeof item.regularMarketChangePercent === 'number' ? item.regularMarketChangePercent : 0,
      }))
  } catch {
    return []
  }
}

export const brapiProvider: QuoteProvider = {
  id: 'brapi',
  isEnabled: () => true,
  async getQuotes(tickers: string[]) {
    const uniqueTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)))
    if (uniqueTickers.length === 0) {
      return new Map()
    }

    const batches = chunkTickers(uniqueTickers, BATCH_SIZE)
    const batchResults = await Promise.all(
      batches.map((batch) => fetchBatch(batch, DEFAULT_REVALIDATE_SECONDS, DEFAULT_TIMEOUT_MS)),
    )

    const result = new Map<string, ProviderQuote>()
    for (const quotes of batchResults) {
      for (const quote of quotes) {
        result.set(quote.ticker, quote)
      }
    }

    return result
  },
}
