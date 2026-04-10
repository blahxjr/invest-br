import { prisma } from '../../lib/prisma'
import type { AccountCreateInput, AccountUpdateInput } from './types'

/**
 * Cria uma conta validando vínculos obrigatórios com cliente e instituição.
 */
export async function createAccount(input: AccountCreateInput) {
  const normalizedName = input.name.trim()

  if (!normalizedName) {
    throw new Error('Nome da conta é obrigatório.')
  }

  if (!input.clientId.trim()) {
    throw new Error('Client é obrigatório.')
  }

  if (!input.institutionId.trim()) {
    throw new Error('Instituição é obrigatória.')
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, userId: true },
  })

  if (!client) {
    throw new Error('Client não encontrado.')
  }

  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { id: true },
  })

  if (!institution) {
    throw new Error('Instituição não encontrada.')
  }

  if (input.portfolioId?.trim()) {
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: input.portfolioId,
        userId: client.userId,
      },
      select: { id: true },
    })

    if (!portfolio) {
      throw new Error('Portfólio não encontrado para o client informado.')
    }
  }

  return prisma.account.create({
    data: {
      name: normalizedName,
      type: input.type,
      clientId: input.clientId,
      institutionId: input.institutionId,
      portfolioId: input.portfolioId ?? null,
    },
    include: {
      client: true,
      portfolio: true,
      institution: true,
    },
  })
}

/**
 * Lista contas de um portfólio específico.
 */
export async function getAccountsByPortfolio(portfolioId: string) {
  if (!portfolioId.trim()) {
    throw new Error('ID do portfólio é obrigatório.')
  }

  return prisma.account.findMany({
    where: { portfolioId },
    include: { institution: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Lista contas de um client específico.
 */
export async function getAccountsByClient(clientId: string) {
  if (!clientId.trim()) {
    throw new Error('ID do client é obrigatório.')
  }

  return prisma.account.findMany({
    where: { clientId },
    include: {
      institution: true,
      portfolio: true,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Atualiza dados básicos da conta preservando os vínculos válidos de escopo.
 */
export async function updateAccount(id: string, input: AccountUpdateInput) {
  if (!id.trim()) {
    throw new Error('ID da conta é obrigatório.')
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      client: {
        select: { userId: true },
      },
    },
  })

  if (!account) {
    throw new Error('Conta não encontrada.')
  }

  const hasName = input.name !== undefined
  const hasInstitutionId = input.institutionId !== undefined
  const hasPortfolioId = input.portfolioId !== undefined

  if (!hasName && !hasInstitutionId && !hasPortfolioId) {
    throw new Error('Informe ao menos um campo para atualizar a conta.')
  }

  const data: {
    name?: string
    institutionId?: string
    portfolioId?: string | null
  } = {}

  if (hasName) {
    const normalizedName = (input.name as string).trim()

    if (!normalizedName) {
      throw new Error('Nome da conta é obrigatório.')
    }

    data.name = normalizedName
  }

  if (hasInstitutionId) {
    const institutionId = (input.institutionId as string).trim()

    if (!institutionId) {
      throw new Error('Instituição é obrigatória.')
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true },
    })

    if (!institution) {
      throw new Error('Instituição não encontrada.')
    }

    data.institutionId = institutionId
  }

  if (hasPortfolioId) {
    if (input.portfolioId === null) {
      data.portfolioId = null
    } else {
      const portfolioId = input.portfolioId?.trim()

      if (!portfolioId) {
        throw new Error('ID do portfólio inválido.')
      }

      const portfolio = await prisma.portfolio.findFirst({
        where: {
          id: portfolioId,
          userId: account.client.userId,
        },
        select: { id: true },
      })

      if (!portfolio) {
        throw new Error('Portfólio não encontrado para o usuário da conta.')
      }

      data.portfolioId = portfolioId
    }
  }

  return prisma.account.update({
    where: { id },
    data,
    include: {
      client: true,
      portfolio: true,
      institution: true,
    },
  })
}
