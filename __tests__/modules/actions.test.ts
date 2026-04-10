import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// @vitest-environment node
// Testa comportamento das Server Actions de conta e transação

// Mocks dos módulos com side-effects de servidor
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

import { auth } from '@/lib/auth'
import { prisma } from '../../src/lib/prisma'
import { createAccountAction } from '../../src/app/(app)/accounts/new/actions'
import { getAccountsForUser, createTransactionAction } from '../../src/app/(app)/transactions/new/actions'

const mockAuth = auth as ReturnType<typeof vi.fn>

let userId: string
let portfolioId: string
let otherUserId: string
let otherPortfolioId: string
let existingInstitutionId: string

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `test-actions-${Date.now()}@invest.br`, name: 'Test Actions' },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: 'Carteira Test Actions', userId },
  })
  portfolioId = portfolio.id

  const otherUser = await prisma.user.create({
    data: { email: `test-actions-other-${Date.now()}@invest.br`, name: 'Other Actions' },
  })
  otherUserId = otherUser.id

  const otherPortfolio = await prisma.portfolio.create({
    data: { name: 'Carteira Outro Usuário Actions', userId: otherUserId },
  })
  otherPortfolioId = otherPortfolio.id

  const institution = await prisma.institution.create({
    data: { name: `Instituição Ações ${Date.now()}` },
  })
  existingInstitutionId = institution.id
})

afterAll(async () => {
  await prisma.transaction.deleteMany({
    where: { account: { portfolioId } },
  })
  await prisma.account.deleteMany({ where: { portfolioId } })
  await prisma.client.deleteMany({ where: { userId } })
  await prisma.institution.deleteMany({
    where: {
      OR: [
        { id: existingInstitutionId },
        { name: `Instituição Encadeada ${userId}` },
      ],
    },
  })
  await prisma.portfolio.delete({ where: { id: otherPortfolioId } })
  await prisma.portfolio.delete({ where: { id: portfolioId } })
  await prisma.user.delete({ where: { id: otherUserId } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

describe('createAccountAction()', () => {
  it('lança erro quando usuário não está autenticado', async () => {
    mockAuth.mockResolvedValue(null)

    const formData = new FormData()
    formData.set('name', 'Conta Teste')
    formData.set('type', 'BROKERAGE')

    await expect(createAccountAction(formData)).rejects.toThrow('Não autenticado')
  })

  it('cria conta e redireciona quando autenticado', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } })

    const formData = new FormData()
    formData.set('name', 'Conta Actions Test')
    formData.set('type', 'BROKERAGE')
    formData.set('institutionId', existingInstitutionId)

    // redirect lança exceção artificial para não depender de Next.js runtime
    await expect(createAccountAction(formData)).rejects.toThrow('REDIRECT:/accounts')

    const created = await prisma.account.findFirst({
      where: { name: 'Conta Actions Test', portfolio: { userId } },
    })
    expect(created).not.toBeNull()
    expect(created?.type).toBe('BROKERAGE')
    expect(created?.institutionId).toBe(existingInstitutionId)
  })

  it('cria instituição encadeada quando institutionName é informado', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } })

    const formData = new FormData()
    formData.set('name', 'Conta Actions Nova Instituição')
    formData.set('type', 'BANK')
    formData.set('institutionName', `Instituição Encadeada ${userId}`)

    await expect(createAccountAction(formData)).rejects.toThrow('REDIRECT:/accounts')

    const created = await prisma.account.findFirst({
      where: { name: 'Conta Actions Nova Instituição', portfolio: { userId } },
      include: { institution: true },
    })

    expect(created).not.toBeNull()
    expect(created?.institution.name).toBe(`Instituição Encadeada ${userId}`)
  })

  it('falha quando institutionId informado não existe', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } })

    const formData = new FormData()
    formData.set('name', 'Conta Actions Instituição Inválida')
    formData.set('type', 'BROKERAGE')
    formData.set('institutionId', 'institution-inexistente')

    await expect(createAccountAction(formData)).rejects.toThrow('Instituição não encontrada.')
  })

  it('falha quando portfolioId não pertence ao usuário autenticado', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } })

    const formData = new FormData()
    formData.set('name', 'Conta Actions Portfolio Inválido')
    formData.set('type', 'BANK')
    formData.set('institutionId', existingInstitutionId)
    formData.set('portfolioId', otherPortfolioId)

    await expect(createAccountAction(formData)).rejects.toThrow(
      'Portfólio não encontrado para o usuário autenticado.',
    )
  })
})

describe('getAccountsForUser()', () => {
  it('retorna contas do usuário autenticado', async () => {
    mockAuth.mockResolvedValue({ user: { id: userId } })

    const accounts = await getAccountsForUser()
    expect(Array.isArray(accounts)).toBe(true)
    expect(accounts.some((a: { name: string }) => a.name === 'Conta Actions Test')).toBe(true)
  })

  it('retorna array vazio quando usuário não autenticado', async () => {
    mockAuth.mockResolvedValue(null)

    const accounts = await getAccountsForUser()
    expect(accounts).toEqual([])
  })
})
