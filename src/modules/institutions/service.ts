import { InstitutionType } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { InstitutionCreateInput, InstitutionUpdateInput } from './types'

function normalizeInstitutionName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function validateInstitutionType(type: unknown) {
  if (type === undefined || type === null) {
    return
  }

  if (!Object.values(InstitutionType).includes(type as InstitutionType)) {
    throw new Error('Tipo de instituição inválido.')
  }
}

/**
 * Cria uma instituição com validações de nome, tipo e duplicidade funcional.
 */
export async function createInstitution(input: InstitutionCreateInput) {
  const normalizedName = normalizeInstitutionName(input.name)

  if (!normalizedName) {
    throw new Error('Nome da instituição é obrigatório.')
  }

  validateInstitutionType(input.type)

  const existingInstitution = await prisma.institution.findFirst({
    where: {
      name: {
        equals: normalizedName,
        mode: 'insensitive',
      },
    },
  })

  if (existingInstitution) {
    throw new Error('Já existe uma instituição com este nome.')
  }

  return prisma.institution.create({
    data: {
      name: normalizedName,
      type: input.type ?? null,
    },
  })
}

/**
 * Lista instituições cadastradas ordenadas por nome.
 */
export async function listInstitutions() {
  return prisma.institution.findMany({
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * Atualiza uma instituição com validações de nome, tipo e duplicidade funcional.
 */
export async function updateInstitution(id: string, input: InstitutionUpdateInput) {
  if (!id.trim()) {
    throw new Error('ID da instituição é obrigatório.')
  }

  const hasName = input.name !== undefined
  const hasType = input.type !== undefined

  if (!hasName && !hasType) {
    throw new Error('Informe ao menos um campo para atualizar a instituição.')
  }

  const updateData: { name?: string; type?: InstitutionType | null } = {}

  if (hasName) {
    const normalizedName = normalizeInstitutionName(input.name as string)

    if (!normalizedName) {
      throw new Error('Nome da instituição é obrigatório.')
    }

    const existingInstitution = await prisma.institution.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    })

    if (existingInstitution) {
      throw new Error('Já existe uma instituição com este nome.')
    }

    updateData.name = normalizedName
  }

  if (hasType) {
    validateInstitutionType(input.type)
    updateData.type = input.type ?? null
  }

  return prisma.institution.update({
    where: { id },
    data: updateData,
  })
}
