import { describe, it, expect } from 'vitest'
import { parsePosicaoRow, parsePosicaoForReview } from '@/modules/b3/parser'
import { deriveTesouroDiretoTicker } from '@/modules/b3/parser/posicao'

// ---------------------------------------------------------------------------
// 1. Ações
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — Ações', () => {
  const row = [
    'AGRO3 - BRASILAGRO - CIA BRAS DE PROP AGRICOLAS',
    'BANCO BTG PACTUAL S/A',
    '8098284',
    'AGRO3',
    '07628528000159',
    'BRAGROACNOR7 - 116',
    'ON',
    'ITAU CV S/A',
    '2',
    '2',
    '-',
    '-',
    ' R$20,13 ',
    ' R$40,26 ',
  ]

  it('parseia ticker corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.ticker).toBe('AGRO3')
  })

  it('parseia category como STOCK', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.category).toBe('STOCK')
  })

  it('parseia quantity corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.quantity).toBe(2)
  })

  it('parseia closePrice corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.closePrice).toBe(20.13)
  })

  it('parseia updatedValue corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.updatedValue).toBe(40.26)
  })

  it('parseia instituicao corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.instituicao).toBe('BANCO BTG PACTUAL S/A')
  })

  it('parseia conta corretamente', () => {
    const result = parsePosicaoRow(row, 'Acoes')
    expect(result?.conta).toBe('8098284')
  })
})

// ---------------------------------------------------------------------------
// 2. BDR
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — BDR', () => {
  const row = [
    'ROXO34 - NU HOLDINGS LTD.',
    'NU INVESTIMENTOS S.A. - CTVM',
    '4372755',
    'ROXO34',
    'BRROXOBDR007 - 100',
    'BDR',
    'BANCO BRADESCO S/A',
    '72',
    '72',
    '-',
    '-',
    ' R$12,95 ',
    ' R$932,40 ',
  ]

  it('parseia ticker como ROXO34', () => {
    const result = parsePosicaoRow(row, 'BDR')
    expect(result?.ticker).toBe('ROXO34')
  })

  it('parseia category como BDR', () => {
    const result = parsePosicaoRow(row, 'BDR')
    expect(result?.category).toBe('BDR')
  })

  it('parseia quantity como 72', () => {
    const result = parsePosicaoRow(row, 'BDR')
    expect(result?.quantity).toBe(72)
  })

  it('parseia closePrice como 12.95', () => {
    const result = parsePosicaoRow(row, 'BDR')
    expect(result?.closePrice).toBe(12.95)
  })

  it('parseia updatedValue como 932.40', () => {
    const result = parsePosicaoRow(row, 'BDR')
    expect(result?.updatedValue).toBe(932.4)
  })
})

// ---------------------------------------------------------------------------
// 3. ETF
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — ETF', () => {
  const row = [
    'DEBB11 - BTG PACTUAL TEVA DEBÊNTURES DI FUNDO DE ÍNDICE',
    'BANCO BTG PACTUAL S/A',
    '8098284',
    'DEBB11',
    '45064129000100',
    'BRDEBBCTF000 - 100',
    'Renda Fixa',
    '7',
    '7',
    '-',
    '-',
    ' R$16,05 ',
    ' R$112,35 ',
  ]

  it('parseia ticker como DEBB11', () => {
    const result = parsePosicaoRow(row, 'ETF')
    expect(result?.ticker).toBe('DEBB11')
  })

  it('parseia category como ETF', () => {
    const result = parsePosicaoRow(row, 'ETF')
    expect(result?.category).toBe('ETF')
  })

  it('parseia quantity como 7', () => {
    const result = parsePosicaoRow(row, 'ETF')
    expect(result?.quantity).toBe(7)
  })

  it('parseia closePrice como 16.05', () => {
    const result = parsePosicaoRow(row, 'ETF')
    expect(result?.closePrice).toBe(16.05)
  })

  it('parseia updatedValue como 112.35', () => {
    const result = parsePosicaoRow(row, 'ETF')
    expect(result?.updatedValue).toBe(112.35)
  })
})

// ---------------------------------------------------------------------------
// 4. Fundo de Investimento (FII)
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — Fundo de Investimento', () => {
  const row = [
    'BCIA11 - BRADESCO CARTEIRA IMOBILIÁRIA ATIVA - FII',
    'NU INVESTIMENTOS S.A. - CTVM',
    '4372755',
    'BCIA11',
    '20216935000117',
    'BRBCIACTF005 - 232',
    'Cotas',
    'BANCO BRADESCO S/A',
    '4',
    '4',
    '-',
    '-',
    ' R$95,00 ',
    ' R$380,00 ',
  ]

  it('parseia ticker como BCIA11', () => {
    const result = parsePosicaoRow(row, 'Fundo de Investimento')
    expect(result?.ticker).toBe('BCIA11')
  })

  it('parseia category como FII', () => {
    const result = parsePosicaoRow(row, 'Fundo de Investimento')
    expect(result?.category).toBe('FII')
  })

  it('parseia quantity como 4', () => {
    const result = parsePosicaoRow(row, 'Fundo de Investimento')
    expect(result?.quantity).toBe(4)
  })

  it('parseia updatedValue como 380.00', () => {
    const result = parsePosicaoRow(row, 'Fundo de Investimento')
    expect(result?.updatedValue).toBe(380)
  })
})

// ---------------------------------------------------------------------------
// 5. Renda Fixa
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — Renda Fixa', () => {
  const row = [
    'CDB - BANCO BTG PACTUAL S.A.',
    'BANCO BTG PACTUAL S.A.',
    'BANCO BTG PACTUAL S.A.',
    'CDB2261M8JC',
    'IPCA',
    'DEPOSITADO',
    '03/02/2026',
    '03/02/2027',
    '2',
    '2',
    '-',
    '-',
    '-',
    ' - ',
    ' - ',
    ' R$508,798673 ',
    ' R$1.017,59 ',
    ' - ',
    ' - ',
  ]

  it('parseia ticker como CDB2261M8JC', () => {
    const result = parsePosicaoRow(row, 'Renda Fixa')
    expect(result?.ticker).toBe('CDB2261M8JC')
  })

  it('parseia category como FIXED_INCOME', () => {
    const result = parsePosicaoRow(row, 'Renda Fixa')
    expect(result?.category).toBe('FIXED_INCOME')
  })

  it('parseia quantity como 2', () => {
    const result = parsePosicaoRow(row, 'Renda Fixa')
    expect(result?.quantity).toBe(2)
  })

  it('parseia updatedValue com base no valor de curva (R$1.017,59)', () => {
    const result = parsePosicaoRow(row, 'Renda Fixa')
    expect(result?.updatedValue).toBe(1017.59)
  })
})

// ---------------------------------------------------------------------------
// 6. Tesouro Direto
// ---------------------------------------------------------------------------
describe('parsePosicaoRow — Tesouro Direto', () => {
  const row = [
    'Tesouro Prefixado com Juros Semestrais 2031',
    'NU INVESTIMENTOS S.A. - CTVM',
    'BRSTNCNTF204',
    'prefixado',
    '01/01/2031',
    '0,08',
    '0,08',
    '0',
    '-',
    ' R$84,49 ',
    ' R$73,38 ',
    ' R$73,34 ',
    ' R$73,38 ',
  ]

  it('parseia category como FIXED_INCOME', () => {
    const result = parsePosicaoRow(row, 'Tesouro Direto')
    expect(result?.category).toBe('FIXED_INCOME')
  })

  it('parseia quantity como 0.08', () => {
    const result = parsePosicaoRow(row, 'Tesouro Direto')
    expect(result?.quantity).toBe(0.08)
  })

  it('parseia updatedValue como 73.38', () => {
    const result = parsePosicaoRow(row, 'Tesouro Direto')
    expect(result?.updatedValue).toBe(73.38)
  })

  it('gera ticker não vazio para o produto', () => {
    const result = parsePosicaoRow(row, 'Tesouro Direto')
    expect(result?.ticker).toBeTruthy()
    expect(typeof result?.ticker).toBe('string')
    expect(result!.ticker.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 7. deriveTesouroDiretoTicker
// ---------------------------------------------------------------------------
describe('deriveTesouroDiretoTicker', () => {
  it('Tesouro Selic 2029 → TESOURO_SELIC_2029', () => {
    expect(deriveTesouroDiretoTicker('Tesouro Selic 2029')).toBe('TESOURO_SELIC_2029')
  })

  it('Tesouro Prefixado com Juros Semestrais 2031 → TNFS2031', () => {
    expect(deriveTesouroDiretoTicker('Tesouro Prefixado com Juros Semestrais 2031')).toBe('TNFS2031')
  })

  it('Tesouro Prefixado 2026 → TNLF2026', () => {
    expect(deriveTesouroDiretoTicker('Tesouro Prefixado 2026')).toBe('TNLF2026')
  })

  it('Tesouro IPCA+ com Juros Semestrais 2035 → NTNB2035', () => {
    expect(deriveTesouroDiretoTicker('Tesouro IPCA+ com Juros Semestrais 2035')).toBe('NTNB2035')
  })

  it('Tesouro IPCA+ 2045 → NTNB_PRINC2045', () => {
    expect(deriveTesouroDiretoTicker('Tesouro IPCA+ 2045')).toBe('NTNB_PRINC2045')
  })
})

// ---------------------------------------------------------------------------
// 8. Linha de cabeçalho deve ser ignorada
// ---------------------------------------------------------------------------
describe('parsePosicaoForReview — cabeçalho ignorado', () => {
  it('ignora linha com "Produto" na col[0]', () => {
    const sheets = [
      {
        name: 'Acoes',
        rows: [
          ['Produto', 'Instituição', 'Conta', 'Código de Negociação', '', '', 'Tipo', '', 'Quantidade', '', '', '', 'Preço de fechamento', 'Valor atualizado'],
          ['PETR4 - PETROBRAS', 'BTG', '1234', 'PETR4', '', '', 'ON', '', '10', '', '', '', '40', '400'],
        ],
      },
    ]

    const lines = parsePosicaoForReview(sheets)
    // Apenas 1 linha de dados, o cabeçalho não é retornado
    expect(lines).toHaveLength(1)
    expect(lines[0]?.normalized.ticker).toBe('PETR4')
  })
})

// ---------------------------------------------------------------------------
// 9. parsePosicaoForReview com múltiplas sheets
// ---------------------------------------------------------------------------
describe('parsePosicaoForReview — múltiplas sheets', () => {
  it('processa ações e BDR retornando resultados de ambas', () => {
    const sheets = [
      {
        name: 'Acoes',
        rows: [
          ['PETR4 - PETROBRAS', 'BTG', '1234', 'PETR4', '', '', 'ON', '', '10', '', '', '', '40', '400'],
        ],
      },
      {
        name: 'BDR',
        rows: [
          ['ROXO34 - NU HOLDINGS LTD.', 'NU INVEST', '4372755', 'ROXO34', 'BRROXOBDR007', 'BDR', 'BANCO BRADESCO S/A', '72', '72', '-', '-', '12.95', '932.40'],
        ],
      },
    ]

    const lines = parsePosicaoForReview(sheets)
    expect(lines).toHaveLength(2)

    const tickers = lines.map((l) => l.normalized.ticker)
    expect(tickers).toContain('PETR4')
    expect(tickers).toContain('ROXO34')
  })
})

// ---------------------------------------------------------------------------
// 10. Ticker vazio deve gerar status IGNORAR
// ---------------------------------------------------------------------------
describe('parsePosicaoForReview — ticker vazio → IGNORAR', () => {
  it('retorna status IGNORAR quando ticker está vazio', () => {
    const sheets = [
      {
        name: 'Acoes',
        rows: [
          ['SEM TICKER - NOME', 'BTG', '1234', '', '', '', 'ON', '', '10', '', '', '', '40', '400'],
        ],
      },
    ]

    const lines = parsePosicaoForReview(sheets)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.status).toBe('IGNORAR')
    expect(lines[0]?.reason).toBe('ticker_ausente')
  })
})
