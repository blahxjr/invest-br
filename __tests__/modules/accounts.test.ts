import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import {
  createAccount,
  getAccountsByClient,
  getAccountsByPortfolio,
  updateAccount,
} from '../../src/modules/accounts/service'
import { safeDeleteMany, uniqueName, uniqueSuffix } from '../helpers/fixtures'

let userId: string
let otherUserId: string
let portfolioId: string
let otherPortfolioId: string
let clientId: string
let institutionId: string
let secondInstitutionId: string
const suiteId = uniqueSuffix()

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `test-accounts-${suiteId}@invest.br`, name: uniqueName('Test User') },
  })
  userId = user.id

  const otherUser = await prisma.user.create({
    data: {
      email: `test-accounts-other-${suiteId}@invest.br`,
      name: uniqueName('Other User'),
    },
  })
  otherUserId = otherUser.id

  const portfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Portfólio Teste'), userId },
  })
  portfolioId = portfolio.id

  const otherPortfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Portfólio Outro Usuário'), userId: otherUserId },
  })
  otherPortfolioId = otherPortfolio.id

  const client = await prisma.client.create({
    data: { name: uniqueName('Cliente Teste'), userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: uniqueName('Instituição Teste') },
  })
  institutionId = institution.id

  const secondInstitution = await prisma.institution.create({
    data: { name: uniqueName('Instituição Atualizada') },
  })
  secondInstitutionId = secondInstitution.id
})

afterEach(async () => {
  await safeDeleteMany(prisma.account, { clientId })
})

afterAll(async () => {
  await safeDeleteMany(prisma.account, { clientId })
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.institution, { id: { in: [institutionId, secondInstitutionId] } })
  await safeDeleteMany(prisma.portfolio, { id: { in: [portfolioId, otherPortfolioId] } })
  await safeDeleteMany(prisma.user, { id: { in: [userId, otherUserId] } })
  await prisma.$disconnect()
})


describe('createAccount()', () => {
  it('cria uma conta do tipo BROKERAGE vinculada ao portfólio', async () => {
    const account = await createAccount({
      name: `XP Investimentos ${Date.now()}`,
      type: 'BROKERAGE',
      clientId,
      institutionId,
      portfolioId,
    })

    expect(account.id).toBeDefined()
    expect(account.name).toContain('XP Investimentos')
    expect(account.type).toBe('BROKERAGE')
    expect(account.clientId).toBe(clientId)
    expect(account.portfolioId).toBe(portfolioId)
    expect(account.institutionId).toBe(institutionId)
  })

  it('cria conta sem portfolio quando não informado (vínculo opcional)', async () => {
    const account = await createAccount({
      name: `Conta Sem Portfolio Explícita ${Date.now()}`,
      type: 'BANK',
      clientId,
      institutionId,
    })

    expect(account.id).toBeDefined()
    expect(account.clientId).toBe(clientId)
    expect(account.institutionId).toBe(institutionId)
    expect(account.portfolioId).toBeNull()
  })

  it('falha ao criar conta quando clientId não é informado', async () => {
    await expect(
      createAccount({
        name: 'Conta Sem Client',
        type: 'BROKERAGE',
        clientId: '   ',
        institutionId,
      }),
    ).rejects.toThrow('Client é obrigatório.')
  })

  it('falha ao criar conta quando clientId não existe', async () => {
    await expect(
      createAccount({
        name: 'Conta Client Inexistente',
        type: 'BROKERAGE',
        clientId: 'client-inexistente',
        institutionId,
      }),
    ).rejects.toThrow('Client não encontrado.')
  })

  it('falha ao criar conta quando institutionId não é informado', async () => {
    await expect(
      createAccount({
        name: 'Conta Sem Instituição',
        type: 'BROKERAGE',
        clientId,
        institutionId: '   ',
      }),
    ).rejects.toThrow('Instituição é obrigatória.')
  })

  it('falha ao criar conta quando institutionId não existe', async () => {
    await expect(
      createAccount({
        name: 'Conta Inválida',
        type: 'BROKERAGE',
        clientId,
        institutionId: 'institution-inexistente',
        portfolioId,
      }),
    ).rejects.toThrow('Instituição não encontrada.')
  })

  it('falha ao criar conta quando portfolio não pertence ao user do client', async () => {
    await expect(
      createAccount({
        name: 'Conta Portfolio Inválido',
        type: 'BROKERAGE',
        clientId,
        institutionId,
        portfolioId: otherPortfolioId,
      }),
    ).rejects.toThrow('Portfólio não encontrado para o client informado.')
  })
})

describe('getAccountsByPortfolio() e getAccountsByClient()', () => {
  it('retorna contas filtradas por portfólio e por client', async () => {
    await createAccount({
      name: `Conta Portfolio ${Date.now()}`,
      type: 'BANK',
      clientId,
      institutionId,
      portfolioId,
    })

    await createAccount({
      name: `Conta Sem Portfolio ${Date.now()}`,
      type: 'MANUAL',
      clientId,
      institutionId,
    })

    const accounts = await getAccountsByPortfolio(portfolioId)
    expect(accounts.length).toBeGreaterThanOrEqual(1)
    expect(accounts.every(a => a.portfolioId === portfolioId)).toBe(true)

    const accountsByClient = await getAccountsByClient(clientId)
    expect(accountsByClient.length).toBeGreaterThanOrEqual(2)
    expect(accountsByClient.every((a) => a.clientId === clientId)).toBe(true)
  })

  it('lista conta recém-criada ao buscar por client', async () => {
    const account = await createAccount({
      name: `Conta Listagem Client ${Date.now()}`,
      type: 'MANUAL',
      clientId,
      institutionId,
    })

    const accountsByClient = await getAccountsByClient(clientId)
    const listed = accountsByClient.find((item) => item.id === account.id)

    expect(listed).toBeDefined()
    expect(listed?.clientId).toBe(clientId)
    expect(listed?.institutionId).toBe(institutionId)
    expect(listed?.portfolioId).toBeNull()
  })
})

describe('updateAccount()', () => {
  it('atualiza nome, instituição e remove vínculo de portfólio', async () => {
    const account = await createAccount({
      name: `Conta Atualizar ${Date.now()}`,
      type: 'BROKERAGE',
      clientId,
      institutionId,
      portfolioId,
    })

    const updated = await updateAccount(account.id, {
      name: 'Conta Atualizada',
      institutionId: secondInstitutionId,
      portfolioId: null,
    })

    expect(updated.name).toBe('Conta Atualizada')
    expect(updated.institutionId).toBe(secondInstitutionId)
    expect(updated.portfolioId).toBeNull()
  })

  it('falha quando tenta vincular conta a portfólio fora do escopo do usuário', async () => {
    const account = await createAccount({
      name: `Conta Scope ${Date.now()}`,
      type: 'BROKERAGE',
      clientId,
      institutionId,
      portfolioId,
    })

    await expect(updateAccount(account.id, {
      portfolioId: otherPortfolioId,
    })).rejects.toThrow('Portfólio não encontrado para o usuário da conta.')
  })
})
