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

function buildAnalyzeResponse() {
  return {
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
        ticker: 'DIVO11',
        suggestedName: 'DIVO11 - ETF',
        inferredClass: 'ETF',
        inferredCategory: 'ETF',
        rows: [
          {
            date: '2026-04-13T00:00:00.000Z',
            type: 'BUY',
            ticker: 'DIVO11',
            mercado: 'Mercado a Vista',
            instituicao: 'BTG',
            quantity: 1,
            price: 106.86,
            total: 106.86,
            referenceId: 'x',
          },
        ],
      },
    ],
    missingClasses: [
      {
        inferredCode: 'ETF',
        suggestedName: 'ETFs',
        suggestedDescription: 'Fundos de índice negociados em bolsa',
        affectedTickers: ['DIVO11'],
        name: 'ETFs',
        code: 'ETF',
        description: 'Fundos de índice negociados em bolsa',
      },
    ],
    availableClasses: [
      { id: 'class-fii', name: 'Fundos Imobiliários', code: 'FII' },
      { id: 'class-acoes', name: 'Ações', code: 'ACOES' },
    ],
    existingAssets: [
      { id: 'asset-existing', ticker: 'HGLG11', name: 'CSHG Logística', className: 'Fundos Imobiliários' },
    ],
    summary: {
      totalRows: 2,
      readyCount: 1,
      unresolvedCount: 1,
      uniqueUnresolvedTickers: ['DIVO11'],
    },
  }
}

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
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce(buildAnalyzeResponse())

    render(<ImportPageClient />)
    await submitAnalyze()

    expect(screen.getByText('📋 1 ativo(s) novo(s) encontrado(s)')).toBeInTheDocument()
  })

  it('exibe seção de classes ausentes quando missingClasses > 0', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce(buildAnalyzeResponse())

    render(<ImportPageClient />)
    await submitAnalyze()

    expect(screen.getByText('⚠️ Novas classes de ativos serão criadas')).toBeInTheDocument()
    expect(screen.getByText(/Confirmar criação automática das classes acima/i)).toBeInTheDocument()
  })

  it('botao Confirmar todos como FII resolve ativos e habilita avancar', async () => {
    const response = buildAnalyzeResponse()
    response.unresolvedAssets = [
      {
        ticker: 'BRCO11',
        suggestedName: 'BRCO11 - FII',
        inferredClass: 'FII',
        inferredCategory: 'FII',
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
    ]
    response.missingClasses = []
    response.availableClasses = [{ id: 'class-fii', name: 'Fundos Imobiliários', code: 'FII' }]

    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce(response)

    render(<ImportPageClient />)
    await submitAnalyze()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar todos como FII' }))

    const nextButton = screen.getByRole('button', { name: 'Avançar →' })
    expect(nextButton).toBeEnabled()
  })

  it('Step 3 exibe contagem de classes a criar no resumo', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce(buildAnalyzeResponse())

    render(<ImportPageClient />)
    await submitAnalyze()

    fireEvent.click(screen.getByRole('button', { name: 'Avançar →' }))

    expect(screen.getByText(/🏷️ 1 classe\(s\) de ativo serão criadas:/i)).toBeInTheDocument()
    expect(screen.getByText(/ETFs \(código: ETF\)/i)).toBeInTheDocument()
  })
})
