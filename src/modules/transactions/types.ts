import type { TransactionType, Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

export type TransactionCreateInput = {
  referenceId: string     // chave de idempotência — deve ser única por operação de negócio
  type: TransactionType
  accountId: string
  originAccountId?: string
  assetId?: string
  quantity?: number | string
  price?: number | string
  totalAmount: number | string
  date: Date
  sourceMovementType?: string
  isTaxExempt?: boolean
  subscriptionDeadline?: Date
  isIncoming?: boolean
  ledgerMovementType?: string
  ledgerDescription?: string
  notes?: string
}

export type TransactionResult = {
  id: string
  referenceId: string
  type: TransactionType
  accountId: string
  originAccountId: string | null
  assetId: string | null
  quantity: Decimal | null
  price: Decimal | null
  totalAmount: Decimal
  date: Date
  sourceMovementType: string | null
  isTaxExempt: boolean
  subscriptionDeadline: Date | null
  notes: string | null
  createdAt: Date
  ledgerEntries: LedgerEntryResult[]
  idempotent: boolean  // true = transação já existia, retornada sem reprocessar
}

export type LedgerEntryResult = {
  id: string
  transactionId: string
  accountId: string
  ledgerAccountId: string | null
  debit: Decimal | null
  credit: Decimal | null
  movementType: string | null
  description: string | null
  isIncoming: boolean
  balanceAfter: Decimal
  createdAt: Date
}
