// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AllocationChart from '@/components/AllocationChart'

describe('AllocationChart', () => {
  const items = [
    { category: 'STOCK', value: '300.00', percentage: '30.0' },
    { category: 'FII', value: '700.00', percentage: '70.0' },
  ]

  it('renderiza legendas com categorias e percentuais', () => {
    render(<AllocationChart items={items} />)
    expect(screen.getAllByText('STOCK').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30.0%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FII').length).toBeGreaterThan(0)
    expect(screen.getAllByText('70.0%').length).toBeGreaterThan(0)
  })

  it('renderiza SVG do donut', () => {
    const { container } = render(<AllocationChart items={items} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renderiza mensagem vazia quando sem dados', () => {
    render(<AllocationChart items={[]} />)
    expect(screen.getByText(/sem posi/i)).toBeInTheDocument()
  })
})
