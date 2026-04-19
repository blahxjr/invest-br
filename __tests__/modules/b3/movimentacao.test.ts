import { parseMovimentacaoDetailed, parseMovimentacaoForReview, parseMovimentacaoRow, resolveAssetClass } from '@/modules/b3/parser'

describe('parseMovimentacaoRow', () => {
  it('classifica rendimento como DIVIDEND', () => {
    const row = [
      'Credito',
      '09/04/2026',
      'Rendimento',
      'GGRC11 - GGR COVEPI RENDA',
      'BTG',
      '25.0',
      '0.1',
      '2.5',
    ]

    const result = parseMovimentacaoRow(row)

    expect(result?.type).toBe('DIVIDEND')
    expect(result?.ticker).toBe('GGRC11')
    expect(result?.isIncoming).toBe(true)
    expect(result?.isTaxExempt).toBe(true)
  })

  it('classifica cessao de direitos como RIGHTS_TRANSFER', () => {
    const row = [
      'Credito',
      '27/03/2026',
      'Cessão de Direitos',
      'SNAG12 - SUNO AGRO',
      'NU',
      '40.0',
      '-',
      '-',
    ]

    const result = parseMovimentacaoRow(row)

    expect(result?.type).toBe('RIGHTS_TRANSFER')
    expect(result?.sourceMovementType).toBe('Cessão de Direitos')
  })

  it('classifica atualizacao como CORPORATE_UPDATE', () => {
    const row = [
      'Credito',
      '06/04/2026',
      'Atualização',
      'BPAC11 - BANCO BTG PACTUAL S/A',
      'BTG',
      '1.0',
      '-',
      '-',
    ]

    const result = parseMovimentacaoRow(row)

    expect(result?.type).toBe('CORPORATE_UPDATE')
    expect(result?.total).toBeNull()
  })

  it('preserva linha desconhecida como REVISAR no parser detalhado', () => {
    const rows = [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '06/04/2026', 'Evento Misterioso', 'BPAC11 - BANCO BTG PACTUAL S/A', 'BTG', '1.0', '-', '-'],
    ]

    const result = parseMovimentacaoDetailed(rows)

    expect(result.readyRows).toHaveLength(0)
    expect(result.reviewRows).toHaveLength(1)
    expect(result.reviewRows[0]?.reason).toBe('tipo_movimentacao_desconhecido')
  })

  it('classifica eventos corporativos suportados como linhas importaveis', () => {
    const rows = [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '06/04/2026', 'Direitos de Subscrição', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
      ['Credito', '06/04/2026', 'Cessão de Direitos', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
      ['Credito', '06/04/2026', 'Atualização', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
      ['Credito', '06/04/2026', 'Fração em Ativos', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
      ['Credito', '06/04/2026', 'Resgate', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
      ['Credito', '06/04/2026', 'Leilão', 'PETR4 - PETROBRAS', 'BTG', '10', '-', '-'],
    ]

    const parsed = parseMovimentacaoForReview(rows)

    expect(parsed).toHaveLength(6)
    expect(parsed.every((line) => line.status === 'OK')).toBe(true)
    expect(parsed.every((line) => line.classification === 'EVENTO_CORPORATIVO' || line.classification === 'LIQUIDACAO')).toBe(true)
    expect(parsed.map((line) => line.normalized.type)).toEqual([
      'SUBSCRIPTION_RIGHT',
      'RIGHTS_TRANSFER',
      'CORPORATE_UPDATE',
      'FRACTIONAL_DEBIT',
      'MATURITY',
      'FRACTIONAL_AUCTION',
    ])
  })

  it('usa entrada e saida apenas para desempatar liquidacao entre compra e venda', () => {
    const compra = parseMovimentacaoRow([
      'Debito',
      '09/04/2026',
      'Transferência - Liquidação',
      'MXRF11 - MAXI RENDA',
      'BTG',
      '10',
      '10',
      '100',
    ])

    const venda = parseMovimentacaoRow([
      'Credito',
      '10/04/2026',
      'Transferência - Liquidação',
      'MXRF11 - MAXI RENDA',
      'BTG',
      '5',
      '11',
      '55',
    ])

    expect(compra?.type).toBe('BUY')
    expect(compra?.isIncoming).toBe(false)
    expect(venda?.type).toBe('SELL')
    expect(venda?.isIncoming).toBe(true)
  })

  it('classifica compra e venda de renda fixa com semantica contabil correta', () => {
    const compraRendaFixa = parseMovimentacaoRow([
      'Debito',
      '10/04/2026',
      'Compra / Venda',
      'CDB - CDB124661K5 - BANCO C6 CONSIGNADO S.A',
      'NU',
      '1000',
      '1',
      '1000',
    ])

    const resgateRendaFixa = parseMovimentacaoRow([
      'Credito',
      '11/04/2026',
      'Compra / Venda',
      'LCA - 24I02490726 - BANCO ABC-BRASIL S.A.',
      'NU',
      '1000',
      '1.05',
      '1050',
    ])

    expect(compraRendaFixa?.type).toBe('BUY')
    expect(compraRendaFixa?.isIncoming).toBe(false)
    expect(compraRendaFixa?.isTaxExempt).toBe(false)

    expect(resgateRendaFixa?.type).toBe('MATURITY')
    expect(resgateRendaFixa?.isIncoming).toBe(true)
    expect(resgateRendaFixa?.isTaxExempt).toBe(true)
  })

  it('classifica COMPRA de Tesouro Direto como BUY sem ambiguidade', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '10/04/2026',
      'Compra',
      'Tesouro Prefixado com Juros Semestrais 2031',
      'NU',
      '1',
      '1000',
      '1000',
    ])

    expect(result?.type).toBe('BUY')
    expect(result?.isIncoming).toBe(false)
    expect(result?.isTaxExempt).toBe(false)
  })

  it('classifica COMPRA de CDB como BUY sem ambiguidade', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '10/04/2026',
      'Compra',
      'CDB - CDB124661K5 - BANCO C6 CONSIGNADO S.A',
      'NU',
      '1000',
      '1',
      '1000',
    ])

    expect(result?.type).toBe('BUY')
    expect(result?.isIncoming).toBe(false)
    expect(result?.isTaxExempt).toBe(false)
  })

  it('classifica COMPRA de FII como BUY sem ambiguidade', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '10/04/2026',
      'Compra',
      'MXRF11 - MAXI RENDA FDO INV IMOB - FII',
      'BTG',
      '10',
      '10',
      '100',
    ])

    expect(result?.type).toBe('BUY')
    expect(result?.isIncoming).toBe(false)
    expect(result?.isTaxExempt).toBe(false)
  })

  it('classifica COMPRA de acao como BUY sem ambiguidade', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '10/04/2026',
      'Compra',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '30',
      '300',
    ])

    expect(result?.type).toBe('BUY')
    expect(result?.isIncoming).toBe(false)
    expect(result?.isTaxExempt).toBe(false)
  })

  it('classifica aplicacao e resgate antecipado de renda fixa como liquidacao', () => {
    const aplicacao = parseMovimentacaoRow([
      'Debito',
      '10/04/2026',
      'APLICACAO',
      'CDB - CDBB246LJLE - BANCO BTG PACTUAL S.A.',
      'BTG',
      '1000',
      '1',
      '1000',
    ])

    const resgateAntecipado = parseMovimentacaoRow([
      'Credito',
      '11/04/2026',
      'RESGATE ANTECIPADO',
      'LCA - 24I02490726 - BANCO ABC-BRASIL S.A.',
      'NU',
      '1000',
      '1.02',
      '1020',
    ])

    expect(aplicacao?.type).toBe('BUY')
    expect(aplicacao?.isIncoming).toBe(false)
    expect(aplicacao?.isTaxExempt).toBe(false)

    expect(resgateAntecipado?.type).toBe('MATURITY')
    expect(resgateAntecipado?.isIncoming).toBe(true)
    expect(resgateAntecipado?.isTaxExempt).toBe(true)
  })

  it('classifica vencimento de renda fixa mantendo isIncoming true e isTaxExempt por ativo', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '12/04/2026',
      'Vencimento',
      'LCI - 123456 - BANCO EXEMPLO S.A.',
      'BTG',
      '1000',
      '1.1',
      '1100',
    ])

    expect(result?.type).toBe('MATURITY')
    expect(result?.isIncoming).toBe(true)
    expect(result?.isTaxExempt).toBe(true)
  })

  it('classifica atualizacao sem acento como CORPORATE_UPDATE', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Atualizacao',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('CORPORATE_UPDATE')
  })

  it('classifica juros como DIVIDEND sem isencao tributaria', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Juros',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '0.1',
      '1',
    ])

    expect(result?.type).toBe('DIVIDEND')
    expect(result?.isIncoming).toBe(true)
    expect(result?.isTaxExempt).toBe(false)
  })

  it('classifica transferencia generica como CUSTODY_TRANSFER', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Transferência',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('CUSTODY_TRANSFER')
    expect(result?.isIncoming).toBe(true)
  })

  it('classifica bonificacao em ativos como BONUS_SHARES', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Bonificação em Ativos',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('BONUS_SHARES')
  })

  it('classifica desdobro como SPLIT', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Desdobro',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('SPLIT')
  })

  it('classifica fracao em ativos como FRACTIONAL_DEBIT', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Fração em Ativos',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('FRACTIONAL_DEBIT')
    expect(result?.isIncoming).toBe(false)
  })

  it('classifica leilao de fracao como FRACTIONAL_AUCTION', () => {
    const result = parseMovimentacaoRow([
      'Credito',
      '06/04/2026',
      'Leilão de Fração',
      'PETR4 - PETROBRAS',
      'BTG',
      '10',
      '-',
      '-',
    ])

    expect(result?.type).toBe('FRACTIONAL_AUCTION')
    expect(result?.isIncoming).toBe(true)
  })
})

describe('resolveAssetClass', () => {
  it('resolve Tesouro Direto como RENDA_FIXA', () => {
    expect(resolveAssetClass('Tesouro Prefixado com Juros Semestrais 2031')).toBe('RENDA_FIXA')
  })

  it('resolve CDB como RENDA_FIXA', () => {
    expect(resolveAssetClass('CDB - CDB124661K5 - BANCO C6 CONSIGNADO S.A')).toBe('RENDA_FIXA')
  })

  it('resolve ticker terminado em 11 como FII', () => {
    expect(resolveAssetClass('MXRF11 - MAXI RENDA FDO INV IMOB - FII', 'MXRF11')).toBe('FII')
  })

  it('resolve ticker terminado em 3,4,5,6 como ACAO', () => {
    expect(resolveAssetClass('PETR4 - PETROBRAS', 'PETR4')).toBe('ACAO')
  })
})
