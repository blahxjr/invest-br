// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks declarados antes de qualquer import ────────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
  ledgerEntry: {
    findMany: vi.fn(),
  },
}))
const parserMock = vi.hoisted(() => ({
  parseNegociacao: vi.fn(),
  parseMovimentacaoDetailed: vi.fn(),
  parsePosicao: vi.fn(),
}))
const serviceMock = vi.hoisted(() => ({
  importNegociacaoRows: vi.fn(),
  importMovimentacaoRows: vi.fn(),
  importPosicaoRows: vi.fn(),
}))
const positionsMock = vi.hoisted(() => ({
  getPortfolioSummary: vi.fn(),
}))
const fsMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}))
const xlsxMock = vi.hoisted(() => ({
  read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  utils: { sheet_to_json: vi.fn(() => [['cabecalho'], ['linha1']]) },
}))
const revalidateMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/modules/b3/parser', () => ({
  parseNegociacao: parserMock.parseNegociacao,
  parseMovimentacaoDetailed: parserMock.parseMovimentacaoDetailed,
  parsePosicao: parserMock.parsePosicao,
}))
vi.mock('@/modules/b3/service', () => ({
  importNegociacaoRows: serviceMock.importNegociacaoRows,
  importMovimentacaoRows: serviceMock.importMovimentacaoRows,
  importPosicaoRows: serviceMock.importPosicaoRows,
}))
vi.mock('@/modules/positions/service', () => ({
  getPortfolioSummary: positionsMock.getPortfolioSummary,
}))
vi.mock('node:fs/promises', () => ({
  readdir: fsMock.readdir,
  readFile: fsMock.readFile,
  appendFile: fsMock.appendFile,
  mkdir: fsMock.mkdir,
}))
vi.mock('xlsx', () => xlsxMock)
vi.mock('next/cache', () => ({ revalidatePath: revalidateMock }))

import {
  analyzeImport,
  getDebugLogs,
  updateIssuesOpen,
} from '@/app/(app)/debug/import/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'planilha.xlsx', content = 'dados') {
  return new File([content], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function negociacaoRow() {
  return {
    date: new Date('2026-04-19T00:00:00.000Z'),
    type: 'BUY' as const,
    ticker: 'VALE3',
    mercado: 'Mercado a Vista',
    instituicao: 'BTG',
    quantity: 1,
    price: 10,
    total: 10,
    referenceId: 'neg-001',
  }
}

function movimentacaoRow() {
  return {
    date: new Date('2026-04-19T00:00:00.000Z'),
    type: 'DIVIDEND' as const,
    ticker: 'ITSA4',
    instituicao: 'BTG',
    quantity: 1,
    price: null,
    total: 5,
    referenceId: 'mov-001',
    sourceMovementType: 'Dividendo',
    isIncoming: true,
    isTaxExempt: false,
    subscriptionDeadline: null,
  }
}

function posicaoRow() {
  return {
    ticker: 'HGLG11',
    name: 'CSHG LOGISTICA',
    category: 'FII' as const,
    quantity: 10,
    closePrice: 150,
    updatedValue: 1500,
    instituicao: 'BTG',
    conta: 'Conta 1',
  }
}

function dbSnapshotDefaults() {
  mockPrisma.auditLog.count.mockResolvedValue(1)
  mockPrisma.auditLog.findMany.mockResolvedValue([
    { id: 'al-1', entityType: 'IMPORT_B3_NEGOCIACAO', action: 'CREATE', changedAt: new Date('2026-04-19T13:00:00.000Z'), newValue: '{}' },
  ])
  mockPrisma.transaction.findMany.mockResolvedValue([
    {
      id: 'tx-1',
      referenceId: 'neg-001',
      type: 'BUY',
      accountId: 'acc-1',
      assetId: 'asset-1',
      totalAmount: { toString: () => '10.00' },
      date: new Date('2026-04-19T00:00:00.000Z'),
      notes: 'Importacao B3 - Negociacao (BTG)',
      createdAt: new Date('2026-04-19T13:00:00.000Z'),
    },
  ])
  mockPrisma.ledgerEntry.findMany.mockResolvedValue([
    {
      id: 'le-1',
      transactionId: 'tx-1',
      accountId: 'acc-1',
      debit: { toString: () => '10.00' },
      credit: null,
      balanceAfter: { toString: () => '-10.00' },
      createdAt: new Date('2026-04-19T13:00:00.000Z'),
    },
  ])
}

// ─── analyzeImport ────────────────────────────────────────────────────────────

describe('analyzeImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    parserMock.parseNegociacao.mockReturnValue([negociacaoRow()])
    parserMock.parseMovimentacaoDetailed.mockReturnValue({ readyRows: [movimentacaoRow()], reviewRows: [] })
    parserMock.parsePosicao.mockReturnValue([posicaoRow()])
    serviceMock.importNegociacaoRows.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    serviceMock.importMovimentacaoRows.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    serviceMock.importPosicaoRows.mockResolvedValue({ upserted: 1, skipped: 0, errors: [] })
    positionsMock.getPortfolioSummary.mockResolvedValue({
      totalCost: { toString: () => '100.00' },
      totalValue: { toString: () => '110.00' },
      totalGainLoss: { toString: () => '10.00' },
      assetCount: 2,
      topPositions: [
        { ticker: 'VALE3', name: 'Vale', totalCost: '100.00', currentValue: '110.00' },
      ],
    })
    dbSnapshotDefaults()
  })

  it('retorna ok: false quando usuario nao autenticado', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.ok).toBe(false)
    expect(res.importResult.errors[0]).toContain('Usuario nao autenticado')
  })

  it('retorna ok: false para arquivo vazio', async () => {
    const emptyFile = new File([], 'vazio.xlsx', { type: 'application/xlsx' })
    const res = await analyzeImport('negociacao', emptyFile)
    expect(res.ok).toBe(false)
    expect(res.importResult.errors[0]).toContain('Arquivo vazio')
  })

  it('processa negociacao e retorna snapshot de BD', async () => {
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.ok).toBe(true)
    expect(res.type).toBe('negociacao')
    expect(res.importResult.parsedRows).toBe(1)
    expect(res.importResult.imported).toBe(1)
    expect(res.dbSnapshot.auditLogsCount).toBe(1)
    expect(res.dbSnapshot.recentTransactions).toHaveLength(1)
    expect(res.dbSnapshot.recentLedgerEntries).toHaveLength(1)
    expect(serviceMock.importNegociacaoRows).toHaveBeenCalledWith('user-1', expect.any(Array))
  })

  it('processa movimentacao e propaga reviewRows ao servico', async () => {
    const res = await analyzeImport('movimentacao', makeFile())
    expect(res.ok).toBe(true)
    expect(res.type).toBe('movimentacao')
    expect(serviceMock.importMovimentacaoRows).toHaveBeenCalledWith(
      'user-1',
      expect.any(Array),
      expect.any(Array),
    )
  })

  it('processa posicao e retorna upserted no importResult', async () => {
    const res = await analyzeImport('posicao', makeFile())
    expect(res.ok).toBe(true)
    expect(res.type).toBe('posicao')
    expect(res.importResult.upserted).toBe(1)
    expect(res.preview.columns[0]).toBe('Ticker')
  })

  it('inclui metricas do dashboard no dbSnapshot', async () => {
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.dbSnapshot.dashboardMetrics).not.toBeNull()
    expect(res.dbSnapshot.dashboardMetrics?.assetCount).toBe(2)
    expect(res.dbSnapshot.dashboardMetrics?.topPositions[0]?.ticker).toBe('VALE3')
  })

  it('nao falha quando dashboard lanca excecao interna', async () => {
    positionsMock.getPortfolioSummary.mockRejectedValueOnce(new Error('db_timeout'))
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.ok).toBe(true)
    expect(res.dbSnapshot.dashboardMetrics).toBeNull()
  })

  it('inclui affectedAccountIds das transacoes recentes', async () => {
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.dbSnapshot.affectedAccountIds).toContain('acc-1')
  })

  it('busca LedgerEntry apenas para contas afetadas', async () => {
    await analyzeImport('negociacao', makeFile())
    expect(mockPrisma.ledgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: { in: ['acc-1'] } }),
      }),
    )
  })

  it('nao busca LedgerEntry quando nao ha transacoes recentes', async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([])
    await analyzeImport('negociacao', makeFile())
    expect(mockPrisma.ledgerEntry.findMany).not.toHaveBeenCalled()
  })

  it('logsMd contém informacoes de parsedRows e dashboard', async () => {
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.logsMd).toContain('parsedRows: 1')
    expect(res.logsMd).toContain('totalCost: 100.00')
    expect(res.logsMd).toContain('VALE3')
  })

  it('inclui erros do servico no importResult.errors', async () => {
    serviceMock.importNegociacaoRows.mockResolvedValueOnce({
      imported: 0,
      skipped: 1,
      errors: ['ticker_invalido', 'instituicao_ausente'],
    })
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.importResult.errors).toHaveLength(2)
    expect(res.importResult.errorsCount).toBe(2)
  })

  it('chama revalidatePath apos sucesso', async () => {
    await analyzeImport('negociacao', makeFile())
    expect(revalidateMock).toHaveBeenCalledWith('/debug/import')
  })

  it('retorna ok: false quando servico lanca excecao', async () => {
    serviceMock.importNegociacaoRows.mockRejectedValueOnce(new Error('db_connection_failed'))
    const res = await analyzeImport('negociacao', makeFile())
    expect(res.ok).toBe(false)
    expect(res.importResult.errors[0]).toContain('db_connection_failed')
  })
})

// ─── getDebugLogs ──────────────────────────────────────────────────────────────

describe('getDebugLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('retorna array vazio quando usuario nao autenticado', async () => {
    mockAuth.mockResolvedValueOnce(null)
    fsMock.readdir.mockResolvedValue([])
    const res = await getDebugLogs()
    expect(res).toEqual([])
  })

  it('retorna lista de logs dos arquivos .md', async () => {
    fsMock.readdir.mockResolvedValue(['issues-open.md', 'negociacao.md'])
    fsMock.readFile.mockImplementation((filePath: string) => {
      if (String(filePath).includes('issues-open')) return Promise.resolve('# Issues')
      return Promise.resolve('# Negociacao')
    })
    const res = await getDebugLogs()
    expect(res).toHaveLength(2)
    expect(res[0]?.filename).toBe('issues-open.md')
    expect(res[0]?.content).toBe('# Issues')
  })

  it('ignora arquivos que nao sao .md', async () => {
    fsMock.readdir.mockResolvedValue(['negociacao.md', 'arquivo.json', 'script.ts'])
    fsMock.readFile.mockResolvedValue('# conteudo')
    const res = await getDebugLogs()
    expect(res).toHaveLength(1)
    expect(res[0]?.filename).toBe('negociacao.md')
  })

  it('retorna array vazio quando readdir lanca excecao', async () => {
    fsMock.readdir.mockRejectedValueOnce(new Error('ENOENT'))
    const res = await getDebugLogs()
    expect(res).toEqual([])
  })

  it('marca arquivo com erro de leitura sem crashar', async () => {
    fsMock.readdir.mockResolvedValue(['corrompido.md'])
    fsMock.readFile.mockRejectedValueOnce(new Error('EACCES'))
    const res = await getDebugLogs()
    expect(res).toHaveLength(1)
    expect(res[0]?.content).toBe('(erro ao ler arquivo)')
  })
})

// ─── updateIssuesOpen ─────────────────────────────────────────────────────────

describe('updateIssuesOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.appendFile.mockResolvedValue(undefined)
  })

  it('retorna erro quando usuario nao autenticado', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const res = await updateIssuesOpen(['issue de teste'])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Usuario nao autenticado')
  })

  it('retorna erro quando lista de issues esta vazia', async () => {
    const res = await updateIssuesOpen([])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Nenhum issue fornecido')
  })

  it('faz append dos issues no arquivo com timestamp', async () => {
    const res = await updateIssuesOpen(['importacao falhou', 'ledger inconsistente'])
    expect(res.ok).toBe(true)
    expect(res.appended).toBe(2)
    expect(fsMock.appendFile).toHaveBeenCalledOnce()
    const appendedContent = String((fsMock.appendFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] ?? '')
    expect(appendedContent).toContain('importacao falhou')
    expect(appendedContent).toContain('ledger inconsistente')
  })

  it('filtra issues com string vazia', async () => {
    const res = await updateIssuesOpen(['  ', 'issue valido', ''])
    expect(res.ok).toBe(true)
    expect(res.appended).toBe(1)
  })

  it('rejeita issues com mais de 500 caracteres', async () => {
    const longa = 'x'.repeat(501)
    const res = await updateIssuesOpen([longa, 'issue curto'])
    expect(res.ok).toBe(true)
    expect(res.appended).toBe(1)
  })

  it('retorna erro quando todos os issues sao invalidos', async () => {
    const res = await updateIssuesOpen(['   ', 'x'.repeat(600)])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('invalidos')
  })

  it('retorna erro quando appendFile lanca excecao', async () => {
    fsMock.appendFile.mockRejectedValueOnce(new Error('ENOSPC'))
    const res = await updateIssuesOpen(['issue de escrita'])
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ENOSPC')
  })

  it('chama revalidatePath apos sucesso', async () => {
    await updateIssuesOpen(['issue revalidation'])
    expect(revalidateMock).toHaveBeenCalledWith('/debug/import')
  })
})
