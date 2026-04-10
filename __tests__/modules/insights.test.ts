/**
 * Testes do módulo Insights/Rebalanceamento (V1)
 *
 * Cobertura mínima:
 * - Cliente sem transações → retorna []
 * - Um ativo com > 25% → detecta CONCENTRACAO_ATIVO
 * - Classe com > 50% → detecta CONCENTRACAO_CLASSE
 * - Moeda/País com > 70% → detecta CONCENTRACAO_MOEDA_PAIS
 * - Ativo SHORT em carteira LONG → detecta HORIZONTE_DESALINHADO
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getInsightsForClient } from '@/modules/insights/service'
import { InsightType } from '@/modules/insights/types'

describe('Módulo Insights', () => {
  let clientId: string
  let portfolioId: string
  let accountId: string
  let assetClassId: string
  let assetId1: string
  let assetId2: string

  beforeEach(async () => {
    // Limpar dados de teste anteriores
    await prisma.transaction.deleteMany()
    await prisma.account.deleteMany()
    await prisma.asset.deleteMany()
    await prisma.assetClass.deleteMany()
    await prisma.portfolio.deleteMany()
    await prisma.client.deleteMany()

    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: `test-insights-${Date.now()}@example.com`,
        emailVerified: new Date(),
      },
    })

    // Criar cliente
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: 'Test Client',
      },
    })
    clientId = client.id

    // Criar carteira
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        name: 'Test Portfolio',
      },
    })
    portfolioId = portfolio.id

    // Criar instituição
    const institution = await prisma.institution.create({
      data: {
        name: 'Test Bank',
        type: 'BANK',
      },
    })

    // Criar conta
    const account = await prisma.account.create({
      data: {
        clientId,
        institutionId: institution.id,
        portfolioId,
        name: 'Test Account',
        type: 'BROKERAGE',
      },
    })
    accountId = account.id

    // Criar classe de ativo
    const assetClass = await prisma.assetClass.create({
      data: {
        name: 'Ações Brasileiras',
        
        recommendedHorizonBase: 'LONG',
      },
    })
    assetClassId = assetClass.id

    // Criar ativos
    const asset1 = await prisma.asset.create({
      data: {
        name: 'WEG S/A',
        ticker: 'WEGE3',
        assetClassId,
        category: 'STOCK',
        currency: 'BRL',
        country: 'BR',
        recommendedHorizon: 'LONG',
      },
    })
    assetId1 = asset1.id

    const asset2 = await prisma.asset.create({
      data: {
        name: 'Vale S/A',
        ticker: 'VALE3',
        assetClassId,
        category: 'STOCK',
        currency: 'BRL',
        country: 'BR',
        recommendedHorizon: 'LONG',
      },
    })
    assetId2 = asset2.id
  })

  it('Cliente sem transações deve retornar insights vazio', async () => {
    const insights = await getInsightsForClient(clientId)
    expect(insights).toEqual([])
  })

  it('Um ativo com > 25% deve detectar CONCENTRACAO_ATIVO', async () => {
    // Criar transações para ter um ativo com 28% do patrimônio
    // WEGE3: 100 ações × 100 = 10.000 (28% de 35.714)
    // VALE3: 50 ações × 100 = 5.000 (14% de 35.714)

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-wege-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: 50,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-vale-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)

    // Deve ter um insight de CONCENTRACAO_ATIVO
    const concentracaoAtivo = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_ATIVO
    )
    expect(concentracaoAtivo).toBeDefined()
    expect(concentracaoAtivo?.severity).toBe('warning')
    expect(concentracaoAtivo?.metrics.currentPercentage).toBeGreaterThan(0.25)
  })

  it('Classe com > 50% deve detectar CONCENTRACAO_CLASSE', async () => {
    // Criar um segundo asset com classe diferente
    const assetClass2 = await prisma.assetClass.create({
      data: {
        name: 'Renda Fixa',
        
      },
    })

    const asset3 = await prisma.asset.create({
      data: {
        name: 'Tesouro Direto',
        ticker: 'TDIR',
        assetClassId: assetClass2.id,
        currency: 'BRL',
        country: 'BR',
        category: 'BOND',
      },
    })

    // Classe 1: 60% (ações brasileiras)
    // Classe 2: 40% (renda fixa)
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-wege-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: asset3.id,
        type: 'BUY',
        quantity: 50,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-tdir-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)

    // Deve ter concentração de classe
    const concentracaoClasse = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_CLASSE
    )
    expect(concentracaoClasse).toBeDefined()
    expect(concentracaoClasse?.metrics.currentPercentage).toBeGreaterThan(0.5)
  })

  it('Moeda/País com > 70% deve detectar CONCENTRACAO_MOEDA_PAIS', async () => {
    // Todos os ativos em BRL/BR
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-wege-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: 50,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-vale-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)

    // Deve ter concentração de moeda/país (100% em BRL/BR)
    const concentracaoMoedaPais = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_MOEDA_PAIS
    )
    expect(concentracaoMoedaPais).toBeDefined()
    expect(concentracaoMoedaPais?.metrics.currentPercentage).toBe(1.0) // 100%
  })

  it('Ativo com horizonte SHORT em carteira LONG deve detectar HORIZONTE_DESALINHADO', async () => {
    // Criar ativo com horizonte SHORT
    const assetShort = await prisma.asset.create({
      data: {
        name: 'Tesouro Prefixado 2024',
        ticker: 'TPRF24',
        assetClassId,
        category: 'STOCK',
        currency: 'BRL',
        country: 'BR',
        recommendedHorizon: 'SHORT', // Horizonte curto
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetShort.id,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-short-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)

    // Deve detectar desalinhamento de horizonte
    const horizonte = insights.find(
      (i) => i.type === InsightType.HORIZONTE_DESALINHADO
    )
    expect(horizonte).toBeDefined()
  })

  it('Portfolio específico deve filtrar insights apenas para aquela carteira', async () => {
    // Criar segunda carteira
    const user = await prisma.user.findUnique({
      where: { id: (await prisma.client.findUnique({ where: { id: clientId } }))?.userId! },
    })

    const portfolio2 = await prisma.portfolio.create({
      data: {
        userId: user!.id,
        name: 'Portfolio 2',
      },
    })

    // Transação na carteira 1
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-portfolio1-${Date.now()}`,
      },
    })

    // Insights de portfolio 1
    const insights1 = await getInsightsForClient(clientId, portfolioId)
    expect(insights1.length).toBeGreaterThan(0)
    expect(insights1.every((i) => i.scope.portfolioId === portfolioId)).toBe(true)

    // Insights de portfolio 2 (sem transações)
    const insights2 = await getInsightsForClient(clientId, portfolio2.id)
    expect(insights2).toEqual([])
  })

  it('Deve calcular severidade corretamente (info/warning/critical)', async () => {
    // Ativo com 26% → excessPercentage = 0.01 → info
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 26,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-severity-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: 74,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-severity2-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)
    const concentracao = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_ATIVO
    )

    expect(concentracao?.severity).toBe('info') // excessPercentage < 0.1
  })
})




