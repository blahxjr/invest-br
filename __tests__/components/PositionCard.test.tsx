// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import PositionCard from '@/components/PositionCard'

describe('PositionCard', () => {
  const baseProps = {
    ticker: 'PETR4',
    name: 'Petrobras PN',
    quantity: 100,
    averageCost: 35.5,
    totalCost: 3550,
    category: 'STOCK',
  }

  it('exibe ticker e nome do ativo', () => {
    render(<PositionCard {...baseProps} />)
    expect(screen.getByText('PETR4')).toBeInTheDocument()
    expect(screen.getByText('Petrobras PN')).toBeInTheDocument()
  })

  it('exibe quantidade e custo médio', () => {
    render(<PositionCard {...baseProps} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    // custo médio ~R$ 35,50
    expect(screen.getByText(/35[,.]50/)).toBeInTheDocument()
  })

  it('exibe categoria do ativo', () => {
    render(<PositionCard {...baseProps} />)
    expect(screen.getByText('STOCK')).toBeInTheDocument()
  })

  it('exibe P&L positivo em verde quando gainLoss > 0', () => {
    render(
      <PositionCard
        {...baseProps}
        currentPrice={38.45}
        currentValue={3845}
        gainLoss={295}
        gainLossPercent={8.31}
        quoteChangePct={1.23}
      />,
    )
    expect(screen.getByText(/Var\. dia/i)).toBeInTheDocument()
    expect(screen.getByText(/\+1\.23%/)).toBeInTheDocument()
    const pnl = screen.getByText(/295/)
    expect(pnl.closest('div')?.className).toMatch(/green/)
  })

  it('omite seção de P&L e exibe fallback quando currentPrice é null', () => {
    render(<PositionCard {...baseProps} currentPrice={null} />)
    expect(screen.queryByText(/Var\. dia/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Valor atual$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Cotação indisponível/i)).toBeInTheDocument()
    expect(screen.getByText(/fallback de custo/i)).toBeInTheDocument()
  })
})
