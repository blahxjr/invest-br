import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { createAccount, getAccountsByPortfolio } from '../../src/modules/accounts/service'

let userId: string
let portfolioId: string
let accountId: string

beforeAll(async () => {
  // Cria user e portfolio de suporte para o teste
  const user = await prisma.user.create({
    data: { email: `test-accounts-${Date.now()}@invest.br`, name: 'Test User' },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: 'Portfólio Teste', userId },
  })
  portfolioId = portfolio.id
})

afterAll(async () => {
  // Limpa em ordem inversa de dependência
  await prisma.account.deleteMany({ where: { portfolioId } })
  await prisma.portfolio.delete({ where: { id: portfolioId } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

describe('createAccount()', () => {
  it('cria uma conta do tipo BROKERAGE vinculada ao portfólio', async () => {
    const account = await createAccount({
      name: 'XP Investimentos',
      type: 'BROKERAGE',
      portfolioId,
    })

    accountId = account.id

    expect(account.id).toBeDefined()
    expect(account.name).toBe('XP Investimentos')
    expect(account.type).toBe('BROKERAGE')
    expect(account.portfolioId).toBe(portfolioId)
    expect(account.institution).toBeNull()
  })

  it('cria uma conta BANK com institutionId opcional nulo', async () => {
    const account = await createAccount({
      name: 'Conta Corrente Itaú',
      type: 'BANK',
      portfolioId,
    })

    expect(account.type).toBe('BANK')
    expect(account.institutionId).toBeNull()
  })
})

describe('getAccountsByPortfolio()', () => {
  it('retorna contas do portfólio', async () => {
    const accounts = await getAccountsByPortfolio(portfolioId)
    expect(accounts.length).toBeGreaterThanOrEqual(2)
    expect(accounts.every(a => a.portfolioId === portfolioId)).toBe(true)
  })
})
