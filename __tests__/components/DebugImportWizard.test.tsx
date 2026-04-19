// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImportWizard } from '@/app/(app)/debug/import/components/ImportWizard'

const actionsMock = vi.hoisted(() => ({
  importNegociacaoDebug: vi.fn(),
  importMovimentacaoDebug: vi.fn(),
  importPosicaoDebug: vi.fn(),
}))

vi.mock('@/app/(app)/debug/import/actions', () => ({
  importNegociacaoDebug: actionsMock.importNegociacaoDebug,
  importMovimentacaoDebug: actionsMock.importMovimentacaoDebug,
  importPosicaoDebug: actionsMock.importPosicaoDebug,
}))

function successResponse(step: 'NEGOCIACAO' | 'MOVIMENTACAO' | 'POSICAO') {
  return {
    ok: true,
    step,
    summary: {
      parsedRows: 1,
      imported: 1,
      skipped: 0,
      upserted: 0,
      errorsCount: 0,
    },
    preview: {
      columns: ['Data', 'Ticker'],
      rows: [['2026-04-19', 'VALE3']],
    },
    logsMd: `# Debug Import ${step}`,
    errors: [],
  }
}

function failResponse(step: 'NEGOCIACAO' | 'MOVIMENTACAO' | 'POSICAO') {
  return {
    ok: false,
    step,
    summary: {
      parsedRows: 0,
      imported: 0,
      skipped: 0,
      upserted: 0,
      errorsCount: 1,
    },
    preview: { columns: [], rows: [] },
    logsMd: `# Debug Import ${step}\n\n- status: failed`,
    errors: ['erro_teste'],
  }
}

function attachFile(input: HTMLElement, name = 'planilha.xlsx') {
  const file = new File(['conteudo'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImportWizard debug/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionsMock.importNegociacaoDebug.mockResolvedValue(successResponse('NEGOCIACAO'))
    actionsMock.importMovimentacaoDebug.mockResolvedValue(successResponse('MOVIMENTACAO'))
    actionsMock.importPosicaoDebug.mockResolvedValue(successResponse('POSICAO'))
  })

  it('renderiza as quatro tabs principais', () => {
    render(<ImportWizard />)

    expect(screen.getByRole('tab', { name: 'Importar Planilhas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resultados' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Logs .md' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Issues Abertos' })).toBeInTheDocument()
  })

  it('inicia no step 1 e mantém step 2 e 3 bloqueados', () => {
    render(<ImportWizard />)

    const fileInputNeg = screen.getByTestId('file-input-NEGOCIACAO') as HTMLInputElement
    const fileInputMov = screen.getByTestId('file-input-MOVIMENTACAO') as HTMLInputElement
    const fileInputPos = screen.getByTestId('file-input-POSICAO') as HTMLInputElement

    expect(fileInputNeg.disabled).toBe(false)
    expect(fileInputMov.disabled).toBe(true)
    expect(fileInputPos.disabled).toBe(true)
  })

  it('habilita botão Importar e Analisar ao anexar arquivo no step ativo', () => {
    render(<ImportWizard />)
    const buttons = screen.getAllByRole('button', { name: 'Importar e Analisar' })
    const firstButton = buttons[0] as HTMLButtonElement

    expect(firstButton.disabled).toBe(true)
    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    expect(firstButton.disabled).toBe(false)
  })

  it('executa action de negociacao e avança para step 2', async () => {
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])

    await waitFor(() => {
      expect(actionsMock.importNegociacaoDebug).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Importar Planilhas' }))
    const fileInputMov = screen.getByTestId('file-input-MOVIMENTACAO') as HTMLInputElement
    expect(fileInputMov.disabled).toBe(false)
  })

  it('executa step 2 e libera step 3', async () => {
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])
    await waitFor(() => expect(actionsMock.importNegociacaoDebug).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Importar Planilhas' }))
    attachFile(screen.getByTestId('file-input-MOVIMENTACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[1])
    await waitFor(() => expect(actionsMock.importMovimentacaoDebug).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Importar Planilhas' }))
    const fileInputPos = screen.getByTestId('file-input-POSICAO') as HTMLInputElement
    expect(fileInputPos.disabled).toBe(false)
  })

  it('não avança step quando resposta do step atual falha', async () => {
    actionsMock.importNegociacaoDebug.mockResolvedValueOnce(failResponse('NEGOCIACAO'))
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])
    await waitFor(() => expect(actionsMock.importNegociacaoDebug).toHaveBeenCalled())

    const fileInputMov = screen.getByTestId('file-input-MOVIMENTACAO') as HTMLInputElement
    expect(fileInputMov.disabled).toBe(true)
  })

  it('troca para aba Resultados após importação com sucesso', async () => {
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])

    await waitFor(() => {
      expect(screen.getByText('Parseadas: 1 | Importadas: 1 | Puladas: 0 | Upserts: 0')).toBeInTheDocument()
    })
  })

  it('exibe conteúdo em Logs .md', async () => {
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])
    await waitFor(() => expect(actionsMock.importNegociacaoDebug).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Logs .md' }))
    expect(screen.getByText('# Debug Import NEGOCIACAO')).toBeInTheDocument()
  })

  it('lista erro na aba Issues Abertos', async () => {
    actionsMock.importNegociacaoDebug.mockResolvedValueOnce(failResponse('NEGOCIACAO'))
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])
    await waitFor(() => expect(actionsMock.importNegociacaoDebug).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Issues Abertos' }))
    expect(screen.getByText('erro_teste')).toBeInTheDocument()
  })

  it('mostra preview em tabela de resultados', async () => {
    render(<ImportWizard />)

    attachFile(screen.getByTestId('file-input-NEGOCIACAO'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Importar e Analisar' })[0])

    await waitFor(() => {
      expect(screen.getByText('VALE3')).toBeInTheDocument()
    })
  })
})
