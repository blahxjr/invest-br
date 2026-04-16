// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Decimal from 'decimal.js'
import PositionsPageClient from '@/app/(app)/positions/positions-page-client'
import PositionCard from '@/app/(app)/positions/position-card'
import { enrichWithQuotes } from '@/modules/positions/types'
import type { Position, SerializedPositionWithQuote } from '@/modules/positions/types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

const mockPosition: SerializedPositionWithQuote = {
  assetId: 'asset-1',
  ticker: 'MXRF11',
  name: 'Maxi Renda Imobiliária',
  category: 'FII',
  assetClassCode: 'FII',
  quantity: '26',
  avgCost: '9.92',
  totalCost: '257.92',
  currentPrice: 10.5,
  currentValue: '273.00',
  gainLoss: '15.08',
  gainLossPercent: '5.84',
  quoteChangePct: 0.5,
  quotedAt: new Date().toISOString(),
  accountId: 'account-1',
  accountName: 'Nu Invest',
  institutionId: 'inst-1',
  institutionName: 'NU INVEST CORRETORA DE VALORES S.A.',
  allocationPct: '50',
}

const mockPosition2: SerializedPositionWithQuote = {
  assetId: 'asset-2',
  ticker: 'BEEF1',
  name: 'Petrobras BR S.A.',
  category: 'STOCK',
  assetClassCode: 'ACOES',
  quantity: '100',
  avgCost: '0.66',
  totalCost: '257.92',
  currentPrice: 0.66,
  currentValue: '66.00',
  gainLoss: '0',
  gainLossPercent: '0',
  quoteChangePct: 0,
  quotedAt: new Date().toISOString(),
  accountId: 'account-2',
  accountName: 'XP Investimentos',
  institutionId: null,
  institutionName: null,
  allocationPct: '50',
}

describe('Positions Enrichment', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('mostra toggle cards/tabela no topo', () => {
    render(<PositionsPageClient positions={[mockPosition]} />)

    expect(screen.getByRole('button', { name: /cards/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tabela/i })).toBeInTheDocument()
  })

  it('alterna entre modo cards e tabela quando clicado', async () => {
    render(<PositionsPageClient positions={[mockPosition]} />)

    const tableButton = screen.getByRole('button', { name: /tabela/i })
    fireEvent.click(tableButton)

    await waitFor(() => {
      expect(screen.getByText('MXRF11')).toBeInTheDocument()
    })
  })

  it('filtra posições por conta', async () => {
    render(<PositionsPageClient positions={[mockPosition, mockPosition2]} />)

    const accountSelect = screen.getByDisplayValue('Todas as contas')
    fireEvent.change(accountSelect, { target: { value: 'Nu Invest' } })

    await waitFor(() => {
      expect(screen.getByText('MXRF11')).toBeInTheDocument()
    })
  })

  it('exibe accountName e institutionName em PositionCard', () => {
    render(<PositionCard position={mockPosition} />)

    expect(screen.getByText('Nu Invest')).toBeInTheDocument()
    expect(screen.getByText('NU INVEST')).toBeInTheDocument()
  })

  it('exibe allocationPct formatado', () => {
    render(<PositionCard position={mockPosition} />)

    // Procura por 50% ou 50.0% - pode ter múltiplos elementos
    const elements = screen.queryAllByText(/50(\.0)?%/)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('renderiza posições com institutionId null', () => {
    render(<PositionCard position={mockPosition2} />)

    expect(screen.getByText('XP Investimentos')).toBeInTheDocument()
  })

  it('salva view mode em localStorage', async () => {
    render(<PositionsPageClient positions={[mockPosition]} />)

    const tableButton = screen.getByRole('button', { name: /tabela/i })
    fireEvent.click(tableButton)

    await waitFor(() => {
      const saved = localStorage.getItem('positions-view-mode')
      expect(saved).toBe('table')
    })
  })
})

describe('enrichWithQuotes with new fields', () => {
  it('calcula allocationPct baseado em totalValue', () => {
    const positions: Position[] = [
      {
        assetId: 'a1',
        ticker: 'MXRF11',
        name: 'MXRF',
        category: 'FII',
        assetClassCode: 'FII',
        quantity: new Decimal(10),
        avgCost: new Decimal(100),
        totalCost: new Decimal(1000),
        accountId: 'acc-1',
        accountName: 'Nu',
        institutionId: 'inst-1',
        institutionName: 'NU',
        allocationPct: new Decimal(0),
      },
      {
        assetId: 'a2',
        ticker: 'PETR4',
        name: 'PETR',
        category: 'STOCK',
        assetClassCode: 'ACOES',
        quantity: new Decimal(50),
        avgCost: new Decimal(20),
        totalCost: new Decimal(1000),
        accountId: 'acc-2',
        accountName: 'XP',
        institutionId: null,
        institutionName: null,
        allocationPct: new Decimal(0),
      },
    ]

    const quotes = new Map([
      ['MXRF11', { ticker: 'MXRF11', price: 100, changePercent: 0, changedAt: new Date() }],
      ['PETR4', { ticker: 'PETR4', price: 20, changePercent: 0, changedAt: new Date() }],
    ])

    const enriched = enrichWithQuotes(positions, quotes)

    expect(enriched[0].allocationPct.toFixed(1)).toBe('50.0')
    expect(enriched[1].allocationPct.toFixed(1)).toBe('50.0')
  })

  it('retorna gainLossPercent como 0 quando totalCost é zero', () => {
    const position: Position = {
      assetId: 'a1',
      ticker: 'TEST',
      name: 'Test',
      category: 'FII',
      assetClassCode: 'FII',
      quantity: new Decimal(0),
      avgCost: new Decimal(0),
      totalCost: new Decimal(0),
      accountId: 'acc-1',
      accountName: 'Test',
      institutionId: null,
      institutionName: null,
      allocationPct: new Decimal(0),
    }

    const quotes = new Map([
      ['TEST', { ticker: 'TEST', price: 10, changePercent: 0, changedAt: new Date() }],
    ])

    const enriched = enrichWithQuotes([position], quotes)

    expect(enriched[0].gainLossPercent?.toString()).toBe('0')
  })
})
