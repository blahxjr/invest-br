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

  it('mostra variação positiva com ícone de alta quando currentValue > averageCost', () => {
    render(<PositionCard {...baseProps} currentValue={40} />)
    // totalCost = 100 * 35.5 = 3550, totalCurrent = 100 * 40 = 4000, gain = 450
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('mostra variação negativa quando currentValue < averageCost', () => {
    render(<PositionCard {...baseProps} currentValue={30} />)
    // totalCost = 3550, totalCurrent = 3000, loss = -550
    expect(screen.getByText(/-.*550/)).toBeInTheDocument()
  })
})
