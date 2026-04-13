'use server'

import { InstitutionType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createInstitution, updateInstitution } from '@/modules/institutions/service'

function parseInstitutionType(value: FormDataEntryValue | null) {
  const parsed = typeof value === 'string' ? value.trim() : ''
  return parsed ? (parsed as InstitutionType) : null
}

export async function createInstitutionAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const type = parseInstitutionType(formData.get('type'))

  if (!name) {
    throw new Error('Nome da instituição é obrigatório.')
  }

  await createInstitution({
    name,
    type,
  })

  revalidatePath('/institutions')
  revalidatePath('/accounts/new')
}

export async function updateInstitutionAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const id = (formData.get('id') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const type = parseInstitutionType(formData.get('type'))

  if (!id) {
    throw new Error('ID da instituição é obrigatório.')
  }

  await updateInstitution(id, {
    name,
    type,
  })

  revalidatePath('/institutions')
  revalidatePath('/accounts/new')
}