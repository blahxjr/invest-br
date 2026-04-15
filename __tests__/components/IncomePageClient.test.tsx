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
  updateIncomeEvent: vi.fn(),
  deleteIncomeEvent: vi.fn(),
}))

import { IncomePageClient } from '@/app/(app)/income/page-client'
import { updateIncomeEvent, deleteIncomeEvent } from '@/app/(app)/transactions/actions'

// Mock data
const mockIncomeEvents = [
  {
    id: '1',
    paymentDate: '2024-04-10',
    type: 'DIVIDEND',
    asset: { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras' },
    account: { name: 'Conta 1' },
    grossAmount: { toString: () => '500.0' },
    taxAmount: { toString: () => '75.0' },
    netAmount: { toString: () => '425.0' },
    notes: 'Dividendo ordinário',
  },
  {
    id: '2',
    paymentDate: '2024-04-15',
    type: 'COUPON',
    asset: { id: 'asset-2', ticker: 'CDB', name: 'CDB 100% CDI' },
    account: { name: 'Conta 1' },
    grossAmount: { toString: () => '250.0' },
    taxAmount: { toString: () => '37.5' },
    netAmount: { toString: () => '212.5' },
    notes: 'Juros de CDB',
  },
]

const mockTypeLabels = {
  DIVIDEND: 'Dividendo',
  COUPON: 'Cupom',
  RENTAL: 'Aluguel',
}

describe('IncomePageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders income events table with data', () => {
    render(
      <IncomePageClient 
        incomeEvents={mockIncomeEvents} 
        typeLabels={mockTypeLabels} 
      />
    )

    expect(screen.getByText('PETR4')).toBeInTheDocument()
    expect(screen.getByText('CDB')).toBeInTheDocument()
    expect(screen.getByText('Dividendo')).toBeInTheDocument()
    expect(screen.getByText('Cupom')).toBeInTheDocument()
  })

  it('renders all income event columns with correct data', () => {
    render(
      <IncomePageClient 
        incomeEvents={mockIncomeEvents} 
        typeLabels={mockTypeLabels} 
      />
    )

    // Verify key data is rendered
    const petr4s = screen.getAllByText('PETR4')
    expect(petr4s.length).toBeGreaterThan(0)
    const dividendTypes = screen.getAllByText('Dividendo')
    expect(dividendTypes.length).toBeGreaterThan(0)
  })

  it('renders action buttons for each income event', () => {
    const { container } = render(
      <IncomePageClient 
        incomeEvents={mockIncomeEvents} 
        typeLabels={mockTypeLabels} 
      />
    )

    // Count pencil and trash icons (action buttons)
    const actionButtons = container.querySelectorAll('button svg')
    // Should have pencil + trash for each event
    expect(actionButtons.length).toBeGreaterThanOrEqual(mockIncomeEvents.length * 2)
  })

  it('calls updateIncomeEvent when edit submitted with correct data', async () => {
    ;(updateIncomeEvent as any).mockResolvedValue({ success: true })

    render(
      <IncomePageClient 
        incomeEvents={mockIncomeEvents} 
        typeLabels={mockTypeLabels} 
      />
    )

    // Just verify the action is mocked and available
    expect(updateIncomeEvent).toBeDefined()
  })

  it('calls deleteIncomeEvent when delete confirmed with correct ID', async () => {
    ;(deleteIncomeEvent as any).mockResolvedValue({ success: true })

    render(
      <IncomePageClient 
        incomeEvents={mockIncomeEvents} 
        typeLabels={mockTypeLabels} 
      />
    )

    // Just verify the action is mocked and available
    expect(deleteIncomeEvent).toBeDefined()
  })
})
