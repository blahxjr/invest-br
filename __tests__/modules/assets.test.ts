import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import {
  createAssetClass,
  createAsset,
  getAssetByTicker,
  getAssetsByClass,
  getAllAssetClasses,
} from '../../src/modules/assets/service'

let assetClassId: string

beforeAll(async () => {
  // Limpa dados de testes anteriores se existirem
  await prisma.asset.deleteMany({ where: { ticker: { in: ['TEST_STOCK1', 'TEST_STOCK2'] } } })
  await prisma.assetClass.deleteMany({ where: { code: 'TEST_CLASS' } })
})

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: { in: ['TEST_STOCK1', 'TEST_STOCK2'] } } })
  await prisma.assetClass.deleteMany({ where: { code: 'TEST_CLASS' } })
  await prisma.$disconnect()
})

describe('createAssetClass()', () => {
  it('cria uma classe de ativo com código único', async () => {
    const ac = await createAssetClass({
      name: 'Classe Teste',
      code: 'TEST_CLASS',
      description: 'Classe criada por teste automatizado',
    })

    assetClassId = ac.id

    expect(ac.id).toBeDefined()
    expect(ac.name).toBe('Classe Teste')
    expect(ac.code).toBe('TEST_CLASS')
  })
})

describe('createAsset()', () => {
  it('cria um ativo do tipo STOCK com ticker', async () => {
    const asset = await createAsset({
      name: 'Ação Teste S.A.',
      ticker: 'TEST_STOCK1',
      category: 'STOCK',
      assetClassId,
    })

    expect(asset.id).toBeDefined()
    expect(asset.ticker).toBe('TEST_STOCK1')
    expect(asset.category).toBe('STOCK')
    expect(asset.assetClass.id).toBe(assetClassId)
  })

  it('cria um ativo FII sem ISIN (campos opcionais nulos)', async () => {
    const asset = await createAsset({
      name: 'FII Teste',
      ticker: 'TEST_STOCK2',
      category: 'FII',
      assetClassId,
    })

    expect(asset.category).toBe('FII')
    expect(asset.isin).toBeNull()
    expect(asset.cnpj).toBeNull()
  })
})

describe('getAssetByTicker()', () => {
  it('retorna ativo pelo ticker exato', async () => {
    const asset = await getAssetByTicker('TEST_STOCK1')
    expect(asset).not.toBeNull()
    expect(asset!.ticker).toBe('TEST_STOCK1')
    expect(asset!.assetClass).toBeDefined()
  })

  it('retorna null para ticker inexistente', async () => {
    const asset = await getAssetByTicker('XXXXX99')
    expect(asset).toBeNull()
  })
})

describe('getAllAssetClasses()', () => {
  it('retorna classes incluindo a classe criada no teste', async () => {
    const classes = await getAllAssetClasses()
    expect(classes.some((c) => c.id === assetClassId)).toBe(true)
  })
})

describe('getAssetsByClass()', () => {
  it('retorna ativos criados para a classe de teste', async () => {
    const assets = await getAssetsByClass(assetClassId)
    expect(assets.length).toBe(2)
    expect(assets.every(a => a.assetClassId === assetClassId)).toBe(true)
  })
})
