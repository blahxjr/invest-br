// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Decimal from 'decimal.js'
import React from 'react'

import RebalancePageClient from '@/app/(app)/insights/rebalance/page-client'

describe('RebalancePageClient', () => {
  const mockRebalanceResult = {
    totalPortfolioValue: new Decimal(10000),
    allocations: [
      {
        assetClass: 'ACOES',
        label: 'Ações',
        currentValue: new Decimal(3000),
        currentPct: new Decimal(30),
        targetPct: new Decimal(40),
        deviationPct: new Decimal(-10),
        status: 'ABAIXO',
        suggestionValue: new Decimal(1000),
        suggestionLabel: 'Aportar R$ 1.000,00',
      },
      {
        assetClass: 'RENDA_FIXA',
        label: 'Renda Fixa',
        currentValue: new Decimal(7000),
        currentPct: new Decimal(70),
        targetPct: new Decimal(60),
        deviationPct: new Decimal(10),
        status: 'ACIMA',
        suggestionValue: new Decimal(-1000),
        suggestionLabel: 'Reduzir R$ 1.000,00',
      },
    ],
    isBalanced: false,
    lastUpdated: new Date(),
  }

  it('Tabela de alocação renderiza corretamente com mock de RebalanceResult', () => {
    render(<RebalancePageClient rebalanceResult={mockRebalanceResult as any} alerts={[]} />)

    expect(screen.getByText('Alocação por Classe')).toBeInTheDocument()
    expect(screen.getByText('Ações')).toBeInTheDocument()
    expect(screen.getByText('Renda Fixa')).toBeInTheDocument()
    expect(screen.getByText('Aportar R$ 1.000,00')).toBeInTheDocument()
  })

  it('Alerta CRITICAL renderiza com cor vermelha', () => {
    const alerts = [
      {
        id: '1',
        type: 'CONCENTRACAO',
        severity: 'CRITICAL',
        title: 'Concentração crítica',
        description: 'Teste crítico ⚠️ Esta é uma análise automatizada, não uma recomendação de investimento.',
      },
    ]

    const { container } = render(
      <RebalancePageClient rebalanceResult={mockRebalanceResult as any} alerts={alerts as any} />
    )

    const redAlert = container.querySelector('.bg-red-50')
    expect(redAlert).toBeInTheDocument()
    expect(screen.getByText('Concentração crítica')).toBeInTheDocument()
  })

  it('Disclaimer visível na página', () => {
    render(<RebalancePageClient rebalanceResult={mockRebalanceResult as any} alerts={[]} />)

    expect(screen.getByText(/não constitui recomendação de investimento/i)).toBeInTheDocument()
  })
})
