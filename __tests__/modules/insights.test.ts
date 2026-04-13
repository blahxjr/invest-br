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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { getInsightsForClient } from '../../src/modules/insights/service'
import { InsightType } from '../../src/modules/insights/types'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../helpers/fixtures'

async function seedInsightCatalogDefaults() {
  const defaultTypes = [
    { code: 'CONCENTRACAO_ATIVO', threshold: '0.2500' },
    { code: 'CONCENTRACAO_CLASSE', threshold: '0.5000' },
    { code: 'CONCENTRACAO_MOEDA_PAIS', threshold: '0.7000' },
    { code: 'HORIZONTE_DESALINHADO', threshold: '0.3000' },
  ] as const

  for (const item of defaultTypes) {
    await prisma.insightType.upsert({
      where: { code: item.code },
      update: {
        label: item.code,
        defaultThreshold: item.threshold,
        defaultSeverity: 'WARNING',
        isActive: true,
      },
      create: {
        code: item.code,
        label: item.code,
        defaultThreshold: item.threshold,
        defaultSeverity: 'WARNING',
        isActive: true,
      },
    })
  }

  const profile = await prisma.insightConfigProfile.upsert({
    where: { id: 'global-test-profile' },
    update: {
      name: 'Global Test Profile',
      scope: 'GLOBAL',
      isSystemDefault: true,
    },
    create: {
      id: 'global-test-profile',
      name: 'Global Test Profile',
      scope: 'GLOBAL',
      isSystemDefault: true,
    },
  })

  const types = await prisma.insightType.findMany()
  for (const type of types) {
    await prisma.insightConfigRule.upsert({
      where: {
        profileId_insightTypeId: {
          profileId: profile.id,
          insightTypeId: type.id,
        },
      },
      update: {
        enabled: true,
        thresholdOverride: type.defaultThreshold,
      },
      create: {
        profileId: profile.id,
        insightTypeId: type.id,
        enabled: true,
        thresholdOverride: type.defaultThreshold,
      },
    })
  }
}

describe('Módulo Insights', () => {
  let clientId: string
  let portfolioId: string
  let accountId: string
  let assetClassId: string
  let assetId1: string
  let assetId2: string
  let userId: string
  let institutionId: string
  const suiteId = uniqueSuffix()

  beforeEach(async () => {
    await seedInsightCatalogDefaults()

    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: `test-insights-${suiteId}-${uniqueSuffix()}@example.com`,
        emailVerified: new Date(),
      },
    })
    userId = user.id

    // Criar cliente
    const client = await prisma.client.create({
      data: {
        userId,
        name: uniqueName('Test Client'),
      },
    })
    clientId = client.id

    // Criar carteira
    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        name: uniqueName('Test Portfolio'),
      },
    })
    portfolioId = portfolio.id

    // Criar instituição
    const institution = await prisma.institution.create({
      data: {
        name: uniqueName('Test Bank'),
        type: 'BANK',
      },
    })
    institutionId = institution.id

    // Criar conta
    const account = await prisma.account.create({
      data: {
        clientId,
        institutionId,
        portfolioId,
        name: uniqueName('Test Account'),
        type: 'BROKERAGE',
      },
    })
    accountId = account.id

    // Criar classe de ativo
    const assetClass = await prisma.assetClass.create({
      data: {
        name: uniqueName('Ações Brasileiras'),
        
        recommendedHorizonBase: 'LONG',
      },
    })
    assetClassId = assetClass.id

    // Criar ativos
    const asset1 = await prisma.asset.create({
      data: {
        name: uniqueName('WEG S/A'),
        ticker: uniqueTicker('WEGE'),
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
        name: uniqueName('Vale S/A'),
        ticker: uniqueTicker('VALE'),
        assetClassId,
        category: 'STOCK',
        currency: 'BRL',
        country: 'BR',
        recommendedHorizon: 'LONG',
      },
    })
    assetId2 = asset2.id
  })

  afterEach(async () => {
    await safeDeleteMany(prisma.transaction, { accountId })
    await safeDeleteMany(prisma.account, { clientId })
    await safeDeleteMany(prisma.asset, { assetClassId })
    await safeDeleteMany(prisma.assetClass, { id: assetClassId })
    await safeDeleteMany(prisma.portfolio, { userId })
    await safeDeleteMany(prisma.client, { id: clientId })
    await safeDeleteMany(prisma.institution, { id: institutionId })
    await safeDeleteMany(prisma.user, { id: userId })
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
        name: uniqueName('Tesouro Direto'),
        ticker: uniqueTicker('TDIR'),
        assetClassId: assetClass2.id,
        currency: 'BRL',
        country: 'BR',
        category: 'FIXED_INCOME',
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
        name: uniqueName('Tesouro Prefixado 2024'),
        ticker: uniqueTicker('TPRF'),
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

  it('Deve respeitar enabled=false e não gerar insight para o tipo desativado', async () => {
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 100,
        price: 100,
        totalAmount: 100 * 100,
        date: new Date(),
        referenceId: `ref-enabled-off-1-${Date.now()}`,
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
        referenceId: `ref-enabled-off-2-${Date.now()}`,
      },
    })

    const globalProfile = await prisma.insightConfigProfile.findUniqueOrThrow({
      where: { id: 'global-test-profile' },
    })
    const typeAtivo = await prisma.insightType.findUniqueOrThrow({
      where: { code: 'CONCENTRACAO_ATIVO' },
    })

    await prisma.insightConfigRule.update({
      where: {
        profileId_insightTypeId: {
          profileId: globalProfile.id,
          insightTypeId: typeAtivo.id,
        },
      },
      data: { enabled: false },
    })

    const insights = await getInsightsForClient(clientId)
    const concentracaoAtivo = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_ATIVO
    )

    expect(concentracaoAtivo).toBeUndefined()
  })

  it('Deve usar threshold override do perfil efetivo', async () => {
    const profile = await prisma.insightConfigProfile.create({
      data: {
        name: 'Perfil User Test',
        scope: 'USER',
      },
    })

    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } })
    await prisma.user.update({
      where: { id: client.userId },
      data: { insightConfigProfileId: profile.id },
    })

    const typeAtivo = await prisma.insightType.findUniqueOrThrow({
      where: { code: 'CONCENTRACAO_ATIVO' },
    })

    await prisma.insightConfigRule.create({
      data: {
        profileId: profile.id,
        insightTypeId: typeAtivo.id,
        enabled: true,
        thresholdOverride: '0.6000',
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 55,
        price: 100,
        totalAmount: 100 * 55,
        date: new Date(),
        referenceId: `ref-override-threshold-1-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: 45,
        price: 100,
        totalAmount: 100 * 45,
        date: new Date(),
        referenceId: `ref-override-threshold-2-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)
    const concentracaoAtivo = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_ATIVO
    )

    expect(concentracaoAtivo).toBeUndefined()
  })

  it('Deve fazer fallback para default do InsightType quando não há regra', async () => {
    await prisma.insightConfigRule.deleteMany()

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: 60,
        price: 100,
        totalAmount: 100 * 60,
        date: new Date(),
        referenceId: `ref-fallback-1-${Date.now()}`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: 40,
        price: 100,
        totalAmount: 100 * 40,
        date: new Date(),
        referenceId: `ref-fallback-2-${Date.now()}`,
      },
    })

    const insights = await getInsightsForClient(clientId)
    const concentracaoAtivo = insights.find(
      (i) => i.type === InsightType.CONCENTRACAO_ATIVO
    )

    expect(concentracaoAtivo).toBeDefined()
    expect(concentracaoAtivo?.metrics.threshold).toBeCloseTo(0.25)
  })
})





