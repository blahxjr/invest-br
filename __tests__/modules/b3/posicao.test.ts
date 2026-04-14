import { parsePosicaoRow } from '@/modules/b3/parser'

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
})
