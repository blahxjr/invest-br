import type { AccountType } from '@prisma/client'

export type AccountCreateInput = {
  name: string
  type: AccountType
  clientId: string
  institutionId: string
  portfolioId?: string
}

export type AccountUpdateInput = {
  name?: string
  institutionId?: string
  portfolioId?: string | null
}
