// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import IncomeCard from '@/components/IncomeCard'

describe('IncomeCard', () => {
  const baseProps = {
    type: 'DIVIDEND',
    ticker: 'PETR4',
    grossAmount: 150.0,
    netAmount: 127.5,
    paymentDate: new Date('2026-03-15'),
  }

  it('exibe o tipo de rendimento traduzido', () => {
    render(<IncomeCard {...baseProps} />)
    expect(screen.getByText('Dividendo')).toBeInTheDocument()
  })

  it('exibe ticker do ativo', () => {
    render(<IncomeCard {...baseProps} />)
    expect(screen.getByText('PETR4')).toBeInTheDocument()
  })

  it('exibe valor bruto e líquido', () => {
    render(<IncomeCard {...baseProps} />)
    expect(screen.getByText(/150/)).toBeInTheDocument()
    expect(screen.getByText(/127[,.]50/)).toBeInTheDocument()
  })

  it('exibe IR retido quando grossAmount > netAmount', () => {
    render(<IncomeCard {...baseProps} />)
    expect(screen.getByText(/IR retido/)).toBeInTheDocument()
  })

  it('não exibe IR retido quando não há imposto', () => {
    render(<IncomeCard {...baseProps} grossAmount={100} netAmount={100} />)
    expect(screen.queryByText(/IR retido/)).not.toBeInTheDocument()
  })

  it('exibe rendimento FII com label correto', () => {
    render(<IncomeCard {...baseProps} type="FII_RENT" />)
    expect(screen.getByText('Rendimento FII')).toBeInTheDocument()
  })

  it('renderiza sem ticker quando não informado', () => {
    const { container } = render(
      <IncomeCard type="RENTAL" grossAmount={500} netAmount={500} paymentDate={new Date()} />
    )
    expect(container).toBeTruthy()
  })
})
