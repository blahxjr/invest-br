import type { InstitutionType } from '@prisma/client'

export type InstitutionCreateInput = {
  name: string
  type?: InstitutionType | null
}

export type InstitutionUpdateInput = {
  name?: string
  type?: InstitutionType | null
}
