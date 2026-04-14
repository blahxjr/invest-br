// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/Sidebar'

// Mock usePathname do next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

// Mock next/link para simplificar o teste
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('Sidebar', () => {
  it('exibe a marca InvestBR', () => {
    render(<Sidebar />)
    expect(screen.getAllByText('InvestBR').length).toBeGreaterThan(0)
  })

  it('exibe todos os itens de navegação', () => {
    render(<Sidebar />)
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Contas').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Instituições').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ativos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Movimentações').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Posições').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rentabilidade').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Importar B3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Proventos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Regras Insights').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perfis Insights').length).toBeGreaterThan(0)

    const labels = screen.getAllByRole('link').map((link) => link.textContent?.trim())
    expect(labels.indexOf('Posições')).toBeGreaterThan(-1)
    expect(labels.indexOf('Rentabilidade')).toBeGreaterThan(-1)
    expect(labels.indexOf('Importar B3')).toBeGreaterThan(-1)
    expect(labels.indexOf('Posições')).toBeLessThan(labels.indexOf('Rentabilidade'))
    expect(labels.indexOf('Rentabilidade')).toBeLessThan(labels.indexOf('Importar B3'))
  })

  it('links apontam para as rotas corretas', () => {
    render(<Sidebar />)
    const dashLinks = screen.getAllByRole('link', { name: /Dashboard/i })
    expect(dashLinks[0]).toHaveAttribute('href', '/dashboard')
  })
})
