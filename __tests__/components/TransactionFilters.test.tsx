// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionFilters } from '@/components/TransactionFilters'

describe('TransactionFilters', () => {
  const mockAssets = [
    { id: 'asset-1', ticker: 'PETR4', name: 'Petrobras' },
    { id: 'asset-2', ticker: 'VALE3', name: 'Vale' },
    { id: 'asset-3', ticker: null, name: 'Another Asset' },
  ]

  const mockTypes = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL']

  it('deve renderizar controles de filtro', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{}}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    expect(screen.getByLabelText(/de/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/até/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ativo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
  })

  it('deve chamar onFilterChange ao mudar data inicial', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{}}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    const inputFrom = screen.getByLabelText(/de/i) as HTMLInputElement
    fireEvent.change(inputFrom, { target: { value: '2026-04-01' } })

    expect(mockOnChange).toHaveBeenCalledWith({ dateFrom: '2026-04-01' })
  })

  it('deve chamar onFilterChange ao mudar data final', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{ dateFrom: '2026-04-01' }}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    const inputTo = screen.getByLabelText(/até/i) as HTMLInputElement
    fireEvent.change(inputTo, { target: { value: '2026-04-15' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-15',
    })
  })

  it('deve chamar onFilterChange ao selecionar um ativo', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{}}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    const assetSelect = screen.getByLabelText(/ativo/i) as HTMLSelectElement
    fireEvent.change(assetSelect, { target: { value: 'asset-1' } })

    expect(mockOnChange).toHaveBeenCalledWith({ assetId: 'asset-1' })
  })

  it('deve chamar onFilterChange ao selecionar um tipo', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{}}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    const typeSelect = screen.getByLabelText(/tipo/i) as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'BUY' } })

    expect(mockOnChange).toHaveBeenCalledWith({ type: 'BUY' })
  })

  it('deve resetar todos os filtros ao clicar em Limpar', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{ dateFrom: '2026-04-01', assetId: 'asset-1', type: 'BUY' }}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    const resetButton = screen.getByText(/limpar/i)
    fireEvent.click(resetButton)

    expect(mockOnChange).toHaveBeenCalledWith({})
  })

  it('deve mostrar botão limpar quando há filtros ativos', () => {
    const mockOnChange = vi.fn()

    const { rerender } = render(
      <TransactionFilters
        filter={{}}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    expect(screen.queryByText(/limpar/i)).not.toBeInTheDocument()

    rerender(
      <TransactionFilters
        filter={{ dateFrom: '2026-04-01' }}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    expect(screen.getByText(/limpar/i)).toBeInTheDocument()
  })

  it('deve preencher inputs com valores do filtro', () => {
    const mockOnChange = vi.fn()

    render(
      <TransactionFilters
        filter={{
          dateFrom: '2026-04-01',
          dateTo: '2026-04-15',
          assetId: 'asset-1',
          type: 'BUY',
        }}
        onFilterChange={mockOnChange}
        assets={mockAssets}
        transactionTypes={mockTypes}
      />
    )

    expect((screen.getByLabelText(/de/i) as HTMLInputElement).value).toBe('2026-04-01')
    expect((screen.getByLabelText(/até/i) as HTMLInputElement).value).toBe('2026-04-15')
    expect((screen.getByLabelText(/ativo/i) as HTMLSelectElement).value).toBe('asset-1')
    expect((screen.getByLabelText(/tipo/i) as HTMLSelectElement).value).toBe('BUY')
  })
})
