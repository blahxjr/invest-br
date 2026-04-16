import { parsePosicaoForReview, parsePosicaoRow } from '@/modules/b3/parser'

describe('parsePosicaoRow', () => {
  it('parseia acao corretamente', () => {
    const row = [
      'AGRO3 - BRASILAGRO',
      'BANCO BTG PACTUAL S/A',
      '8098284',
      'AGRO3',
      '...',
      '...',
      'ON',
      '...',
      '2',
      '2',
      '-',
      '-',
      '20.43',
      '40.86',
    ]

    const result = parsePosicaoRow(row, 'Acoes')

    expect(result).not.toBeNull()
    expect(result?.ticker).toBe('AGRO3')
    expect(result?.category).toBe('STOCK')
    expect(result?.quantity).toBe(2)
  })

  it('parseia FII corretamente', () => {
    const row = [
      'CPTS11 - CAPITANIA',
      'BTG',
      '8098284',
      'CPTS11',
      '...',
      '...',
      'Cotas',
      '...',
      '43',
      '43',
      '-',
      '-',
      '8.12',
      '349.16',
    ]

    const result = parsePosicaoRow(row, 'Fundo de Investimento')

    expect(result).not.toBeNull()
    expect(result?.ticker).toBe('CPTS11')
    expect(result?.category).toBe('FII')
  })

  it('preserva linhas para revisão com status e dados originais/normalizados', () => {
    const sheets = [
      {
        name: 'Acoes',
        rows: [
          ['Produto', 'Instituição', 'Conta', 'Código de Negociação', '', '', 'Tipo', '', 'Quantidade', '', '', '', 'Preço de fechamento', 'Valor atualizado'],
          ['PETR4 - PETROBRAS', 'BTG', '1234', 'PETR4', '', '', 'ON', '', '10', '', '', '', '40', '400'],
          ['SEM TICKER', 'BTG', '1234', '', '', '', 'ON', '', '10', '', '', '', '40', '400'],
        ],
      },
    ]

    const lines = parsePosicaoForReview(sheets)

    expect(lines).toHaveLength(2)
    expect(lines[0]?.status).toBe('OK')
    expect(lines[0]?.normalized.ticker).toBe('PETR4')
    expect(lines[1]?.status).toBe('IGNORAR')
    expect(lines[1]?.reason).toBe('ticker_ausente')
  })
})
