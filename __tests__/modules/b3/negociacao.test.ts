import { inferAssetClass, parseNegociacaoRow } from '@/modules/b3/parser'

describe('parseNegociacaoRow', () => {
  it('parseia compra em mercado a vista', () => {
    const row = [
      '31/03/2026',
      'Compra',
      'Mercado à Vista',
      '-',
      'BANCO BTG PACTUAL S/A',
      'HGLG11',
      '2',
      '156.04',
      '312.08',
    ]

    const result = parseNegociacaoRow(row)

    expect(result).not.toBeNull()
    expect(result?.ticker).toBe('HGLG11')
    expect(result?.type).toBe('BUY')
    expect(result?.quantity).toBe(2)
    expect(result?.price).toBe(156.04)
  })

  it('remove sufixo F de ticker fracionario', () => {
    const row = [
      '25/09/2025',
      'Compra',
      'Mercado Fracionário',
      '-',
      'BANCO BTG PACTUAL S/A',
      'AGRO3F',
      '2',
      '20.36',
      '40.72',
    ]

    const result = parseNegociacaoRow(row)

    expect(result).not.toBeNull()
    expect(result?.ticker).toBe('AGRO3')
  })
})

describe('inferAssetClass', () => {
  it('classifica BRCO11 como FII', () => {
    expect(inferAssetClass('BRCO11')).toBe('FII')
  })

  it('classifica IMAB11 como ETF', () => {
    expect(inferAssetClass('IMAB11')).toBe('ETF')
  })

  it('classifica B3SA3F como ACAO', () => {
    expect(inferAssetClass('B3SA3F')).toBe('ACAO')
  })

  it('classifica TAEE11F como FII', () => {
    expect(inferAssetClass('TAEE11F')).toBe('FII')
  })

  it('retorna null para BEEF1', () => {
    expect(inferAssetClass('BEEF1')).toBeNull()
  })
})
