'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAccount } from '@/modules/accounts/service'

export async function updateAccountAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Nao autenticado')
  }

  const accountId = (formData.get('accountId') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const institutionId = (formData.get('institutionId') as string | null)?.trim() ?? ''
  const portfolioIdRaw = (formData.get('portfolioId') as string | null)?.trim() ?? ''

  if (!accountId) {
    throw new Error('ID da conta e obrigatorio.')
  }

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      client: {
        userId: session.user.id,
      },
    },
    select: { id: true },
  })

  if (!account) {
    throw new Error('Conta nao encontrada para o usuario autenticado.')
  }

  await updateAccount(accountId, {
    name,
    institutionId,
    portfolioId: portfolioIdRaw || null,
  })

  revalidatePath('/accounts')
  revalidatePath('/accounts/new')
  redirect('/accounts')
}
