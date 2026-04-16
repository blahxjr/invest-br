// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ImportPageClient from '@/app/(app)/import/import-page-client'

const actionsMock = vi.hoisted(() => ({
  analyzeNegociacaoFile: vi.fn(),
  analyzeMovimentacaoFile: vi.fn(),
  analyzePosicaoFile: vi.fn(),
  confirmAndImportNegociacao: vi.fn(),
  confirmAndImportMovimentacao: vi.fn(),
  confirmAndImportPosicao: vi.fn(),
  resetImportDataAction: vi.fn(),
}))

vi.mock('@/app/(app)/import/actions', () => ({
  analyzeNegociacaoFile: actionsMock.analyzeNegociacaoFile,
  analyzeMovimentacaoFile: actionsMock.analyzeMovimentacaoFile,
  analyzePosicaoFile: actionsMock.analyzePosicaoFile,
  confirmAndImportNegociacao: actionsMock.confirmAndImportNegociacao,
  confirmAndImportMovimentacao: actionsMock.confirmAndImportMovimentacao,
  confirmAndImportPosicao: actionsMock.confirmAndImportPosicao,
  resetImportDataAction: actionsMock.resetImportDataAction,
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
    institutionPreviews: [
      {
        normalizedName: 'NU INVEST CORRETORA DE VALORES S.A.',
        displayName: 'Nu Invest',
        inferredType: 'Corretora',
        isNew: true,
        accountName: 'Nu Invest',
        accountStatus: 'NOVA',
        isAccountNew: true,
        rowCount: 1,
      },
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
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    actionsMock.analyzeMovimentacaoFile.mockResolvedValue({ lines: [], summary: { totalRows: 0, importableRows: 0, reviewRows: 0 } })
    actionsMock.analyzePosicaoFile.mockResolvedValue({ lines: [], summary: { totalRows: 0, importableRows: 0, reviewRows: 0 } })
    actionsMock.confirmAndImportMovimentacao.mockResolvedValue({ imported: 0, skipped: 0, reviewed: 0, errors: [] })
    actionsMock.confirmAndImportPosicao.mockResolvedValue({ upserted: 0, skipped: 0, reviewed: 0, errors: [] })
    actionsMock.resetImportDataAction.mockResolvedValue({
      success: true,
      summary: {
        auditLogsDeleted: 2,
        ledgerEntriesDeleted: 3,
        incomeEventsDeleted: 1,
        rentalReceiptsDeleted: 0,
        transactionsDeleted: 4,
        accountsDeleted: 1,
        institutionsDeleted: 1,
        assetsDeleted: 2,
        assetClassesDeleted: 1,
      },
    })
    actionsMock.confirmAndImportNegociacao.mockResolvedValue({
      assetsCreated: 1,
      institutionsCreated: 1,
      accountsCreated: 1,
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Avançar →' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Avançar →' }))

    expect(screen.getByText(/🏷️ 1 classe\(s\) de ativo serão criadas:/i)).toBeInTheDocument()
    expect(screen.getByText(/ETFs \(código: ETF\)/i)).toBeInTheDocument()
  })

  it('botao Confirmar e Importar fica desabilitado durante loading', async () => {
    actionsMock.analyzeNegociacaoFile.mockResolvedValueOnce(buildAnalyzeResponse())

    let resolveImport: ((value: { assetsCreated: number; institutionsCreated: number; accountsCreated: number; transactionsImported: number; transactionsSkipped: number }) => void) | undefined
    actionsMock.confirmAndImportNegociacao.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve
      }),
    )

    render(<ImportPageClient />)
    await submitAnalyze()
    fireEvent.click(screen.getByRole('button', { name: 'Avançar →' }))

    const confirmButton = screen.getByRole('button', { name: '✅ Confirmar e Importar' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '⏳ Importando...' })).toBeDisabled()
    })

    await act(async () => {
      resolveImport?.({ assetsCreated: 1, institutionsCreated: 1, accountsCreated: 1, transactionsImported: 1, transactionsSkipped: 0 })
    })
  })

  it('abre confirmacao e executa limpeza da base de importacao', async () => {
    render(<ImportPageClient />)

    fireEvent.click(screen.getByRole('button', { name: 'Limpar dados de teste' }))

    expect(window.alert).toHaveBeenCalledWith(
      'Atenção: esta operação remove dados de importação e não pode ser desfeita.',
    )

    expect(screen.getByRole('button', { name: 'Limpar base' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar base' }))

    await waitFor(() => {
      expect(actionsMock.resetImportDataAction).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Base limpa com sucesso.')).toBeInTheDocument()
    expect(screen.getByText('4 transações e 2 ativos removidos.')).toBeInTheDocument()
  })

  it('renderiza limpeza apos os cards de movimentacao e posicao', () => {
    render(<ImportPageClient />)

    const titles = screen.getAllByRole('heading', { level: 2 }).map((element) => element.textContent)

    expect(titles.indexOf('Movimentação')).toBeLessThan(titles.indexOf('Limpar base de importação'))
    expect(titles.indexOf('Posição')).toBeLessThan(titles.indexOf('Limpar base de importação'))
  })

  it('exibe botões de análise para movimentação e posição', () => {
    render(<ImportPageClient />)

    expect(screen.getByRole('button', { name: 'Analisar movimentação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analisar posição' })).toBeInTheDocument()
  })
})
