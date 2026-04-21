import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { importPosicaoRows } from '@/modules/b3/service'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
let createdClientId: string | null = null
const createdTickers: string[] = []
const createdInstitutionNames = new Set<string>()

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `pos-flow-${suiteId}@invest.br`,
      name: uniqueName('Pos Flow User'),
    },
  })
  userId = user.id

  await prisma.assetClass.upsert({
    where: { code: 'ACOES' },
    update: {},
    create: { code: 'ACOES', name: 'Acoes' },
  })
})

afterAll(async () => {
  const client = await prisma.client.findFirst({
    where: { userId },
    select: { id: true },
  })

  if (client?.id) {
    createdClientId = client.id
  }

  const accountIds = createdClientId
    ? (await prisma.account.findMany({ where: { clientId: createdClientId }, select: { id: true } })).map((item) => item.id)
    : []

  await safeDeleteMany(prisma.auditLog, { changedBy: userId })

  if (accountIds.length > 0) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.transaction, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.account, { id: { in: accountIds } })
  }

  if (createdInstitutionNames.size > 0) {
    await safeDeleteMany(prisma.institution, { name: { in: Array.from(createdInstitutionNames) } })
  }

  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })

  if (createdClientId) {
    await safeDeleteMany(prisma.client, { id: createdClientId })
  }

  await safeDeleteMany(prisma.portfolio, { userId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

function buildRow(input: {
  ticker: string
  instituicao: string
  conta?: string
  quantity?: number
  closePrice?: number
  updatedValue?: number
}) {
  return {
    ticker: input.ticker,
    name: `${input.ticker} TESTE`,
    category: 'STOCK' as const,
    quantity: input.quantity ?? 10,
    closePrice: input.closePrice ?? 12.5,
    updatedValue: input.updatedValue ?? 125,
    instituicao: input.instituicao,
    conta: input.conta ?? 'Conta Posição',
  }
}

describe('importPosicaoRows', () => {
  it('cria estrutura minima automaticamente para usuario sem conta previa', async () => {
    const ticker = uniqueTicker('POSA')
    const institutionName = 'CORRETORA POS FLOW TESTE S.A.'
    createdTickers.push(ticker)
    createdInstitutionNames.add(institutionName)

    const result = await importPosicaoRows(userId, [
      buildRow({ ticker, instituicao: institutionName }),
    ])

    expect(result.upserted).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)

    const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } })
    expect(client?.id).toBeTruthy()

    const institution = await prisma.institution.findFirst({
      where: { name: institutionName },
      select: { id: true },
    })
    expect(institution?.id).toBeTruthy()

    const account = await prisma.account.findFirst({
      where: {
        clientId: client?.id,
        institutionId: institution?.id,
      },
      select: { id: true },
    })
    expect(account?.id).toBeTruthy()
  })

  it('ignora linha sem instituicao e registra skipped', async () => {
    const ticker = uniqueTicker('POSB')
    createdTickers.push(ticker)

    const result = await importPosicaoRows(userId, [
      buildRow({ ticker, instituicao: '   ' }),
    ])

    expect(result.upserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)
  })
})
