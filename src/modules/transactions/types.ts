import type { TransactionType, Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

export type TransactionCreateInput = {
  referenceId: string     // chave de idempotência — deve ser única por operação de negócio
  type: TransactionType
  accountId: string
  assetId?: string
  quantity?: number | string
  price?: number | string
  totalAmount: number | string
  date: Date
  notes?: string
}

export type TransactionResult = {
  id: string
  referenceId: string
  type: TransactionType
  accountId: string
  assetId: string | null
  quantity: Decimal | null
  price: Decimal | null
  totalAmount: Decimal
  date: Date
  notes: string | null
  createdAt: Date
  ledgerEntries: LedgerEntryResult[]
  idempotent: boolean  // true = transação já existia, retornada sem reprocessar
}

export type LedgerEntryResult = {
  id: string
  transactionId: string
  accountId: string
  debit: Decimal | null
  credit: Decimal | null
  balanceAfter: Decimal
  createdAt: Date
}
