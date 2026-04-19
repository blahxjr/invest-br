// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const parserMock = vi.hoisted(() => ({
  parseNegociacao: vi.fn(),
  parseMovimentacao: vi.fn(),
  parsePosicao: vi.fn(),
}))
const serviceMock = vi.hoisted(() => ({
  importNegociacaoRows: vi.fn(),
  importMovimentacaoRows: vi.fn(),
  importPosicaoRows: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/modules/b3/parser', () => ({
  parseNegociacao: parserMock.parseNegociacao,
  parseMovimentacao: parserMock.parseMovimentacao,
  parsePosicao: parserMock.parsePosicao,
}))
vi.mock('@/modules/b3/service', () => ({
  importNegociacaoRows: serviceMock.importNegociacaoRows,
  importMovimentacaoRows: serviceMock.importMovimentacaoRows,
  importPosicaoRows: serviceMock.importPosicaoRows,
}))
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Negociação'], Sheets: { Negociação: {} } })),
  utils: {
    sheet_to_json: vi.fn(() => [['cabecalho'], ['linha1']]),
  },
}))

import {
  importMovimentacaoDebug,
  importNegociacaoDebug,
  importPosicaoDebug,
} from '@/app/(app)/debug/import/actions'

function buildFormDataWithFile() {
  const formData = new FormData()
  const file = new File(['conteudo'], 'planilha.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  formData.set('file', file)
  return formData
}

describe('debug/import actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    parserMock.parseNegociacao.mockReturnValue([
      {
        date: new Date('2026-04-19T00:00:00.000Z'),
        type: 'BUY',
        ticker: 'VALE3',
        mercado: 'Mercado a Vista',
        instituicao: 'BTG',
        quantity: 1,
        price: 10,
        total: 10,
        referenceId: 'neg-1',
      },
    ])

    parserMock.parseMovimentacao.mockReturnValue({
      readyRows: [
        {
          date: new Date('2026-04-19T00:00:00.000Z'),
          type: 'DIVIDEND',
          ticker: 'ITSA4',
          instituicao: 'BTG',
          quantity: 1,
          price: null,
          total: 5,
          referenceId: 'mov-1',
          sourceMovementType: 'Dividendo',
          isIncoming: true,
          isTaxExempt: false,
          subscriptionDeadline: null,
        },
      ],
      reviewRows: [],
    })

    parserMock.parsePosicao.mockReturnValue([
      {
        ticker: 'HGLG11',
        name: 'CSHG LOGISTICA',
        category: 'FII',
        quantity: 10,
        closePrice: 150,
        updatedValue: 1500,
        instituicao: 'BTG',
        conta: 'Conta 1',
      },
    ])

    serviceMock.importNegociacaoRows.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    serviceMock.importMovimentacaoRows.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    serviceMock.importPosicaoRows.mockResolvedValue({ upserted: 1, skipped: 0, errors: [] })
  })

  it('retorna erro quando usuário não autenticado em negociação', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const response = await importNegociacaoDebug(buildFormDataWithFile())

    expect(response.ok).toBe(false)
    expect(response.errors[0]).toContain('Usuario nao autenticado')
  })

  it('processa negociação com preview e resumo', async () => {
    const response = await importNegociacaoDebug(buildFormDataWithFile())

    expect(response.ok).toBe(true)
    expect(response.step).toBe('NEGOCIACAO')
    expect(response.summary.parsedRows).toBe(1)
    expect(response.preview.rows).toHaveLength(1)
    expect(serviceMock.importNegociacaoRows).toHaveBeenCalledTimes(1)
  })

  it('processa movimentação e propaga reviewRows para serviço', async () => {
    const response = await importMovimentacaoDebug(buildFormDataWithFile())

    expect(response.ok).toBe(true)
    expect(response.step).toBe('MOVIMENTACAO')
    expect(serviceMock.importMovimentacaoRows).toHaveBeenCalledWith(
      'user-1',
      expect.any(Array),
      expect.any(Array),
    )
  })

  it('processa posição com upsert no resumo', async () => {
    const response = await importPosicaoDebug(buildFormDataWithFile())

    expect(response.ok).toBe(true)
    expect(response.step).toBe('POSICAO')
    expect(response.summary.upserted).toBe(1)
    expect(response.preview.columns).toContain('Ticker')
  })

  it('retorna erro quando arquivo não é enviado', async () => {
    const formData = new FormData()
    const response = await importMovimentacaoDebug(formData)

    expect(response.ok).toBe(false)
    expect(response.errors[0]).toContain('Arquivo nao enviado')
  })

  it('retorna erro quando serviço lança exceção', async () => {
    serviceMock.importPosicaoRows.mockRejectedValueOnce(new Error('falha_import'))

    const response = await importPosicaoDebug(buildFormDataWithFile())

    expect(response.ok).toBe(false)
    expect(response.errors[0]).toContain('falha_import')
  })
})
