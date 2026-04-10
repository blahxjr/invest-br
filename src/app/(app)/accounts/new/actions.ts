'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccountType } from '@prisma/client'
import { createAccount } from '@/modules/accounts/service'
import { createInstitution } from '@/modules/institutions/service'

export async function getAccountFormData() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      institutions: [],
      portfolios: [],
    }
  }

  const [institutions, portfolios] = await Promise.all([
    prisma.institution.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.portfolio.findMany({
      where: { userId: session.user.id },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  return {
    institutions,
    portfolios,
  }
}

export async function createAccountAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const name = formData.get('name') as string
  const type = formData.get('type') as AccountType
  const institutionId = formData.get('institutionId') as string
  const institutionName = formData.get('institutionName') as string
  const portfolioId = formData.get('portfolioId') as string

  if (!name?.trim() || !type) {
    throw new Error('Nome e tipo são obrigatórios')
  }

  // Garante que o portfolio do usuário existe
  let portfolio = await prisma.portfolio.findFirst({
    where: { userId: session.user.id },
  })

  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: {
        name: 'Minha Carteira',
        userId: session.user.id,
      },
    })
  }

  // Cria/reutiliza o client principal do usuário para vincular a conta
  const existingClient = await prisma.client.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  const user = !existingClient
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      })
    : null

  const client = existingClient ?? await prisma.client.create({
    data: {
      userId: session.user.id,
      name: user?.name?.trim() || user?.email?.split('@')[0] || 'Cliente principal',
    },
  })

  let resolvedInstitutionId: string | null = null

  if (institutionId?.trim()) {
    const existingInstitution = await prisma.institution.findUnique({
      where: { id: institutionId.trim() },
      select: { id: true },
    })

    if (!existingInstitution) {
      throw new Error('Instituição não encontrada.')
    }

    resolvedInstitutionId = existingInstitution.id
  } else if (institutionName?.trim()) {
    const normalizedInstitutionName = institutionName.trim().replace(/\s+/g, ' ')

    const existingInstitution = await prisma.institution.findFirst({
      where: {
        name: {
          equals: normalizedInstitutionName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    const createdInstitution = existingInstitution ?? await createInstitution({
      name: normalizedInstitutionName,
    })

    resolvedInstitutionId = createdInstitution.id
  }

  if (!resolvedInstitutionId) {
    throw new Error('Instituição é obrigatória')
  }

  let resolvedPortfolioId = portfolio.id
  if (portfolioId?.trim()) {
    const scopedPortfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId.trim(),
        userId: session.user.id,
      },
      select: { id: true },
    })

    if (!scopedPortfolio) {
      throw new Error('Portfólio não encontrado para o usuário autenticado.')
    }

    resolvedPortfolioId = scopedPortfolio.id
  }

  await createAccount({
    name: name.trim(),
    type,
    clientId: client.id,
    institutionId: resolvedInstitutionId,
    portfolioId: resolvedPortfolioId,
  })

  redirect('/accounts')
}
