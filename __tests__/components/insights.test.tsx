/**
 * Testes dos componentes de Insights
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InsightCard } from '@/components/InsightCard'
import { InsightsList } from '@/components/InsightsList'
import { Insight, InsightType } from '@/modules/insights/types'
import { Decimal } from '@prisma/client'

const mockInsight: Insight = {
  id: 'test-1',
  type: InsightType.CONCENTRACAO_ATIVO,
  severity: 'warning',
  title: 'WEGE3 representa 28% da carteira',
  message: 'Concentração elevada pode aumentar o risco.',
  scope: {
    clientId: 'cli-123',
    assetId: 'ast-wege3',
  },
  metrics: {
    currentPercentage: 0.28,
    threshold: 0.25,
    excessPercentage: 0.03,
  },
  affectedAssets: [
    {
      assetId: 'ast-wege3',
      assetName: 'WEG S/A',
      percentage: 0.28,
      absoluteValue: new Decimal('14000'),
    },
  ],
}

describe('Componentes de Insights', () => {
  it('InsightCard deve renderizar com título e severidade', () => {
    render(<InsightCard insight={mockInsight} />)

    expect(screen.getByText('WEGE3 representa 28% da carteira')).toBeDefined()
    expect(screen.getByText('WARNING')).toBeDefined()
    expect(screen.getByText(/CONCENTRACAO ATIVO/)).toBeDefined()
  })

  it('InsightCard deve exibir métricas corretamente', () => {
    const { container } = render(<InsightCard insight={mockInsight} />)

    expect(container.textContent).toContain('28.0')
    expect(container.textContent).toContain('25.0')
    expect(container.textContent).toContain('3.0')
  })

  it('InsightCard deve exibir ativos afetados', () => {
    render(<InsightCard insight={mockInsight} />)

    expect(screen.getByText('WEG S/A')).toBeDefined()
  })

  it('InsightsList deve renderizar lista vazia com mensagem apropriada', () => {
    render(<InsightsList insights={[]} />)

    expect(screen.getByText(/bem balanceada/)).toBeDefined()
  })

  it('InsightsList deve exibir contador de insights', () => {
    const insights = [mockInsight, { ...mockInsight, id: 'test-2' }]
    render(<InsightsList insights={insights} />)

    expect(screen.getByText('2 de 2 insight(s)')).toBeDefined()
  })

  it('InsightsList deve exibir mensagem de carregamento', () => {
    render(<InsightsList insights={[]} isLoading={true} />)

    expect(screen.getByText('Carregando insights...')).toBeDefined()
  })

  it('InsightsList deve exibir mensagem de erro', () => {
    render(<InsightsList insights={[]} error="Erro ao conectar" />)

    expect(screen.getByText(/Erro ao conectar/)).toBeDefined()
  })
})

