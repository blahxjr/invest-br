import { prisma } from '../../lib/prisma'
import type { AccountCreateInput } from './types'

export async function createAccount(input: AccountCreateInput) {
  return prisma.account.create({
    data: {
      name: input.name,
      type: input.type,
      portfolioId: input.portfolioId,
      institutionId: input.institutionId ?? null,
    },
    include: {
      portfolio: true,
      institution: true,
    },
  })
}

export async function getAccountsByPortfolio(portfolioId: string) {
  return prisma.account.findMany({
    where: { portfolioId },
    include: { institution: true },
  })
}
