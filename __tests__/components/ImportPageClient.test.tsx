// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImportPageClient from '@/app/(app)/import/import-page-client'

const actionsMock = vi.hoisted(() => ({
  analyzeNegociacaoFile: vi.fn(),
  confirmAndImportNegociacao: vi.fn(),
  importMovimentacao: vi.fn(),
  importPosicao: vi.fn(),
}))

vi.mock('@/app/(app)/import/actions', () => ({
  analyzeNegociacaoFile: actionsMock.analyzeNegociacaoFile,
  confirmAndImportNegociacao: actionsMock.confirmAndImportNegociacao,
  importMovimentacao: actionsMock.importMovimentacao,
  importPosicao: actionsMock.importPosicao,
}))

describe('ImportPageClient wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionsMock.importMovimentacao.mockResolvedValue({ imported: 0, skipped: 0, errors: [] })
    actionsMock.importPosicao.mockResolvedValue({ upserted: 0, errors: [] })
    actionsMock.confirmAndImportNegociacao.mockResolvedValue({
      assetsCreated: 1,
      transactionsImported: 2,
      transactionsSkipped: 0,
    })
  })

  async function submitAnalyze() {
    const analyzeButton = screen.getByRole('button', { name: 'Analisar planilha' })
    const form = analyzeButton.closest('form')
    expect(form).toBeTruthy()
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => {
      expect(actionsMock.analyzeNegociacaoFile).toHaveBeenCalled()
    })
  }

  it('mostra Step 2 apenas quando ha ativos nao resolvidos', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce({
      ready: [],
      unresolvedAssets: [
        {
          ticker: 'BRCO11',
          suggestedName: 'BRCO11 - FII',
          inferredClass: 'FII',
          availableClasses: ['FII', 'ACOES'],
          rows: [
            {
              date: '2026-04-13T00:00:00.000Z',
              type: 'BUY',
              ticker: 'BRCO11',
              mercado: 'Mercado a Vista',
              instituicao: 'BTG',
              quantity: 1,
              price: 10,
              total: 10,
              referenceId: 'x',
            },
          ],
        },
      ],
      summary: {
        totalRows: 1,
        readyCount: 0,
        unresolvedCount: 1,
        uniqueUnresolvedTickers: ['BRCO11'],
      },
    })

    render(<ImportPageClient />)

    await submitAnalyze()

    expect(screen.getByText('📋 1 ativo(s) novo(s) encontrado(s)')).toBeInTheDocument()
  })

  it('botao Confirmar todos como FII resolve ativos e habilita avancar', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce({
      ready: [],
      unresolvedAssets: [
        {
          ticker: 'BRCO11',
          suggestedName: 'BRCO11 - FII',
          inferredClass: 'FII',
          availableClasses: ['FII', 'ACOES'],
          rows: [
            {
              date: '2026-04-13T00:00:00.000Z',
              type: 'BUY',
              ticker: 'BRCO11',
              mercado: 'Mercado a Vista',
              instituicao: 'BTG',
              quantity: 1,
              price: 10,
              total: 10,
              referenceId: 'x',
            },
          ],
        },
      ],
      summary: {
        totalRows: 1,
        readyCount: 0,
        unresolvedCount: 1,
        uniqueUnresolvedTickers: ['BRCO11'],
      },
    })

    render(<ImportPageClient />)
    await submitAnalyze()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar todos como FII' }))

    const nextButton = screen.getByRole('button', { name: 'Avançar →' })
    expect(nextButton).toBeEnabled()

    fireEvent.click(nextButton)
    expect(screen.getByText(/ativos serão cadastrados/i)).toBeInTheDocument()
  })

  it('Step 3 exibe resumo correto com contagens', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce({
      ready: [
        {
          date: '2026-04-13T00:00:00.000Z',
          type: 'BUY',
          ticker: 'VALE3',
          mercado: 'Mercado a Vista',
          instituicao: 'BTG',
          quantity: 1,
          price: 10,
          total: 10,
          referenceId: 'ready-1',
          assetId: 'asset-1',
        },
      ],
      unresolvedAssets: [
        {
          ticker: 'BRCO11',
          suggestedName: 'BRCO11 - FII',
          inferredClass: 'FII',
          availableClasses: ['FII', 'ACOES'],
          rows: [
            {
              date: '2026-04-13T00:00:00.000Z',
              type: 'BUY',
              ticker: 'BRCO11',
              mercado: 'Mercado a Vista',
              instituicao: 'BTG',
              quantity: 1,
              price: 10,
              total: 10,
              referenceId: 'x',
            },
          ],
        },
      ],
      summary: {
        totalRows: 2,
        readyCount: 1,
        unresolvedCount: 1,
        uniqueUnresolvedTickers: ['BRCO11'],
      },
    })

    render(<ImportPageClient />)
    await submitAnalyze()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar todos como FII' }))
    fireEvent.click(screen.getByRole('button', { name: 'Avançar →' }))

    expect(screen.getByText('✅ 1 transações prontas para importar')).toBeInTheDocument()
    expect(screen.getByText('🆕 1 ativos serão cadastrados')).toBeInTheDocument()
    expect(screen.getByText('🔗 0 ativos serão associados a cadastros existentes')).toBeInTheDocument()
  })
})
