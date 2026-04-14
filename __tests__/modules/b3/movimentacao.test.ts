import { parseMovimentacaoRow } from '@/modules/b3/parser'

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
})
