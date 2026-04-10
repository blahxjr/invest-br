// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InsightRulesForm } from '@/components/InsightRulesForm'

const baseRules = [
  {
    code: 'CONCENTRACAO_ATIVO',
    label: 'Concentracao por ativo',
    description: 'Teste de regra por ativo',
    enabled: true,
    threshold: 0.25,
    defaultThreshold: 0.25,
  },
  {
    code: 'CONCENTRACAO_CLASSE',
    label: 'Concentracao por classe',
    description: 'Teste de regra por classe',
    enabled: false,
    threshold: 0.5,
    defaultThreshold: 0.5,
  },
]

describe('InsightRulesForm', () => {
  it('renderiza regras com estado inicial correto', () => {
    render(
      <InsightRulesForm
        rules={baseRules}
        action={vi.fn(async () => {})}
      />
    )

    expect(screen.getByText('Concentracao por ativo')).toBeInTheDocument()
    expect(screen.getByText('Concentracao por classe')).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox', { name: /Ativo/i })
    expect(checkboxes[0]).toBeChecked()

    expect(screen.getByDisplayValue('25.0')).toBeInTheDocument()
    expect(screen.getByDisplayValue('50.0')).toBeInTheDocument()
  })

  it('permite ligar e desligar insight via toggle', () => {
    render(
      <InsightRulesForm
        rules={baseRules}
        action={vi.fn(async () => {})}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox', { name: /Ativo/i })
    expect(checkboxes[1]).not.toBeChecked()

    fireEvent.click(checkboxes[1])
    expect(checkboxes[1]).toBeChecked()
  })

  it('permite alterar limite percentual', () => {
    render(
      <InsightRulesForm
        rules={baseRules}
        action={vi.fn(async () => {})}
      />
    )

    const thresholdInput = screen.getByDisplayValue('25.0') as HTMLInputElement
    fireEvent.change(thresholdInput, { target: { value: '33.3' } })

    expect(thresholdInput.value).toBe('33.3')
  })

  it('exibe leitura de valor persistido quando inicial difere do default', () => {
    render(
      <InsightRulesForm
        rules={[
          {
            code: 'HORIZONTE_DESALINHADO',
            label: 'Horizonte desalinhado',
            enabled: true,
            threshold: 0.42,
            defaultThreshold: 0.3,
          },
        ]}
        action={vi.fn(async () => {})}
      />
    )

    expect(screen.getByDisplayValue('42.0')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })
})
