import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'

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
import { createAccount } from '../../src/modules/accounts/service'
import { safeDeleteMany, uniqueName, uniqueSuffix } from '../helpers/fixtures'

const mockAuth = auth as ReturnType<typeof vi.fn>

let userId: string
let portfolioId: string
let otherUserId: string
let otherPortfolioId: string
let existingInstitutionId: string
let clientId: string
let chainedInstitutionName: string
const suiteId = uniqueSuffix()

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `test-actions-${suiteId}@invest.br`, name: uniqueName('Test Actions') },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Carteira Test Actions'), userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { userId, name: uniqueName('Cliente Actions') },
  })
  clientId = client.id

  const otherUser = await prisma.user.create({
    data: {
      email: `test-actions-other-${suiteId}@invest.br`,
      name: uniqueName('Other Actions'),
    },
  })
  otherUserId = otherUser.id

  const otherPortfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Carteira Outro Usuário Actions'), userId: otherUserId },
  })
  otherPortfolioId = otherPortfolio.id

  const institution = await prisma.institution.create({
    data: { name: uniqueName('Instituição Ações') },
  })
  existingInstitutionId = institution.id

  chainedInstitutionName = uniqueName('Instituição Encadeada')
})

afterEach(async () => {
  await safeDeleteMany(prisma.transaction, {
    account: { portfolioId },
  })
  await safeDeleteMany(prisma.account, { portfolioId })
  await safeDeleteMany(prisma.institution, { name: chainedInstitutionName })
})

afterAll(async () => {
  await safeDeleteMany(prisma.transaction, { account: { portfolioId } })
  await safeDeleteMany(prisma.account, { portfolioId })
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.institution, {
    OR: [
      { id: existingInstitutionId },
      { name: chainedInstitutionName },
    ],
  })
  await safeDeleteMany(prisma.portfolio, { id: { in: [portfolioId, otherPortfolioId] } })
  await safeDeleteMany(prisma.user, { id: { in: [userId, otherUserId] } })
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
    formData.set('institutionName', chainedInstitutionName)

    await expect(createAccountAction(formData)).rejects.toThrow('REDIRECT:/accounts')

    const created = await prisma.account.findFirst({
      where: { name: 'Conta Actions Nova Instituição', portfolio: { userId } },
      include: { institution: true },
    })

    expect(created).not.toBeNull()
    expect(created?.institution.name).toBe(chainedInstitutionName)
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

    await createAccount({
      name: 'Conta Actions Listagem',
      type: 'BROKERAGE',
      clientId,
      institutionId: existingInstitutionId,
      portfolioId,
    })

    const accounts = await getAccountsForUser()
    expect(Array.isArray(accounts)).toBe(true)
    expect(accounts.some((a: { name: string }) => a.name === 'Conta Actions Listagem')).toBe(true)
  })

  it('retorna array vazio quando usuário não autenticado', async () => {
    mockAuth.mockResolvedValue(null)

    const accounts = await getAccountsForUser()
    expect(accounts).toEqual([])
  })
})
