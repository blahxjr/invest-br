// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import AccountCard from '@/components/AccountCard'

describe('AccountCard', () => {
  const baseProps = {
    accountId: 'acc-1',
    name: 'Corretora XP',
    type: 'BROKERAGE',
    balance: 8500.0,
    institutionName: 'XP Investimentos',
    transactionCount: 12,
  }

  it('exibe nome da conta', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByText('Corretora XP')).toBeInTheDocument()
  })

  it('exibe tipo de conta traduzido', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByText('Corretora')).toBeInTheDocument()
  })

  it('exibe nome da instituição', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByText('XP Investimentos')).toBeInTheDocument()
  })

  it('exibe saldo formatado em BRL', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByText(/8[.,]500/)).toBeInTheDocument()
  })

  it('exibe contagem de movimentações', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByText('12 movimentações')).toBeInTheDocument()
  })

  it('renderiza sem instituição e sem contagem', () => {
    render(<AccountCard accountId="acc-2" name="Conta Manual" type="BANK" balance={1000} />)
    expect(screen.getByText('Conta Manual')).toBeInTheDocument()
    expect(screen.queryByText(/movimentações/)).not.toBeInTheDocument()
  })

  it('exibe link para editar conta', () => {
    render(<AccountCard {...baseProps} />)
    expect(screen.getByRole('link', { name: 'Editar conta' })).toHaveAttribute('href', '/accounts/acc-1/edit')
  })
})
