// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/ui/EmptyState'

describe('EmptyState', () => {
  it('renderiza título, descrição e ícone', () => {
    render(
      <EmptyState
        icon="📭"
        title="Nada por aqui"
        description="Comece adicionando seu primeiro item."
      />,
    )

    expect(screen.getByText('Nada por aqui')).toBeInTheDocument()
    expect(screen.getByText('Comece adicionando seu primeiro item.')).toBeInTheDocument()
    expect(screen.getByText('📭')).toBeInTheDocument()
  })

  it('renderiza botão de ação com onClick e dispara callback', () => {
    const onClick = vi.fn()

    render(
      <EmptyState
        icon="➕"
        title="Sem registros"
        description="Adicione um registro para continuar."
        action={{ label: 'Adicionar', onClick }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Adicionar' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renderiza link de ação quando href é informado', () => {
    render(
      <EmptyState
        icon="🎯"
        title="Sem meta"
        description="Defina uma meta para avançar."
        action={{ label: 'Configurar', href: '/insights/rebalance/config' }}
      />,
    )

    const link = screen.getByRole('link', { name: 'Configurar' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/insights/rebalance/config')
  })

  it('não renderiza ação quando action não é fornecida', () => {
    render(
      <EmptyState
        icon="💡"
        title="Sem ação"
        description="Estado sem CTA."
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
