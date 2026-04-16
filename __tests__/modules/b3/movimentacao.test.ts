import { parseMovimentacaoDetailed, parseMovimentacaoForReview, parseMovimentacaoRow } from '@/modules/b3/parser'

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
  })

  it('ignora cessao de direitos', () => {
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

    expect(result).toBeNull()
  })

  it('ignora atualizacao', () => {
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

    expect(result).toBeNull()
  })

  it('preserva linha nao suportada como REVISAR no parser detalhado', () => {
    const rows = [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '06/04/2026', 'Atualização', 'BPAC11 - BANCO BTG PACTUAL S/A', 'BTG', '1.0', '-', '-'],
    ]

    const result = parseMovimentacaoDetailed(rows)

    expect(result.readyRows).toHaveLength(0)
    expect(result.reviewRows).toHaveLength(1)
    expect(result.reviewRows[0]?.reason).toBe('evento_corporativo_requer_revisao')
  })

  it('classifica eventos corporativos relevantes como EVENTO_CORPORATIVO em REVISAR', () => {
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
    expect(parsed.every((line) => line.status === 'REVISAR')).toBe(true)
    expect(parsed.every((line) => line.classification === 'EVENTO_CORPORATIVO')).toBe(true)
  })
})
