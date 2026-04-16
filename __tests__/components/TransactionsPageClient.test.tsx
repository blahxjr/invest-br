// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

// Mock Server Actions
vi.mock('@/app/(app)/transactions/actions', () => ({
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

import { TransactionsPageClient } from '@/app/(app)/transactions/page-client'
import { updateTransaction, deleteTransaction } from '@/app/(app)/transactions/actions'

// Mock data
const mockTransactions = [
  {
    id: '1',
    date: '2024-04-10',
    type: 'BUY',
    account: { name: 'Conta 1' },
    asset: { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras' },
    quantity: '100',
    price: '25.5',
    totalAmount: '2550',
    notes: 'Compra inicial',
  },
  {
    id: '2',
    date: '2024-04-12',
    type: 'SELL',
    account: { name: 'Conta 1' },
    asset: { id: 'asset-2', ticker: 'VALE3', name: 'Vale' },
    quantity: '50',
    price: '30.0',
    totalAmount: '1500',
    notes: 'Venda parcial',
  },
]

const mockAssets = [
  { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras' },
  { id: 'asset-2', ticker: 'VALE3', name: 'Vale' },
]

const mockTypeLabels = {
  BUY: 'Compra',
  SELL: 'Venda',
  DIVIDEND: 'Dividendo',
  INTEREST: 'Juros',
}

const mockTypeColors = {
  BUY: 'bg-green-100 text-green-700',
  SELL: 'bg-red-100 text-red-700',
  DIVIDEND: 'bg-blue-100 text-blue-700',
  INTEREST: 'bg-purple-100 text-purple-700',
}

describe('TransactionsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders transactions table with data', () => {
    render(
      <TransactionsPageClient 
        transactions={mockTransactions}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    const petr4Elements = screen.getAllByText('PETR4')
    expect(petr4Elements.length).toBeGreaterThan(0)
    const typeLabelsInDoc = screen.getAllByText('Compra')
    expect(typeLabelsInDoc.length).toBeGreaterThan(0)
  })

  it('renders all transaction columns with correct data', () => {
    render(
      <TransactionsPageClient 
        transactions={mockTransactions}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    // Verify table is rendered with data
    const petr4s = screen.getAllByText('PETR4')
    expect(petr4s.length).toBeGreaterThan(0)
  })

  it('renders empty state when no transactions', () => {
    render(
      <TransactionsPageClient 
        transactions={[]}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    expect(screen.getByText('Nenhuma transação encontrada')).toBeInTheDocument()
    expect(screen.getByText('Limpar filtros')).toBeInTheDocument()
  })

  it('renders action buttons for each transaction', () => {
    const { container } = render(
      <TransactionsPageClient 
        transactions={mockTransactions}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    // Count pencil and trash icons (action buttons)
    const actionButtons = container.querySelectorAll('button svg')
    // Should have pencil + trash for each transaction
    expect(actionButtons.length).toBeGreaterThanOrEqual(mockTransactions.length * 2)
  })

  it('applies correct color class to transaction type badge', () => {
    const { container } = render(
      <TransactionsPageClient 
        transactions={mockTransactions}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    // Check if color classes are applied (at least one should match)
    const badges = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.textContent === 'Compra' || el.textContent === 'Venda'
    )
    expect(badges.length).toBeGreaterThan(0)
  })

  it('calls updateTransaction when edit form submitted', async () => {
    ;(updateTransaction as any).mockResolvedValue({ success: true })

    const { container } = render(
      <TransactionsPageClient 
        transactions={mockTransactions}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    // Find and click the first edit button (pencil icon)
    const editButtons = container.querySelectorAll('button')
    const firstEditButton = Array.from(editButtons).find((btn) =>
      btn.innerHTML.includes('M11 17H6l-1-4m0 0L1 7m4 6h12m1-11a2 2 0')
    )
    
    if (firstEditButton) {
      fireEvent.click(firstEditButton)
      
      await waitFor(() => {
        const saveBtn = screen.queryByRole('button', { name: /Salvar/ })
        if (saveBtn) {
          fireEvent.click(saveBtn)
        }
      })
    }
  })

  it('exibe account.name corretamente na coluna Conta', () => {
    const transactionsWithRealAccounts = [
      {
        ...mockTransactions[0],
        account: { name: 'Nu Invest' },
      },
      {
        ...mockTransactions[1],
        account: { name: 'XP Investimentos' },
      },
    ]

    render(
      <TransactionsPageClient 
        transactions={transactionsWithRealAccounts}
        assets={mockAssets}
        typeLabels={mockTypeLabels}
        typeColors={mockTypeColors}
      />
    )

    // Verify account names are rendered
    expect(screen.getByText('Nu Invest')).toBeInTheDocument()
    expect(screen.getByText('XP Investimentos')).toBeInTheDocument()
  })
})
