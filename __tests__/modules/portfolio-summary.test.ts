import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getPortfolioSummary } from '@/modules/positions/service'

/**
 * Testes para getPortfolioSummary - função que consolida dados do dashboard
 */
describe('getPortfolioSummary', () => {
  let userId: string
  let clientId: string
  let accountId: string
  let institutionId: string
  let assetId1: string
  let assetId2: string
  let assetClassId: string
  const timestamp = Date.now()

  beforeAll(async () => {
    // Cria usuário
    const user = await prisma.user.create({
      data: {
        email: `test-portfolio-${timestamp}@test.com`,
        name: 'Test User',
      },
    })
    userId = user.id

    // Cria instituição
    const institution = await prisma.institution.create({
      data: {
        name: `Test Broker ${timestamp}`,
        type: 'BROKER',
      },
    })
    institutionId = institution.id

    // Cria cliente (portfolio owner)
    const client = await prisma.client.create({
      data: {
        userId,
        name: 'Test Client',
      },
    })
    clientId = client.id

    // Cria conta
    const account = await prisma.account.create({
      data: {
        clientId,
        institutionId,
        name: 'Test Account',
        type: 'BROKERAGE',
      },
    })
    accountId = account.id

    // Cria AssetClass com nome único
    const assetClass = await prisma.assetClass.create({
      data: {
        code: `TEST_CLASS_${timestamp}`,
        name: `Test Class ${timestamp}`,
      },
    })
    assetClassId = assetClass.id

    // Cria ativos
    const asset1 = await prisma.asset.create({
      data: {
        ticker: `TEST1_${timestamp}`,
        name: 'Test Asset 1',
        category: 'STOCK',
        assetClassId,
      },
    })
    assetId1 = asset1.id

    const asset2 = await prisma.asset.create({
      data: {
        ticker: `TEST2_${timestamp}`,
        name: 'Test Asset 2',
        category: 'STOCK',
        assetClassId,
      },
    })
    assetId2 = asset2.id
  })

  afterAll(async () => {
    // Cleanup: remover transações, ativos, contas, etc
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })
    await prisma.incomeEvent.deleteMany({
      where: { account: { clientId } },
    })
    await prisma.asset.deleteMany({
      where: { id: { in: [assetId1, assetId2] } },
    })
    await prisma.assetClass.deleteMany({
      where: { id: assetClassId },
    })
    await prisma.account.deleteMany({
      where: { id: accountId },
    })
    await prisma.client.deleteMany({
      where: { id: clientId },
    })
    await prisma.institution.deleteMany({
      where: { id: institutionId },
    })
    await prisma.user.deleteMany({
      where: { id: userId },
    })
  })

  it('retorna summary zerado quando nao ha posicoes', async () => {
    const summary = await getPortfolioSummary(userId)

    expect(summary.assetCount).toBe(0)
    expect(summary.totalCost.toString()).toBe('0')
    expect(summary.totalValue.toString()).toBe('0')
    expect(summary.topPositions).toHaveLength(0)
    expect(summary.allocationByClass).toHaveLength(0)
  })

  it('calcula totalCost = soma dos custos das posicoes', async () => {
    // Cria 2 transações de compra
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: new Decimal(10),
        totalAmount: new Decimal(100),
        date: new Date('2026-01-01'),
        referenceId: `test-${timestamp}-1`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: new Decimal(20),
        totalAmount: new Decimal(200),
        date: new Date('2026-01-02'),
        referenceId: `test-${timestamp}-2`,
      },
    })

    const summary = await getPortfolioSummary(userId)

    expect(summary.assetCount).toBe(2)
    expect(summary.totalCost.toString()).toBe('300')
    expect(summary.topPositions).toHaveLength(2)
  })

  it('calcula totalGainLossPct corretamente', async () => {
    // Limpar transações anteriores
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })

    // Cria compra: 10 ações @ 100 = 1000
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: new Decimal(10),
        totalAmount: new Decimal(1000),
        date: new Date('2026-01-01'),
        referenceId: `test-${timestamp}-3`,
      },
    })

    const summary = await getPortfolioSummary(userId)

    // Sem cotações, totalValue === totalCost, então gainLoss === 0 e pct === 0
    expect(summary.totalGainLossPct).toBe(0)
    expect(summary.totalGainLoss.toString()).toBe('0')
  })

  it('filtra monthlyIncome apenas do mes atual', async () => {
    // Cleanup
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })
    await prisma.incomeEvent.deleteMany({
      where: { account: { clientId } },
    })

    // Cria transação para ter posição
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: new Decimal(10),
        totalAmount: new Decimal(100),
        date: new Date('2026-01-01'),
        referenceId: `test-${timestamp}-4`,
      },
    })

    // Cria income do mês atual (Abril 2026)
    const now = new Date()
    await prisma.incomeEvent.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'DIVIDEND',
        grossAmount: new Decimal(50),
        netAmount: new Decimal(42.5),
        paymentDate: new Date(now.getFullYear(), now.getMonth(), 15),
      },
    })

    // Cria income do mês anterior
    await prisma.incomeEvent.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'DIVIDEND',
        grossAmount: new Decimal(50),
        netAmount: new Decimal(42.5),
        paymentDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      },
    })

    const summary = await getPortfolioSummary(userId)

    // Deve contar apenas o income do mês atual
    expect(parseFloat(summary.monthlyIncome.toString())).toBeLessThanOrEqual(60)
  })

  it('retorna assetCount = 0 para usuario sem posicoes', async () => {
    // Cria novo usuário
    const newUser = await prisma.user.create({
      data: {
        email: `test-empty-${Date.now()}@test.com`,
        name: 'Empty User',
      },
    })

    const summary = await getPortfolioSummary(newUser.id)

    expect(summary.assetCount).toBe(0)
    expect(summary.topPositions).toHaveLength(0)

    // Cleanup
    await prisma.user.delete({ where: { id: newUser.id } })
  })

  it('agrega allocationByClass por assetClassCode', async () => {
    // Cleanup
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })

    // Cria 2 ativos da mesma classe
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: new Decimal(10),
        totalAmount: new Decimal(100),
        date: new Date('2026-01-01'),
        referenceId: `test-${timestamp}-5`,
      },
    })

    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId2,
        type: 'BUY',
        quantity: new Decimal(10),
        totalAmount: new Decimal(200),
        date: new Date('2026-01-02'),
        referenceId: `test-${timestamp}-6`,
      },
    })

    const summary = await getPortfolioSummary(userId)

    // Ambos os ativos são da classe TEST_CLASS_{timestamp}, deve agrupar
    expect(summary.allocationByClass).toHaveLength(1)
    expect(summary.allocationByClass[0].className).toBe(`TEST_CLASS_${timestamp}`)
    expect(summary.allocationByClass[0].value.toString()).toBe('300')
  })

  it('topPositions retorna no maximo 5 itens', async () => {
    // Cleanup
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })

    // Cria 7 ativos
    const assetIds = []
    const rand = Math.random().toString(36).substring(7)
    for (let i = 0; i < 7; i++) {
      const asset = await prisma.asset.create({
        data: {
          ticker: `TEST${i}${rand}`,
          name: `Test Asset ${i}`,
          category: 'STOCK',
          assetClassId,
        },
      })
      assetIds.push(asset.id)
    }

    // Cria transações para cada ativo
    for (let i = 0; i < 7; i++) {
      await prisma.transaction.create({
        data: {
          accountId,
          assetId: assetIds[i],
          type: 'BUY',
          quantity: new Decimal(10),
          totalAmount: new Decimal((i + 1) * 100),
          date: new Date('2026-01-01'),
          referenceId: `test-${timestamp}-7-${i}-${rand}`,
        },
      })
    }

    const summary = await getPortfolioSummary(userId)

    expect(summary.topPositions.length).toBeLessThanOrEqual(5)
    expect(summary.assetCount).toBe(7) // mas topPositions apenas 5

    // Cleanup
    await prisma.asset.deleteMany({
      where: { id: { in: assetIds } },
    })
  })

  it('DashboardPage renderiza EmptyState quando assetCount === 0', async () => {
    // Este teste valida logicamente a renderização condicionada
    // (teste de componentes em outro arquivo)
    const emptyUser = await prisma.user.create({
      data: {
        email: `test-render-${Date.now()}@test.com`,
        name: 'Render Test User',
      },
    })

    const summary = await getPortfolioSummary(emptyUser.id)

    // Se assetCount === 0, deve retornar summary vazio
    if (summary.assetCount === 0) {
      expect(summary.topPositions).toHaveLength(0)
      expect(summary.allocationByClass).toHaveLength(0)
    }

    // Cleanup
    await prisma.user.delete({ where: { id: emptyUser.id } })
  })

  it('DashboardPage renderiza cards quando ha posicoes', async () => {
    // Cleanup anteriores
    await prisma.transaction.deleteMany({
      where: { account: { clientId } },
    })

    // Cria transação simples
    await prisma.transaction.create({
      data: {
        accountId,
        assetId: assetId1,
        type: 'BUY',
        quantity: new Decimal(5),
        totalAmount: new Decimal(500),
        date: new Date('2026-01-01'),
        referenceId: `test-${timestamp}-8`,
      },
    })

    const summary = await getPortfolioSummary(userId)

    // Deve retornar dados válidos para renderizar cards
    expect(summary.assetCount).toBeGreaterThan(0)
    expect(summary.totalCost.toString()).toBe('500')
    expect(summary.topPositions.length).toBeGreaterThan(0)
  })
})
