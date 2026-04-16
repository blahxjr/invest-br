// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AssetSearchCombobox } from '@/components/ui/AssetSearchCombobox'

describe('AssetSearchCombobox', () => {
  const assets = [
    { id: '1', ticker: 'HGLG11', name: 'CSHG Logistica', className: 'Fundos Imobiliarios' },
    { id: '2', ticker: 'VALE3', name: 'Vale ON', className: 'Ações' },
  ]

  it('filtra por ticker sem diferenciar maiúsculas/minúsculas', () => {
    const onChange = vi.fn()
    render(<AssetSearchCombobox assets={assets} value={null} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por ticker ou nome...'), {
      target: { value: 'hglg' },
    })

    expect(screen.getByText(/HGLG11/i)).toBeInTheDocument()
    expect(screen.queryByText(/VALE3/i)).not.toBeInTheDocument()
  })

  it('filtra por nome do ativo', () => {
    const onChange = vi.fn()
    render(<AssetSearchCombobox assets={assets} value={null} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por ticker ou nome...'), {
      target: { value: 'vale' },
    })

    expect(screen.getByText(/VALE3/i)).toBeInTheDocument()
    expect(screen.queryByText(/HGLG11/i)).not.toBeInTheDocument()
  })
})
