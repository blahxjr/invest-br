import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { InstitutionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  analyzeNegociacaoRows,
  buildAccountName,
  inferInstitutionType,
  normalizeInstitutionName,
  upsertAccountForInstitution,
  upsertInstitution,
} from '@/modules/b3/service'
import { safeDeleteMany, uniqueName, uniqueSuffix } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
let clientId: string
let institutionId: string
let createdAccountId: string

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `inst-map-${suiteId}@invest.br`, name: uniqueName('User Institution Mapping') },
  })
  userId = user.id

  const client = await prisma.client.create({
    data: { userId, name: uniqueName('Client Institution Mapping') },
  })
  clientId = client.id
})

afterAll(async () => {
  if (createdAccountId) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: createdAccountId })
    await safeDeleteMany(prisma.transaction, { accountId: createdAccountId })
    await safeDeleteMany(prisma.account, { id: createdAccountId })
  }
  if (institutionId) {
    await safeDeleteMany(prisma.institution, { id: institutionId })
  }
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

describe('institution/account helpers', () => {
  it('normaliza nome de instituição em uppercase', () => {
    expect(normalizeInstitutionName('  xp investimentos  ')).toBe('XP INVESTIMENTOS')
  })

  it('lança erro para nome vazio', () => {
    expect(() => normalizeInstitutionName('')).toThrow('Nome de instituição vazio')
  })

  it('infere BROKER para corretora', () => {
    expect(inferInstitutionType('NU INVEST CORRETORA DE VALORES S.A.')).toBe(InstitutionType.BROKER)
  })

  it('infere BANK para banco', () => {
    expect(inferInstitutionType('BANCO INTER S.A.')).toBe(InstitutionType.BANK)
  })

  it('infere CRYPTO_EXCHANGE para exchange', () => {
    expect(inferInstitutionType('BINANCE BRASIL')).toBe(InstitutionType.CRYPTO_EXCHANGE)
  })

  it('infere OTHER para nome genérico', () => {
    expect(inferInstitutionType('QUALQUER OUTRO')).toBe(InstitutionType.OTHER)
  })

  it('monta nome amigável Nu Invest', () => {
    expect(buildAccountName('NU INVEST CORRETORA DE VALORES S.A.')).toBe('Nu Invest')
  })

  it('monta nome amigável Xp Investimentos', () => {
    expect(buildAccountName('XP INVESTIMENTOS S.A.')).toBe('Xp Investimentos')
  })

  it('monta nome amigável Clear', () => {
    expect(buildAccountName('CLEAR CORRETORA')).toBe('Clear')
  })

  it('upsertInstitution é idempotente para o mesmo nome', async () => {
    const first = await upsertInstitution('NU INVEST CORRETORA DE VALORES S.A.', prisma)
    const second = await upsertInstitution('NU INVEST CORRETORA DE VALORES S.A.', prisma)

    institutionId = first
    expect(second).toBe(first)
  })

  it('upsertAccountForInstitution cria conta BROKERAGE para o client', async () => {
    const accountId = await upsertAccountForInstitution(
      institutionId,
      'NU INVEST CORRETORA DE VALORES S.A.',
      clientId,
      prisma,
    )
    createdAccountId = accountId

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true, clientId: true },
    })

    expect(account?.type).toBe('BROKERAGE')
    expect(account?.clientId).toBe(clientId)
  })

  it('upsertAccountForInstitution é idempotente para mesma instituição/client', async () => {
    const first = await upsertAccountForInstitution(
      institutionId,
      'NU INVEST CORRETORA DE VALORES S.A.',
      clientId,
      prisma,
    )
    const second = await upsertAccountForInstitution(
      institutionId,
      'NU INVEST CORRETORA DE VALORES S.A.',
      clientId,
      prisma,
    )

    expect(second).toBe(first)
  })
})

describe('analyzeNegociacaoRows institution previews', () => {
  it('retorna institutionPreviews com isNew true para instituição não cadastrada', async () => {
    const uniqueInstitution = `CORRETORA TESTE ${suiteId} S.A.`

    const result = await analyzeNegociacaoRows([
      {
        date: new Date('2026-04-15T00:00:00.000Z'),
        type: 'BUY',
        ticker: 'ATV0011',
        mercado: 'Mercado a Vista',
        instituicao: uniqueInstitution,
        quantity: 1,
        price: 10,
        total: 10,
        referenceId: 'ref-inst-preview',
      },
    ])

    const preview = result.institutionPreviews.find((item) => item.normalizedName === normalizeInstitutionName(uniqueInstitution))
    expect(preview).toBeDefined()
    expect(preview?.isNew).toBe(true)
    expect(preview?.rowCount).toBe(1)
  })

  it('retorna estratégia SINGLE_ACCOUNT quando há uma única conta na instituição', async () => {
    const institutionName = 'NU INVEST CORRETORA DE VALORES S.A.'

    const result = await analyzeNegociacaoRows([
      {
        date: new Date('2026-04-15T00:00:00.000Z'),
        type: 'BUY',
        ticker: 'ATV1011',
        mercado: 'Mercado a Vista',
        instituicao: institutionName,
        quantity: 1,
        price: 10,
        total: 10,
        referenceId: 'ref-account-map',
      },
    ], userId)

    const mapping = result.institutionAccountMappings.find(
      (item) => item.normalizedInstitutionName === normalizeInstitutionName(institutionName),
    )

    expect(mapping).toBeDefined()
    expect(mapping?.autoFillStrategy).toBe('SINGLE_ACCOUNT')
    expect(mapping?.suggestedAccountName).toBeTruthy()
    expect(result.institutionAccountSummary.institutionsWithAutoFill).toBeGreaterThanOrEqual(1)
  })
})
