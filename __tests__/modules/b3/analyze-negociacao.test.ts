import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { analyzeNegociacaoRows, inferAssetCategory } from '@/modules/b3/service'

describe('inferAssetCategory', () => {
  it('retorna FII para FII', () => {
    expect(inferAssetCategory('FII')).toBe('FII')
  })

  it('retorna ETF para ETF', () => {
    expect(inferAssetCategory('ETF')).toBe('ETF')
  })

  it('retorna STOCK para ACAO', () => {
    expect(inferAssetCategory('ACAO')).toBe('STOCK')
  })

  it('retorna FIXED_INCOME para RENDA_FIXA', () => {
    expect(inferAssetCategory('RENDA_FIXA')).toBe('FIXED_INCOME')
  })

  it('retorna null quando classe e nula', () => {
    expect(inferAssetCategory(null)).toBeNull()
  })
})

describe('analyzeNegociacaoRows metadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna missingClasses quando AssetClass ETF nao existe no banco', async () => {
    vi.spyOn(prisma.assetClass, 'findMany').mockResolvedValue([
      { id: 'class-fii', name: 'Fundos Imobiliários', code: 'FII' },
      { id: 'class-acoes', name: 'Acoes', code: 'ACOES' },
    ] as never)

    vi.spyOn(prisma.asset, 'findMany')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)

    const result = await analyzeNegociacaoRows([
      {
        date: new Date('2026-04-13T00:00:00.000Z'),
        type: 'BUY',
        ticker: 'DIVO11',
        mercado: 'Mercado a Vista',
        instituicao: 'BTG',
        quantity: 1,
        price: 100,
        total: 100,
        referenceId: 'r1',
      },
    ])

    expect(result.missingClasses).toHaveLength(1)
    expect(result.missingClasses[0]?.inferredCode).toBe('ETF')
    expect(result.missingClasses[0]?.affectedTickers).toEqual(['DIVO11'])
  })

  it('retorna availableClasses e existingAssets para o combobox de associação', async () => {
    vi.spyOn(prisma.assetClass, 'findMany').mockResolvedValue([
      { id: 'class-fii', name: 'Fundos Imobiliários', code: 'FII' },
    ] as never)

    vi.spyOn(prisma.asset, 'findMany')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'asset-1',
          ticker: 'HGLG11',
          name: 'CSHG Logistica',
          assetClass: { name: 'Fundos Imobiliários' },
        },
      ] as never)

    const result = await analyzeNegociacaoRows([
      {
        date: new Date('2026-04-13T00:00:00.000Z'),
        type: 'BUY',
        ticker: 'BRCO11',
        mercado: 'Mercado a Vista',
        instituicao: 'BTG',
        quantity: 1,
        price: 100,
        total: 100,
        referenceId: 'r2',
      },
    ])

    expect(result.availableClasses).toEqual([
      { id: 'class-fii', name: 'Fundos Imobiliários', code: 'FII' },
    ])
    expect(result.existingAssets).toEqual([
      {
        id: 'asset-1',
        ticker: 'HGLG11',
        name: 'CSHG Logistica',
        className: 'Fundos Imobiliários',
      },
    ])
  })
})
