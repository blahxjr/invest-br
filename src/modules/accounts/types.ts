import type { AccountType } from '@prisma/client'

export type AccountCreateInput = {
  name: string
  type: AccountType
  portfolioId: string
  institutionId?: string
}
