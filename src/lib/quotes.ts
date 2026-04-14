const BRAPI_BASE = 'https://brapi.dev/api/quote'
const BRAPI_TOKEN = process.env.BRAPI_TOKEN ?? ''

export type QuoteResult = {
  ticker: string
  price: number
  changedAt: Date
  changePercent: number
}

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

async function fetchBatch(tickers: string[]): Promise<QuoteResult[]> {
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
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as BrapiResponse
    return (data.results ?? [])
      .filter(
        (item): item is Required<Pick<BrapiQuote, 'symbol' | 'regularMarketPrice' | 'regularMarketTime'>> & BrapiQuote =>
          typeof item.symbol === 'string' &&
          typeof item.regularMarketPrice === 'number' &&
          typeof item.regularMarketTime === 'string',
      )
      .map((item) => ({
        ticker: normalizeTicker(item.symbol),
        price: item.regularMarketPrice,
        changedAt: new Date(item.regularMarketTime),
        changePercent: typeof item.regularMarketChangePercent === 'number'
          ? item.regularMarketChangePercent
          : 0,
      }))
  } catch {
    return []
  }
}

/**
 * Busca cotações em lote na Brapi (até 50 tickers por request) com cache de 5 minutos.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, QuoteResult>> {
  const uniqueTickers = Array.from(
    new Set(
      tickers
        .map(normalizeTicker)
        .filter(Boolean),
    ),
  )

  if (uniqueTickers.length === 0) {
    return new Map()
  }

  const batchSize = 50
  const batches: string[][] = []
  for (let i = 0; i < uniqueTickers.length; i += batchSize) {
    batches.push(uniqueTickers.slice(i, i + batchSize))
  }

  const batchResults = await Promise.all(batches.map((batch) => fetchBatch(batch)))

  const result = new Map<string, QuoteResult>()
  for (const quotes of batchResults) {
    for (const quote of quotes) {
      result.set(quote.ticker, quote)
    }
  }

  return result
}
