'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccountType } from '@prisma/client'

export async function createAccountAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const name = formData.get('name') as string
  const type = formData.get('type') as AccountType
  const institutionName = formData.get('institutionName') as string

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

  // Cria ou reutiliza a instituição se informada
  let institutionId: string | null = null
  if (institutionName?.trim()) {
    const institution = await prisma.institution.upsert({
      where: { id: `name:${institutionName.trim()}` },
      create: { name: institutionName.trim() },
      update: {},
    }).catch(async () => {
      // fallback: busca por nome
      const existing = await prisma.institution.findFirst({
        where: { name: institutionName.trim() },
      })
      if (existing) return existing
      return prisma.institution.create({ data: { name: institutionName.trim() } })
    })
    institutionId = institution.id
  }

  await prisma.account.create({
    data: {
      name: name.trim(),
      type,
      portfolioId: portfolio.id,
      institutionId,
    },
  })

  redirect('/accounts')
}
